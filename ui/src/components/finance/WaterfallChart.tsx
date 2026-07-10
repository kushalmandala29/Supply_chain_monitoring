import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useTelemetryStore } from "../../stores/telemetryStore";

/**
 * D3.js Financial Impact Waterfall Chart.
 * Visualizes sequential cost breakdowns from baseline revenue to net impact.
 */
export function WaterfallChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const financialData = useTelemetryStore((s) => s.financialImpact);

  const demoData = financialData?.waterfall_breakdown || [
    { label: "Baseline Revenue", value: 1200000, type: "baseline" },
    { label: "Transit Delay", value: -180000, type: "decrease" },
    { label: "Freight Premium", value: -95000, type: "decrease" },
    { label: "Carrying Charges", value: -42000, type: "decrease" },
    { label: "Insurance Surge", value: -28000, type: "decrease" },
    { label: "Net Revenue", value: 855000, type: "total" },
  ];

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 320;
    const margin = { top: 20, right: 20, bottom: 60, left: 80 };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3.scaleBand()
      .domain(demoData.map((d) => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.3);

    const maxVal = Math.max(...demoData.map((d) => Math.abs(d.value)));
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.2])
      .range([height - margin.bottom, margin.top]);

    // Bars
    let cumulative = 0;
    demoData.forEach((d) => {
      const barHeight = Math.abs(d.value);
      let barY: number;

      if (d.type === "baseline" || d.type === "total") {
        barY = y(d.value);
        cumulative = d.value;
      } else {
        barY = y(cumulative);
        cumulative += d.value;
      }

      const color = d.type === "decrease" ? "#ef4444" : d.type === "total" ? "#a855f7" : "#3b82f6";

      svg.append("rect")
        .attr("x", x(d.label)!)
        .attr("y", d.type === "decrease" ? barY : y(barHeight))
        .attr("width", x.bandwidth())
        .attr("height", y(0) - y(barHeight))
        .attr("rx", 4)
        .attr("fill", color)
        .attr("opacity", 0.85);

      // Value labels
      svg.append("text")
        .attr("x", x(d.label)! + x.bandwidth() / 2)
        .attr("y", (d.type === "decrease" ? barY : y(barHeight)) - 6)
        .attr("text-anchor", "middle")
        .attr("fill", "#94a3b8")
        .attr("font-size", "0.7rem")
        .attr("font-family", "JetBrains Mono, monospace")
        .text(d.value >= 0 ? `$${(d.value / 1000).toFixed(0)}K` : `-$${(Math.abs(d.value) / 1000).toFixed(0)}K`);
    });

    // X-axis labels
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .selectAll("text")
      .data(demoData)
      .join("text")
      .attr("x", (d) => x(d.label)! + x.bandwidth() / 2)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "0.65rem")
      .text((d) => d.label);
  }, [demoData]);

  return (
    <div className="glass-card animate-fade-in" id="waterfall-chart">
      <div className="section-header">
        <span className="section-icon">📊</span>
        <h2>Financial Impact Waterfall</h2>
      </div>
      <svg ref={svgRef} style={{ width: "100%", maxHeight: 360 }} />
    </div>
  );
}
