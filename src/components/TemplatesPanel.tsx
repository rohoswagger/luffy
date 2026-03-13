import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AGENT_ICONS } from "../constants";

interface Template {
  id: string;
  name: string;
  agent_type: string;
  working_dir: string | null;
  count: number;
  startup_command: string | null;
  cost_budget_usd: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunch: (template: Template) => void;
}

export function TemplatesPanel({ open, onClose, onLaunch }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!open) return;
    invoke<Template[]>("list_templates")
      .then(setTemplates)
      .catch((err: unknown) => {
        console.error("Failed to list templates:", err);
        setTemplates([]);
      });
  }, [open]);

  if (!open) return null;

  const handleDelete = async (id: string) => {
    const updated = await invoke<Template[]>("delete_template", {
      templateId: id,
    });
    setTemplates(updated);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Session Templates
          </span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            Save & relaunch session configs
          </span>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {templates.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            >
              No templates saved. Create sessions and save them as templates.
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {AGENT_ICONS[t.agent_type] || "▸"}
                </span>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {t.agent_type} ·{" "}
                    {t.count > 1 ? `${t.count} sessions` : "1 session"}
                    {t.working_dir && ` · ${t.working_dir}`}
                    {t.cost_budget_usd > 0 &&
                      ` · $${t.cost_budget_usd.toFixed(2)} budget`}
                  </div>
                </div>
                <button
                  aria-label="launch"
                  onClick={() => {
                    onLaunch(t);
                    onClose();
                  }}
                  style={{
                    background: "var(--accent-blue)",
                    border: "none",
                    borderRadius: 4,
                    color: "#000",
                    cursor: "pointer",
                    fontSize: 11,
                    padding: "4px 10px",
                    fontWeight: 600,
                  }}
                >
                  Launch
                </button>
                <button
                  aria-label="delete"
                  onClick={() => handleDelete(t.id)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 11,
                    padding: "4px 8px",
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          Templates are saved to ~/.config/luffy/templates.json
        </div>
      </div>
    </div>
  );
}
