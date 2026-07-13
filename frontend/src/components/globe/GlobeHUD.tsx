import GlobeScene, { RESET_VIEW_EVENT } from "./GlobeScene";

/** Public entry point for the Jarvis 3D globe -- what App.tsx mounts in
 * place of the old <WorldMap/>. GlobeScene owns the Three.js/globe.gl
 * internals; this component is the composition boundary plus any
 * globe-specific chrome (the orbit hint + reset-view control below). */
export default function GlobeHUD() {
  return (
    <>
      <GlobeScene />
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="pointer-events-auto flex items-center gap-2 glass rounded-full px-3 py-1 border border-cyan-400/10">
          <span className="text-[9px] text-cyan-300/40 tracking-widest uppercase">
            Drag to orbit &middot; Scroll to zoom
          </span>
          <span className="w-px h-3 bg-cyan-400/15" />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(RESET_VIEW_EVENT))}
            className="text-[9px] text-cyan-300/60 tracking-widest uppercase hover:text-cyan-200 transition-colors"
          >
            Reset view
          </button>
        </div>
      </div>
    </>
  );
}
