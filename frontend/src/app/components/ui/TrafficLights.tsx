export default function TrafficLights() {

  return (
    <div className="flex items-center gap-2" aria-label="window-controls">
      <span className={`size-3 rounded-full border border-theme bg-[#ff5f57]`} />
      <span className={`size-3 rounded-full border border-theme bg-[#ffbd2e]`} />
      <span className={`size-3 rounded-full border border-theme bg-[#28c840]`} />
    </div>
  );
}


