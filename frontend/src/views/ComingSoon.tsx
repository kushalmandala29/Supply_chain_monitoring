import HudPanel from "../components/HUD/HudPanel";

export default function ComingSoon({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <HudPanel title={title} subtitle={phase} accentColor="cyan" className="max-w-md">
        <p className="text-[12px] text-cyan-300/50 leading-relaxed">{description}</p>
      </HudPanel>
    </div>
  );
}
