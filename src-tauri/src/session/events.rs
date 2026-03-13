use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum EventKind {
    Created,
    StatusChanged { from: String, to: String },
    CostUpdated { cost_usd: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionEvent {
    pub timestamp: DateTime<Utc>,
    pub kind: EventKind,
}

impl SessionEvent {
    pub fn created() -> Self {
        SessionEvent {
            timestamp: Utc::now(),
            kind: EventKind::Created,
        }
    }

    pub fn status_changed(from: &str, to: &str) -> Self {
        SessionEvent {
            timestamp: Utc::now(),
            kind: EventKind::StatusChanged {
                from: from.to_string(),
                to: to.to_string(),
            },
        }
    }

    pub fn cost_updated(cost_usd: f64) -> Self {
        SessionEvent {
            timestamp: Utc::now(),
            kind: EventKind::CostUpdated { cost_usd },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn created_event_has_created_kind() {
        let ev = SessionEvent::created();
        assert!(matches!(ev.kind, EventKind::Created));
    }

    #[test]
    fn status_changed_event_stores_from_and_to() {
        let ev = SessionEvent::status_changed("IDLE", "THINKING");
        match &ev.kind {
            EventKind::StatusChanged { from, to } => {
                assert_eq!(from, "IDLE");
                assert_eq!(to, "THINKING");
            }
            _ => panic!("wrong kind"),
        }
    }

    #[test]
    fn cost_updated_event_stores_cost() {
        let ev = SessionEvent::cost_updated(1.23);
        match ev.kind {
            EventKind::CostUpdated { cost_usd } => assert!((cost_usd - 1.23).abs() < 1e-9),
            _ => panic!("wrong kind"),
        }
    }
}
