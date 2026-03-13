import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_COMMANDS: Record<string, string> = {
  "claude-code": "claude",
  "aider": "aider",
  "generic": "",
};

interface CreateArgs {
  name: string;
  agent_type: string;
  working_dir: string | null;
  startup_command: string;
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
  const [startupCommand, setStartupCommand] = useState(DEFAULT_COMMANDS["claude-code"]);

  useEffect(() => {
    setStartupCommand(DEFAULT_COMMANDS[agentType] ?? "");
  }, [agentType]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseName = name.trim() || "session";
    const dir = workingDir.trim() || null;
    if (count > 1) {
      for (let i = 1; i <= count; i++) {
        onCreate({ name: `${baseName}-${i}`, agent_type: agentType, working_dir: dir, startup_command: startupCommand });
      }
    } else {
      onCreate({ name: baseName, agent_type: agentType, working_dir: dir, startup_command: startupCommand });
    }
    setName("");
    setWorkingDir("");
    setCount(1);
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  };

  const modalStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: 24, width: 400, display: "flex", flexDirection: "column", gap: 16,
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 4,
    color: "var(--text-primary)", padding: "8px 12px", fontSize: 13, width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "var(--text-secondary)", marginBottom: 4,
    display: "block", textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>New Session</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Session Name</label>
            <input style={inputStyle} placeholder="Session name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Agent Type</label>
            <select style={inputStyle} value={agentType} onChange={(e) => setAgentType(e.target.value)}>
              <option value="claude-code">Claude Code</option>
              <option value="aider">Aider</option>
              <option value="generic">Generic</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Working Directory (optional)</label>
            <input style={inputStyle} placeholder="/path/to/project" value={workingDir} onChange={(e) => setWorkingDir(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Startup Command (optional)</label>
            <input style={inputStyle} placeholder="e.g. claude, aider" value={startupCommand} onChange={(e) => setStartupCommand(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Count (spawn N parallel sessions)</label>
            <input
              type="number"
              min={1}
              max={20}
              style={{ ...inputStyle, width: 80 }}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const baseName = name.trim() || "session";
                invoke("save_template", { name: baseName, agentType: agentType, workingDir: workingDir.trim() || null, count }).catch(console.error);
              }}
              style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
              title="Save this config as a reusable template"
            >
              Save template
            </button>
            <button type="submit" style={{ ...inputStyle, width: "auto", cursor: "pointer", background: "var(--accent-blue)", border: "none", color: "#000", fontWeight: 600 }}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
