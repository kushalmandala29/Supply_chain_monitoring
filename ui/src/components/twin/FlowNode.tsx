interface FlowNodeProps {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

/**
 * Individual node in the Sankey flow topology.
 */
export function FlowNode({ name, x, y, width, height, color = "#60a5fa" }: FlowNodeProps) {
  return (
    <g className="flow-node">
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(1, height)}
        rx={4}
        fill={color}
        opacity={0.9}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        dy="0.35em"
        fill="#94a3b8"
        fontSize="0.75rem"
        fontFamily="Inter, sans-serif"
      >
        {name}
      </text>
    </g>
  );
}
