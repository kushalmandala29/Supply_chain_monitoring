import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import AlertsCenterView from "./views/AlertsCenterView";
import CommandCenterView from "./views/CommandCenterView";
import IntelligenceFeedView from "./views/IntelligenceFeedView";
import InvestigationsView from "./views/InvestigationsView";
import KpiDashboardView from "./views/KpiDashboardView";
import LiveMapView from "./views/LiveMapView";
import SettingsView from "./views/SettingsView";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/command-center" replace />} />
        <Route path="/command-center" element={<CommandCenterView />} />
        <Route path="/map" element={<LiveMapView />} />
        <Route path="/intelligence" element={<IntelligenceFeedView />} />
        <Route path="/kpi" element={<KpiDashboardView />} />
        <Route path="/investigations" element={<InvestigationsView />} />
        <Route path="/alerts" element={<AlertsCenterView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/command-center" replace />} />
      </Route>
    </Routes>
  );
}
