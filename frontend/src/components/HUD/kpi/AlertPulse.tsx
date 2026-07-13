import { KpiSeverity } from "../../../store/useStore";

const COLOR: Record<Exclude<KpiSeverity, "green">, string> = {
  amber: "bg-amber-400",
  red: "bg-red-400",
};

/** Small pulsing dot reused wherever a KPI's severity needs a glance-able
 * indicator (KpiPanel rows, KpiRing centers). Renders nothing for "green"
 * -- a healthy KPI shouldn't compete for attention. */
export default function AlertPulse({ severity, size = "sm" }: { severity: KpiSeverity; size?: "sm" | "md" }) {
  if (severity === "green") return null;
  const dim = size === "md" ? "w-2.5 h-2.5" : "w-1.5 h-1.5";
  return <span className={`inline-block rounded-full ${dim} ${COLOR[severity]} pulse-dot`} />;
}
