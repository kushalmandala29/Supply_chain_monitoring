interface StatusBadgeProps {
  status: "success" | "warning" | "danger" | "info";
  label: string;
}

/**
 * Agent status indicator badge with semantic coloring.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${status}`}>
      {label}
    </span>
  );
}
