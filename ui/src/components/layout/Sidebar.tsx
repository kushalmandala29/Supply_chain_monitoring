interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const NAV_ITEMS = [
  { id: "twin", icon: "🌐", label: "Digital Twin" },
  { id: "warroom", icon: "⚔️", label: "War Room" },
  { id: "finance", icon: "💰", label: "Financial Impact" },
];

/**
 * Navigation sidebar with view selection.
 */
export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{ fontSize: "1.5rem" }}>🧠</span>
        <h1>SCRI v8.0</h1>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`nav-item ${activeView === item.id ? "active" : ""}`}
            onClick={() => onViewChange(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ marginTop: "auto", padding: "var(--space-md)" }}>
        <div className="section-header">
          <span className="section-icon">🤖</span>
          <h2>Agent Status</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {[
            { name: "Supervisor", color: "var(--color-agent-supervisor)" },
            { name: "Intelligence", color: "var(--color-agent-intel)" },
            { name: "Spatial", color: "var(--color-agent-spatial)" },
            { name: "Logistics", color: "var(--color-agent-logistics)" },
            { name: "Finance", color: "var(--color-agent-finance)" },
            { name: "Synthesis", color: "var(--color-agent-synthesis)" },
          ].map((agent) => (
            <div key={agent.name} style={{
              display: "flex", alignItems: "center", gap: "var(--space-sm)",
              fontSize: "0.8rem", color: "var(--color-text-secondary)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: agent.color, display: "inline-block",
              }} />
              {agent.name}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
