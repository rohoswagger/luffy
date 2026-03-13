/// Detects THINKING sessions that appear stuck (no output change for a threshold duration).
///
/// Tracks the last output snapshot and the time it was first observed unchanged.
/// When the same output has persisted for `threshold_secs`, the session is considered stuck.
use std::collections::HashMap;
use std::time::{Duration, Instant};

pub struct StuckDetector {
    /// session_id → (last output snapshot, time first observed at this snapshot)
    snapshots: HashMap<String, (String, Instant)>,
    pub threshold: Duration,
}

impl StuckDetector {
    pub fn new(threshold_secs: u64) -> Self {
        StuckDetector {
            snapshots: HashMap::new(),
            threshold: Duration::from_secs(threshold_secs),
        }
    }

    /// Remove sessions that are no longer active (e.g. no longer THINKING).
    pub fn retain_only(&mut self, active_ids: &[String]) {
        let id_set: std::collections::HashSet<_> = active_ids.iter().collect();
        self.snapshots.retain(|id, _| id_set.contains(id));
    }

    /// Feed the current output for a session.
    /// Returns `true` if the session appears stuck (unchanged for >= threshold).
    /// First observation for a session always returns false (we haven't waited yet).
    pub fn check(&mut self, session_id: &str, current_output: &str) -> bool {
        let now = Instant::now();
        match self.snapshots.get_mut(session_id) {
            None => {
                self.snapshots
                    .insert(session_id.to_string(), (current_output.to_string(), now));
                false
            }
            Some(entry) => {
                if entry.0 != current_output {
                    entry.0 = current_output.to_string();
                    entry.1 = now;
                    false
                } else {
                    entry.1.elapsed() >= self.threshold
                }
            }
        }
    }

    /// Reset tracking for a session (call after interrupting it).
    pub fn reset(&mut self, session_id: &str) {
        self.snapshots.remove(session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn new_session_is_not_stuck_on_first_check() {
        let mut d = StuckDetector::new(900);
        assert!(!d.check("s1", "some output"));
    }

    #[test]
    fn same_output_but_within_threshold_is_not_stuck() {
        let mut d = StuckDetector::new(900);
        d.check("s1", "output");
        assert!(!d.check("s1", "output")); // threshold is 900s, not elapsed yet
    }

    #[test]
    fn changed_output_resets_and_is_not_stuck() {
        // Use a very short threshold to test immediate behavior
        let mut d = StuckDetector::new(900);
        d.check("s1", "output A");
        // Change output: should reset and NOT be stuck
        assert!(!d.check("s1", "output B"));
    }

    #[test]
    fn same_output_after_threshold_is_stuck() {
        // Manually insert an entry with an old timestamp to simulate elapsed time
        let mut d = StuckDetector::new(0); // threshold = 0 seconds
        d.check("s1", "frozen output");
        // With threshold=0, any call after the first should report stuck
        std::thread::sleep(Duration::from_millis(1));
        assert!(d.check("s1", "frozen output"));
    }

    #[test]
    fn reset_clears_state() {
        let mut d = StuckDetector::new(0);
        d.check("s1", "output");
        std::thread::sleep(Duration::from_millis(1));
        assert!(d.check("s1", "output")); // stuck with threshold=0
        d.reset("s1");
        // After reset, first check should not be stuck
        assert!(!d.check("s1", "output"));
    }

    #[test]
    fn retain_only_removes_inactive_sessions() {
        let mut d = StuckDetector::new(900);
        d.check("s1", "out");
        d.check("s2", "out");
        d.check("s3", "out");
        d.retain_only(&["s1".to_string(), "s3".to_string()]);
        // s2 should be removed
        assert!(!d.snapshots.contains_key("s2"));
        assert!(d.snapshots.contains_key("s1"));
        assert!(d.snapshots.contains_key("s3"));
    }

    #[test]
    fn multiple_sessions_tracked_independently() {
        let mut d = StuckDetector::new(0);
        d.check("s1", "output-a");
        d.check("s2", "output-b");
        std::thread::sleep(Duration::from_millis(1));
        assert!(d.check("s1", "output-a")); // s1 stuck
        assert!(d.check("s2", "output-b")); // s2 stuck
                                            // Changing s2 should not affect s1
        assert!(!d.check("s2", "output-b-new")); // s2 reset
        assert!(d.check("s1", "output-a")); // s1 still stuck
    }
}
