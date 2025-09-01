"use client";

// An array representing the notes on our piano
const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export default function Piano({ onKeyClick, disabled } : { onKeyClick: (note: string) => void, disabled?: boolean }) {
  
  const handleKeyClick = (note: string) => {
    if (disabled) return;
    // This function will now call the prop passed down from the parent page.
    if (onKeyClick) {
      onKeyClick(note);
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
        style={{ background: 'radial-gradient(900px 280px at 50% -10%, rgba(255,255,255,0.12), transparent)' }} />
      <div className="relative flex justify-center gap-2 sm:gap-3 select-none">
        {notes.map((note) => (
          <button
            key={note}
            type="button"
            aria-label={`Play note ${note}`}
            disabled={!!disabled}
            onClick={() => handleKeyClick(note)}
            className={`group relative flex items-end justify-center pb-3 h-44 sm:h-56 w-12 sm:w-16 rounded-xl border transition-all duration-150 ease-out
              ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'}
              bg-gradient-to-b from-white to-neutral-100 border-neutral-200
              shadow-[inset_0_-8px_0_rgba(0,0,0,0.06),0_10px_24px_rgba(0,0,0,0.25)]`}
          >
            <span className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-neutral-300/80 group-active:bg-neutral-400/90" />
            <span className="text-lg sm:text-xl font-semibold text-neutral-700 group-hover:text-neutral-800">
              {note}
            </span>
            <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 40%)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

