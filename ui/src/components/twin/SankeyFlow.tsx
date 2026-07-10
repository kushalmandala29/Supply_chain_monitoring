import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { LayoutSpec } from "../../types/layout";

interface SankeyFlowProps {
  layoutSpec: LayoutSpec | null;
}

// Demo supply chain topology data
const DEMO_NODES = [
  { name: "Raw Materials" },
  { name: "Port Shanghai" },
  { name: "Port Rotterdam" },
  { name: "Port Singapore" },
  { name: "Malacca Strait" },
  { name: "Suez Canal" },
  { name: "Factory EU" },
  { name: "Factory US" },
  { name: "Distribution" },
];

const DEMO_LINKS = [
  { source: 0, target: 1, value: 40 },
  { source: 0, target: 3, value: 25 },
  { source: 1, target: 4, value: 40 },
  { source: 3, target: 4, value: 25 },
  { source: 4, target: 5, value: 35 },
  { source: 4, target: 2, value: 30 },
  { source: 5, target: 2, value: 35 },
  { source: 2, target: 6, value: 40 },
  { source: 2, target: 7, value: 25 },
  { source: 6, target: 8, value: 40 },
  { source: 7, target: 8, value: 25 },
];

/**
 * D3.js Sankey diagram showing supply chain flow topology.
 * Material volumes correspond to flow band dimensions.
 * Bottlenecks constrict link lines dynamically.
 */
export function SankeyFlow({ layoutSpec: _layoutSpec }: SankeyFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(400, container.clientHeight - 60);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("width", width).attr("height", height);

    const sankeyGenerator = d3Sankey()
      .nodeWidth(20)
      .nodePadding(16)
      .extent([[40, 20], [width - 40, height - 20]]);

    const { nodes, links } = sankeyGenerator({
      nodes: DEMO_NODES.map((d) => ({ ...d })),
      links: DEMO_LINKS.map((d) => ({ ...d })),
    });

    // Gradient definitions
    const defs = svg.append("defs");
    links.forEach((_link, i) => {
      const gradient = defs.append("linearGradient")
        .attr("id", `link-gradient-${i}`)
        .attr("gradientUnits", "userSpaceOnUse");

      gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.5);
      gradient.append("stop").attr("offset", "100%").attr("stop-color", "#a855f7").attr("stop-opacity", 0.5);
    });

    // Draw links
    svg.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", (_d, i) => `url(#link-gradient-${i})`)
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .attr("opacity", 0.7)
      .on("mouseover", function () {
        d3.select(this).attr("opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.7);
      });

    // Draw nodes
    svg.append("g")
      .selectAll("rect")
      .data(nodes)
      .join("rect")
      .attr("x", (d: any) => d.x0)
      .attr("y", (d: any) => d.y0)
      .attr("width", (d: any) => d.x1 - d.x0)
      .attr("height", (d: any) => Math.max(1, d.y1 - d.y0))
      .attr("rx", 4)
      .attr("fill", "#60a5fa")
      .attr("opacity", 0.9);

    // Node labels
    svg.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("x", (d: any) => (d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8))
      .attr("y", (d: any) => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: any) => (d.x0 < width / 2 ? "start" : "end"))
      .attr("fill", "#94a3b8")
      .attr("font-size", "0.75rem")
      .attr("font-family", "Inter, sans-serif")
      .text((d: any) => d.name);
  }, []);

  return (
    <div className="glass-card animate-fade-in" ref={containerRef} style={{ minHeight: 460 }}>
      <div className="section-header">
        <span className="section-icon">🌐</span>
        <h2>Supply Chain Flow Topology</h2>
      </div>
      <svg ref={svgRef} style={{ width: "100%", overflow: "visible" }} />
    </div>
  );
}
