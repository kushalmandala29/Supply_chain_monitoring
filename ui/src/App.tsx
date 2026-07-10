import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { SankeyFlow } from "./components/twin/SankeyFlow";
import { ParameterSliders } from "./components/war-room/ParameterSliders";
import { ScenarioPanel } from "./components/war-room/ScenarioPanel";
import { AgentTraceOverlay } from "./components/trace/AgentTraceOverlay";
import { WaterfallChart } from "./components/finance/WaterfallChart";
import { ImpactCards } from "./components/finance/ImpactCards";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAgentStream } from "./hooks/useAgentStream";
import { useDynamicLayout } from "./hooks/useDynamicLayout";

/**
 * Root Application Component
 * Implements the Dynamic Composable Viewport pattern.
 * The Supervisor Agent dispatches JSON layout specs that determine
 * which components are mounted in the canvas at runtime.
 */
function App() {
  const [activeView, setActiveView] = useState<string>("twin");
  const { isConnected, sendMessage } = useWebSocket();
  const { traces, debateHistory } = useAgentStream();
  const { layoutSpec } = useDynamicLayout();

  return (
    <AppShell
      activeView={activeView}
      onViewChange={setActiveView}
      isConnected={isConnected}
    >
      {/* Primary Digital Twin Canvas */}
      {activeView === "twin" && (
        <div className="canvas-grid">
          <div className="canvas-primary">
            <SankeyFlow layoutSpec={layoutSpec} />
          </div>
          <div className="canvas-sidebar">
            <AgentTraceOverlay traces={traces} debateHistory={debateHistory} />
          </div>
        </div>
      )}

      {/* War Room — Scenario Simulation */}
      {activeView === "warroom" && (
        <div className="canvas-grid">
          <div className="canvas-primary">
            <ScenarioPanel onSubmit={(scenario) => sendMessage({
              type: "scenario",
              payload: scenario,
            })} />
            <SankeyFlow layoutSpec={layoutSpec} />
          </div>
          <div className="canvas-sidebar">
            <ParameterSliders onUpdate={(params) => sendMessage({
              type: "scenario",
              payload: { parameters: params },
            })} />
          </div>
        </div>
      )}

      {/* Financial Impact Analysis */}
      {activeView === "finance" && (
        <div className="canvas-grid">
          <div className="canvas-primary">
            <WaterfallChart />
            <ImpactCards />
          </div>
          <div className="canvas-sidebar">
            <AgentTraceOverlay traces={traces} debateHistory={debateHistory} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default App;
