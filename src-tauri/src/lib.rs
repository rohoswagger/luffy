pub mod session;
pub mod status;
pub mod commands;
pub mod pty_stream;
pub mod git;

use session::SessionManager;
use pty_stream::PtyManager;
use std::sync::Arc;

pub struct AppState {
    pub session_mgr: Arc<SessionManager>,
    pub pty_mgr: Arc<PtyManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            session_mgr: Arc::new(SessionManager::new()),
            pty_mgr: Arc::new(PtyManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_session,
            commands::kill_session,
            commands::list_sessions,
            commands::send_input,
            commands::broadcast_input,
            commands::restore_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn smoke_test() {
        assert_eq!(1 + 1, 2);
    }
}
