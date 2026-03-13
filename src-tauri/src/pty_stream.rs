use anyhow::Result;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::sync::{Arc, Mutex, OnceLock};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread;
use regex::Regex;

const MAX_SEARCH_BUF: usize = 50 * 1024;

pub struct PtyHandle {
    pub writer: Box<dyn Write + Send>,
    /// Keep child alive — dropping it sends SIGHUP and kills the PTY process.
    pub _child: Box<dyn portable_pty::Child + Send>,
    /// Keep master alive for PTY resize operations.
    master: Box<dyn portable_pty::MasterPty + Send>,
}

#[derive(Default)]
pub struct PtyManager {
    handles: Arc<Mutex<HashMap<String, PtyHandle>>>,
    /// ANSI-stripped rolling output buffers for cross-session search.
    output_buffers: Arc<Mutex<HashMap<String, String>>>,
}

/// Strip ANSI/VT escape sequences and carriage returns for plain-text search.
pub fn strip_ansi(s: &str) -> String {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"\x1b(?:\[[0-9;?]*[A-HJKSTfhlmnprsuABCDEFGHfJKSTm]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[()][AB012]|[=>M])|\r").unwrap()
    });
    re.replace_all(s, "").to_string()
}

impl PtyManager {
    pub fn new() -> Self {
        PtyManager {
            handles: Arc::new(Mutex::new(HashMap::new())),
            output_buffers: Arc::new(Mutex::new(HashMap::new())),
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
        let master = pair.master;

        let buffers = self.output_buffers.clone();
        let buf_sid = session_id.clone();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                        let stripped = strip_ansi(&chunk);
                        {
                            let mut bufs = buffers.lock().unwrap();
                            let entry = bufs.entry(buf_sid.clone()).or_default();
                            entry.push_str(&stripped);
                            if entry.len() > MAX_SEARCH_BUF {
                                let trim_at = entry.len() - MAX_SEARCH_BUF;
                                let trim_at = entry
                                    .char_indices()
                                    .find(|(i, _)| *i >= trim_at)
                                    .map(|(i, _)| i)
                                    .unwrap_or(trim_at);
                                *entry = entry[trim_at..].to_string();
                            }
                        }
                        on_data(chunk);
                    }
                }
            }
        });

        self.handles.lock().unwrap().insert(session_id, PtyHandle { writer, _child: child, master });
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

    /// Resize the PTY for a session to match the frontend terminal dimensions.
    pub fn resize(&self, session_id: &str, rows: u16, cols: u16) {
        if let Some(handle) = self.handles.lock().unwrap().get(session_id) {
            let _ = handle.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 });
        }
    }

    /// Return the ANSI-stripped output buffer for a session.
    pub fn get_output(&self, session_id: &str) -> Option<String> {
        self.output_buffers.lock().unwrap().get(session_id).cloned()
    }

    pub fn detach(&self, session_id: &str) {
        self.handles.lock().unwrap().remove(session_id);
        self.output_buffers.lock().unwrap().remove(session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    struct FakeWriter;
    impl Write for FakeWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> { Ok(buf.len()) }
        fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
    }

    #[derive(Debug)]
    struct FakeChild;
    impl portable_pty::ChildKiller for FakeChild {
        fn kill(&mut self) -> std::io::Result<()> { Ok(()) }
        fn clone_killer(&self) -> Box<dyn portable_pty::ChildKiller + Send + Sync> { Box::new(FakeChild) }
    }
    impl portable_pty::Child for FakeChild {
        fn try_wait(&mut self) -> std::io::Result<Option<portable_pty::ExitStatus>> { Ok(None) }
        fn wait(&mut self) -> std::io::Result<portable_pty::ExitStatus> {
            Ok(portable_pty::ExitStatus::with_exit_code(0))
        }
        fn process_id(&self) -> Option<u32> { None }
    }

    struct FakeMaster {
        resized: Arc<AtomicBool>,
    }
    impl portable_pty::MasterPty for FakeMaster {
        fn resize(&self, _size: PtySize) -> anyhow::Result<()> {
            self.resized.store(true, Ordering::SeqCst);
            Ok(())
        }
        fn get_size(&self) -> anyhow::Result<PtySize> {
            Ok(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        }
        fn take_writer(&self) -> anyhow::Result<Box<dyn Write + Send>> {
            Ok(Box::new(FakeWriter))
        }
        fn try_clone_reader(&self) -> anyhow::Result<Box<dyn Read + Send>> {
            Ok(Box::new(std::io::Cursor::new(vec![])))
        }
        fn process_group_leader(&self) -> Option<i32> { None }
        fn as_raw_fd(&self) -> Option<i32> { None }
    }

    fn fake_handle(resized: Arc<AtomicBool>) -> PtyHandle {
        PtyHandle {
            writer: Box::new(FakeWriter),
            _child: Box::new(FakeChild),
            master: Box::new(FakeMaster { resized }),
        }
    }

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
    fn resize_calls_master_resize() {
        let flag = Arc::new(AtomicBool::new(false));
        let mgr = PtyManager::new();
        mgr.handles.lock().unwrap().insert("sid".to_string(), fake_handle(flag.clone()));
        mgr.resize("sid", 40, 160);
        assert!(flag.load(Ordering::SeqCst), "master.resize() was not called");
    }

    #[test]
    fn resize_unknown_session_is_noop() {
        let mgr = PtyManager::new();
        mgr.resize("ghost", 24, 80); // should not panic
    }

    #[test]
    fn detach_removes_handle() {
        let flag = Arc::new(AtomicBool::new(false));
        let mgr = PtyManager::new();
        mgr.handles.lock().unwrap().insert("test-id".to_string(), fake_handle(flag));
        assert_eq!(mgr.handles.lock().unwrap().len(), 1);
        mgr.detach("test-id");
        assert_eq!(mgr.handles.lock().unwrap().len(), 0);
    }

    #[test]
    fn strip_ansi_removes_color_codes() {
        let raw = "\x1b[32mHello\x1b[0m World";
        assert_eq!(strip_ansi(raw), "Hello World");
    }

    #[test]
    fn strip_ansi_removes_cursor_movement() {
        let raw = "\x1b[2J\x1b[HClean screen";
        assert_eq!(strip_ansi(raw), "Clean screen");
    }

    #[test]
    fn strip_ansi_removes_carriage_return() {
        let raw = "line1\r\nline2";
        assert_eq!(strip_ansi(raw), "line1\nline2");
    }

    #[test]
    fn get_output_returns_none_for_unknown_session() {
        let mgr = PtyManager::new();
        assert!(mgr.get_output("unknown").is_none());
    }

    #[test]
    fn output_buffer_accumulates_stripped_content() {
        let mgr = PtyManager::new();
        mgr.output_buffers.lock().unwrap().insert(
            "s1".to_string(),
            "error: something went wrong\n".to_string(),
        );
        let out = mgr.get_output("s1").unwrap();
        assert!(out.contains("error: something went wrong"));
    }

    #[test]
    fn detach_also_clears_output_buffer() {
        let flag = Arc::new(AtomicBool::new(false));
        let mgr = PtyManager::new();
        mgr.handles.lock().unwrap().insert("sid".to_string(), fake_handle(flag));
        mgr.output_buffers.lock().unwrap().insert("sid".to_string(), "some output".to_string());
        mgr.detach("sid");
        assert!(mgr.get_output("sid").is_none());
    }
}
