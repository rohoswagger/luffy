use regex::Regex;
use std::sync::OnceLock;

/// Extract the dollar cost value from terminal output.
/// Finds all lines containing "cost" and extracts the maximum dollar amount.
/// Handles: "Cost: $0.023", "Total cost: $1.23", Aider's multi-amount lines.
pub fn detect_cost(output: &str) -> Option<f64> {
    static COST_LINE: OnceLock<Regex> = OnceLock::new();
    static DOLLAR: OnceLock<Regex> = OnceLock::new();

    let cost_line = COST_LINE.get_or_init(|| Regex::new(r"(?i)cost").unwrap());
    let dollar = DOLLAR.get_or_init(|| Regex::new(r"\$(\d+(?:\.\d{1,6})?)").unwrap());

    // Cap at $10,000 to prevent false budget-exceeded kills from parsing
    // unreasonable dollar amounts in output (e.g., "$99999999" in a log message)
    const MAX_REASONABLE_COST: f64 = 10_000.0;

    output
        .lines()
        .filter(|line| cost_line.is_match(line))
        .flat_map(|line| {
            dollar
                .captures_iter(line)
                .filter_map(|cap| cap[1].parse::<f64>().ok())
                .filter(|&v| v <= MAX_REASONABLE_COST)
                .collect::<Vec<_>>()
        })
        .reduce(f64::max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_simple_cost() {
        let output = "Running...\nCost: $0.023\n> ";
        let cost = detect_cost(output).unwrap();
        assert!((cost - 0.023).abs() < 1e-9);
    }

    #[test]
    fn detects_total_cost() {
        let output = "● Total cost:            $1.2345\n";
        let cost = detect_cost(output).unwrap();
        assert!((cost - 1.2345).abs() < 1e-9);
    }

    #[test]
    fn detects_session_cost_from_aider() {
        let output = "Tokens: 1,234 sent, 567 received. Cost: $0.01 message, $0.05 session.";
        let cost = detect_cost(output).unwrap();
        // Should return the max (0.05 session cost)
        assert!((cost - 0.05).abs() < 1e-9);
    }

    #[test]
    fn returns_none_when_no_cost() {
        let output = "Reading src/main.rs\nFound 42 functions";
        assert!(detect_cost(output).is_none());
    }

    #[test]
    fn returns_none_for_empty_string() {
        assert!(detect_cost("").is_none());
    }

    #[test]
    fn ignores_cost_without_dollar_sign() {
        let output = "total cost 5 tokens";
        assert!(detect_cost(output).is_none());
    }

    #[test]
    fn ignores_unreasonable_cost_values() {
        // Values above $10,000 are ignored to prevent false budget kills
        let output = "Cost: $99999999.99";
        assert!(detect_cost(output).is_none());
    }

    #[test]
    fn reasonable_cost_still_detected() {
        // Values at the cap boundary still work
        let output = "Cost: $9999.99";
        let cost = detect_cost(output).unwrap();
        assert!((cost - 9999.99).abs() < 1e-6);
    }
}
