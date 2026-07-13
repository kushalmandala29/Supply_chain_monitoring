import { NavLink } from "react-router-dom";

import { useWorkspaceStore } from "../../store/useWorkspaceStore";

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Command Center", to: "/command-center", icon: "◈" },
  { label: "Supply Chain Map", to: "/map", icon: "🌐" },
  { label: "KPI Dashboard", to: "/kpi", icon: "▤" },
  { label: "News & Intelligence", to: "/intelligence", icon: "◉" },
  { label: "Commodities", to: "/map?layer=commodity", icon: "◆" },
  { label: "Warehouses", to: "/map?entityType=Warehouse", icon: "▣" },
  { label: "Suppliers", to: "/map?entityType=Supplier", icon: "▲" },
  { label: "Routes", to: "/map?entityType=route", icon: "⟶" },
  { label: "Alerts", to: "/alerts", icon: "⚠" },
  { label: "Timeline", to: "/map?mode=playback", icon: "◷" },
  { label: "Investigations", to: "/investigations", icon: "⌕" },
  { label: "Settings", to: "/settings", icon: "⚙" },
];

export default function Sidebar() {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const favoriteEntityIds = useWorkspaceStore((s) => s.favoriteEntityIds);
  const pinnedEntities = useWorkspaceStore((s) => s.pinnedEntities);
  const investigations = useWorkspaceStore((s) => s.investigations);

  return (
    <aside
      className={`
        relative z-20 shrink-0 h-full flex flex-col glass border-r border-cyan-400/10
        transition-all duration-300 ease-out
        ${collapsed ? "w-[3.75rem]" : "w-64"}
      `}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5 shrink-0">
        <span className="text-lg glow-text shrink-0">◈</span>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold tracking-[0.22em] uppercase glow-text leading-none">
              Jarvis
            </span>
            <span className="text-[8px] tracking-[0.15em] text-cyan-400/40 uppercase truncate">
              Command Center
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={!item.to.includes("?")}
            className={({ isActive }) => `
              flex items-center gap-3 rounded-lg px-2.5 py-2 text-[11px] font-medium
              transition-colors duration-150
              ${isActive
                ? "bg-cyan-400/10 text-cyan-200 border border-cyan-400/20"
                : "text-cyan-100/50 hover:text-cyan-100 hover:bg-white/5 border border-transparent"}
            `}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-[13px] w-4 text-center shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Favorites / pinned / recent investigations */}
      {!collapsed && (
        <div className="shrink-0 border-t border-white/5 px-3 py-3 space-y-3 max-h-64 overflow-y-auto">
          <SidebarSection title="Favorites" emptyLabel="No favorites yet" count={favoriteEntityIds.length}>
            {favoriteEntityIds.slice(0, 5).map((id) => (
              <div key={id} className="truncate text-[10px] text-cyan-300/50">{id.split(":")[1] ?? id}</div>
            ))}
          </SidebarSection>
          <SidebarSection title="Pinned" emptyLabel="No pinned entities" count={pinnedEntities.length}>
            {pinnedEntities.slice(0, 5).map((p) => (
              <div key={`${p.type}:${p.id}`} className="truncate text-[10px] text-cyan-300/50">{p.label}</div>
            ))}
          </SidebarSection>
          <SidebarSection title="Investigations" emptyLabel="No saved investigations" count={investigations.length}>
            {investigations.slice(0, 5).map((inv) => (
              <NavLink
                key={inv.id}
                to={`/investigations/${inv.id}`}
                className="block truncate text-[10px] text-cyan-300/50 hover:text-cyan-200"
              >
                {inv.name}
              </NavLink>
            ))}
          </SidebarSection>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="shrink-0 flex items-center justify-center gap-1.5 border-t border-white/5 py-2.5
                   text-[9px] uppercase tracking-widest text-cyan-400/40 hover:text-cyan-300 transition-colors"
      >
        {collapsed ? "»" : "« Collapse"}
      </button>
    </aside>
  );
}

function SidebarSection({
  title,
  emptyLabel,
  count,
  children,
}: {
  title: string;
  emptyLabel: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[8px] font-semibold uppercase tracking-widest text-cyan-400/40 mb-1">
        {title} {count > 0 && <span className="text-cyan-400/25">({count})</span>}
      </div>
      {count === 0 ? (
        <div className="text-[9px] text-cyan-500/25 italic">{emptyLabel}</div>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  );
}
