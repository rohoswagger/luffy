use anyhow::Result;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread;

pub struct PtyHandle {
    pub writer: Box<dyn Write + Send>,
    /// Keep child alive — dropping it sends SIGHUP and kills the PTY process.
    pub _child: Box<dyn portable_pty::Child + Send>,
}

pub struct PtyManager {
    handles: Arc<Mutex<HashMap<String, PtyHandle>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        PtyManager {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawn a PTY attached to a tmux session and stream output via callback.
    pub fn attach<F>(&self, session_id: String, tmux_session: &str, on_data: F) -> Result<()>
    where
        F: Fn(String) + Send + 'static,
    {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows: 50,
            cols: 220,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new("tmux");
        cmd.args(["attach-session", "-t", tmux_session]);

        let child = pair.slave.spawn_command(cmd)?;
        let writer = pair.master.take_writer()?;
        let mut reader = pair.master.try_clone_reader()?;

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                        on_data(chunk);
                    }
                }
            }
        });

        self.handles.lock().unwrap().insert(session_id, PtyHandle { writer, _child: child });
        Ok(())
    }

    /// Send input to a session's PTY.
    pub fn write_input(&self, session_id: &str, input: &str) -> Result<()> {
        let mut handles = self.handles.lock().unwrap();
        if let Some(handle) = handles.get_mut(session_id) {
            handle.writer.write_all(input.as_bytes())?;
            handle.writer.flush()?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("No PTY handle for session: {}", session_id))
        }
    }

    /// Resize a PTY pane.
    pub fn resize(&self, _session_id: &str, _rows: u16, _cols: u16) {
        // v2: implement per-pair resize via portable-pty resize API
    }

    pub fn detach(&self, session_id: &str) {
        self.handles.lock().unwrap().remove(session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_pty_manager_has_no_handles() {
        let mgr = PtyManager::new();
        assert_eq!(mgr.handles.lock().unwrap().len(), 0);
    }

    #[test]
    fn write_to_nonexistent_session_returns_err() {
        let mgr = PtyManager::new();
        assert!(mgr.write_input("fake-id", "hello").is_err());
    }

    #[test]
    fn detach_removes_handle() {
        struct FakeWriter;
        impl Write for FakeWriter {
            fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> { Ok(buf.len()) }
            fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
        }

        #[derive(Debug)]
        struct FakeChild;
        impl portable_pty::ChildKiller for FakeChild {
            fn kill(&mut self) -> std::io::Result<()> { Ok(()) }
            fn clone_killer(&self) -> Box<dyn portable_pty::ChildKiller + Send + Sync> {
                Box::new(FakeChild)
            }
        }
        impl portable_pty::Child for FakeChild {
            fn try_wait(&mut self) -> std::io::Result<Option<portable_pty::ExitStatus>> { Ok(None) }
            fn wait(&mut self) -> std::io::Result<portable_pty::ExitStatus> {
                Ok(portable_pty::ExitStatus::with_exit_code(0))
            }
            fn process_id(&self) -> Option<u32> { None }
        }

        let mgr = PtyManager::new();
        mgr.handles.lock().unwrap().insert("test-id".to_string(), PtyHandle {
            writer: Box::new(FakeWriter),
            _child: Box::new(FakeChild),
        });
        assert_eq!(mgr.handles.lock().unwrap().len(), 1);
        mgr.detach("test-id");
        assert_eq!(mgr.handles.lock().unwrap().len(), 0);
    }
}
