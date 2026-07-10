interface HeaderProps {
  isConnected: boolean;
  activeView: string;
}

const VIEW_TITLES: Record<string, string> = {
  twin: "Live Supply Chain Flow Topology",
  warroom: "War Room — Scenario Simulation",
  finance: "Financial Impact Analysis",
};

/**
 * Top header bar with connection status and view title.
 */
export function Header({ isConnected, activeView }: HeaderProps) {
  return (
    <header className="header" id="app-header">
      <span className="header-title">
        {VIEW_TITLES[activeView] || "Cognitive Control Tower"}
      </span>

      <div className="connection-status">
        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
        <span style={{ color: isConnected ? "var(--color-success)" : "var(--color-danger)" }}>
          {isConnected ? "Live" : "Disconnected"}
        </span>
      </div>
    </header>
  );
}
