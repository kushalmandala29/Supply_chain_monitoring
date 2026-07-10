import { useState } from "react";

interface ParameterSlidersProps {
  onUpdate: (params: Record<string, number>) => void;
}

/**
 * War Room parameter sliders for synthetic scenario injection.
 * Transit Days Delay, Capacity %, and Freight Cost Premium.
 */
export function ParameterSliders({ onUpdate }: ParameterSlidersProps) {
  const [transitDelay, setTransitDelay] = useState(0);
  const [capacity, setCapacity] = useState(100);
  const [freightPremium, setFreightPremium] = useState(0);

  const handleUpdate = (key: string, value: number) => {
    const params: Record<string, number> = {
      transit_days_delay: transitDelay,
      operational_capacity_percent: capacity,
      freight_cost_premium_usd: freightPremium,
    };
    params[key] = value;
    onUpdate(params);
  };

  return (
    <div className="glass-card animate-slide-in" id="parameter-sliders">
      <div className="section-header">
        <span className="section-icon">🎛️</span>
        <h2>Parameter Sliders</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div className="slider-group">
          <div className="slider-label">
            <span>Transit Days Delay</span>
            <span className="slider-value">+{transitDelay} days</span>
          </div>
          <input
            id="slider-transit-delay"
            type="range"
            min={0}
            max={90}
            value={transitDelay}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTransitDelay(v);
              handleUpdate("transit_days_delay", v);
            }}
          />
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>Operational Capacity</span>
            <span className="slider-value">{capacity}%</span>
          </div>
          <input
            id="slider-capacity"
            type="range"
            min={0}
            max={100}
            value={capacity}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCapacity(v);
              handleUpdate("operational_capacity_percent", v);
            }}
          />
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>Freight Cost Premium</span>
            <span className="slider-value">${freightPremium.toLocaleString()}</span>
          </div>
          <input
            id="slider-freight-premium"
            type="range"
            min={0}
            max={50000}
            step={500}
            value={freightPremium}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFreightPremium(v);
              handleUpdate("freight_cost_premium_usd", v);
            }}
          />
        </div>
      </div>
    </div>
  );
}
