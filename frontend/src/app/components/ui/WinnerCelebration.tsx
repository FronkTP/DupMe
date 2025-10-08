"use client";

import { useEffect } from "react";

type Winner = { id: string; nickname: string | null; score: number };

type WinnerCelebrationProps = {
  open: boolean;
  winners: Winner[];
  onDismiss: () => void;
};

export default function WinnerCelebration({ open, winners, onDismiss }: WinnerCelebrationProps) {
  // Close on Escape for accessibility; no-op when closed
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const displayNames = winners.map((w) => (w.nickname && w.nickname.trim() ? w.nickname : w.id.slice(0, 4)));
  const title = displayNames.length > 1 ? displayNames.slice(0, 2).join(" & ") : (displayNames[0] || "");

  // Lightweight, minimal confetti: a few pieces falling once, respecting reduced motion
  const pieces = Array.from({ length: 18 }, (_, i) => {
    const left = 5 + (i * (90 / 18));
    const delay = (i % 6) * 100;
    const duration = 900 + (i % 5) * 150;
    const size = 6 + (i % 3) * 2;
    const colors = ["#fbbf24", "#facc15", "#a78bfa", "#60a5fa", "#34d399", "#f472b6"]; // soft premium tones
    const color = colors[i % colors.length];
    const rotate = (i % 2 === 0 ? 1 : -1) * (20 + (i % 7) * 8);
    return { left, delay, duration, size, color, rotate };
  });

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Winners announcement"
      onClick={onDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl" />

      {/* Soft radial highlight (reuses app aesthetic) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(900px 280px at 50% -10%, rgba(255,255,255,0.12), transparent)" }}
      />

      {/* Confetti layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {pieces.map((p, idx) => (
          <span
            key={idx}
            aria-hidden
            className="block absolute rounded-sm confetti-piece"
            style={{
              left: `${p.left}%`,
              top: -16,
              width: p.size,
              height: p.size + 4,
              background: p.color,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              transform: `rotate(${p.rotate}deg)`
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative h-full w-full grid place-items-center p-4">
        <div
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.35)] p-10 text-center text-gray-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-6xl font-fleur-de-leah tracking-wider text-yellow-300/90">Champion</div>
          <div className="mt-2 text-3xl font-ancizar-sans sm:text-4xl text-gray-50">
            {title}
          </div>
          {winners[0] && (
            <div className="mt-2 text-sm font-ancizar-sans text-gray-300">Score: {winners[0].score}%</div>
          )}
          <button
            className="mt-5 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-neutral-200 text-neutral-900 hover:bg-gray-400 transition"
            onClick={onDismiss}
          >
            Close
          </button>
        </div>
      </div>

      {/* Minimal component-scoped styles for confetti */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10%) rotate(0deg); opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(240deg); opacity: 0; }
        }
        .confetti-piece { animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: forwards; }
        @media (prefers-reduced-motion: reduce) {
          .confetti-piece { animation: none; }
        }
      `}</style>
    </div>
  );
}


