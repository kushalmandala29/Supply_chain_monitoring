interface FlowLinkProps {
  path: string;
  width: number;
  color?: string;
}

/**
 * Flow link with animated gradient band.
 */
export function FlowLink({ path, width, color = "#3b82f6" }: FlowLinkProps) {
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={Math.max(1, width)}
      opacity={0.6}
      className="flow-link"
    />
  );
}
