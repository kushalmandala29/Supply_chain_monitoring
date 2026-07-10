import { useState, useCallback } from "react";
import type { LayoutSpec } from "../types/layout";

/**
 * Hook for interpreting dynamic layout specs from the Supervisor Agent.
 * Parses incoming JSON layout payloads and determines which components to mount.
 */
export function useDynamicLayout() {
  const [layoutSpec, setLayoutSpec] = useState<LayoutSpec | null>(null);

  const updateLayout = useCallback((spec: LayoutSpec) => {
    setLayoutSpec(spec);
  }, []);

  const getActiveComponents = useCallback((): string[] => {
    if (!layoutSpec) return [];
    return layoutSpec.components.map((c) => c.type);
  }, [layoutSpec]);

  return { layoutSpec, updateLayout, getActiveComponents };
}
