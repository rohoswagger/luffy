import type { Layout } from "./PaneGrid";

interface Props {
  current: Layout;
  onChange: (layout: Layout) => void;
}

const LAYOUTS: { id: Layout; title: string; icon: string }[] = [
  { id: "1up", title: "1 pane",  icon: "▣" },
  { id: "2up", title: "2 panes", icon: "⊞" },
  { id: "4up", title: "4 panes", icon: "⊟" },
];

export function LayoutSwitcher({ current, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {LAYOUTS.map(({ id, title, icon }) => (
        <button
          key={id}
          title={title}
          data-active={current === id}
          onClick={() => onChange(id)}
          style={{
            background: current === id ? "var(--bg-tertiary)" : "none",
            border: current === id ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
            borderRadius: 4,
            color: current === id ? "var(--accent-blue)" : "var(--text-secondary)",
            cursor: "pointer",
            width: 24,
            height: 22,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
