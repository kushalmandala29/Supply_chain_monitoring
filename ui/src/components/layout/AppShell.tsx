import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppShellProps {
  children: ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
  isConnected: boolean;
}

/**
 * Main application shell with sidebar navigation and header.
 */
export function AppShell({ children, activeView, onViewChange, isConnected }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onViewChange={onViewChange} />
      <div className="app-main">
        <Header isConnected={isConnected} activeView={activeView} />
        <div className="app-content">
          {children}
        </div>
      </div>
    </div>
  );
}
