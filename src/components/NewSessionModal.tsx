import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_COMMANDS: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
  aider: "aider",
  generic: "",
};

interface CreateArgs {
  name: string;
  agent_type: string;
  working_dir: string | null;
  startup_command: string;
  create_worktree: boolean;
  cost_budget_usd: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (args: CreateArgs) => void;
}

export function NewSessionModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState("claude-code");
  const [workingDir, setWorkingDir] = useState("");
  const [count, setCount] = useState(1);
  const [startupCommand, setStartupCommand] = useState(
    DEFAULT_COMMANDS["claude-code"],
  );
  const [createWorktree, setCreateWorktree] = useState(false);
  const [costBudget, setCostBudget] = useState(0);

  useEffect(() => {
    setStartupCommand(DEFAULT_COMMANDS[agentType] ?? "");
  }, [agentType]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setAgentType("claude-code");
      setWorkingDir("");
      setCount(1);
      setStartupCommand(DEFAULT_COMMANDS["claude-code"]);
      setCreateWorktree(false);
      setCostBudget(0);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseName = name.trim() || "session";
    const dir = workingDir.trim() || null;
    if (count > 1) {
      for (let i = 1; i <= count; i++) {
        onCreate({
          name: `${baseName}-${i}`,
          agent_type: agentType,
          working_dir: dir,
          startup_command: startupCommand,
          create_worktree: createWorktree,
          cost_budget_usd: costBudget,
        });
      }
    } else {
      onCreate({
        name: baseName,
        agent_type: agentType,
        working_dir: dir,
        startup_command: startupCommand,
        create_worktree: createWorktree,
        cost_budget_usd: costBudget,
      });
    }
    setName("");
    setWorkingDir("");
    setCount(1);
    setCostBudget(0);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New Session"
        className="modal"
        style={{ width: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">New Session</h2>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-4)",
          }}
        >
          <div>
            <label className="label">Session Name</label>
            <input
              className="input"
              placeholder="Session name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Agent Type</label>
            <select
              className="input"
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
            >
              <option value="claude-code">◆ Claude Code</option>
              <option value="codex">🧬 Codex</option>
              <option value="aider">⚡ Aider</option>
              <option value="generic">▸ Generic</option>
            </select>
          </div>
          <div>
            <label className="label">Working Directory</label>
            <input
              className="input"
              placeholder="/path/to/project"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
            />
          </div>
          {workingDir && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={createWorktree}
                onChange={(e) => setCreateWorktree(e.target.checked)}
                style={{ cursor: "pointer", accentColor: "var(--blue)" }}
              />
              <span
                style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}
              >
                Create git worktree + branch
              </span>
            </label>
          )}
          <div>
            <label className="label">Startup Command</label>
            <input
              className="input"
              placeholder="e.g. claude, aider"
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--sp-4)" }}>
            <div style={{ flex: 1 }}>
              <label className="label">Count</label>
              <input
                type="number"
                min={1}
                max={20}
                className="input"
                style={{ width: 80 }}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                  )
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Cost Budget (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input"
                style={{ width: 100 }}
                value={costBudget || ""}
                placeholder="0.00"
                onChange={(e) =>
                  setCostBudget(Math.max(0, parseFloat(e.target.value) || 0))
                }
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const baseName = name.trim() || "session";
                invoke("save_template", {
                  name: baseName,
                  agentType,
                  workingDir: workingDir.trim() || null,
                  count,
                  startupCommand: startupCommand || null,
                  costBudgetUsd: costBudget > 0 ? costBudget : null,
                }).catch(console.error);
              }}
              className="btn btn-ghost"
              title="Save this config as a reusable template"
            >
              Save template
            </button>
            <button type="submit" className="btn btn-primary">
              Create{count > 1 ? ` ×${count}` : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
