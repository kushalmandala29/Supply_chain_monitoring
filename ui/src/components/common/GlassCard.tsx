import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable glassmorphism card component.
 */
export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div className={`glass-card ${className}`}>
      {children}
    </div>
  );
}
