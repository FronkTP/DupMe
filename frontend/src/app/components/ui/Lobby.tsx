"use client";

import { useId, useState, useRef, useEffect } from "react";
import { Settings, ChevronDown } from "lucide-react";
import { gsap } from "gsap";

type RoomListItem = { id: string; name: string; capacity: number; count: number };

type LobbyProps = {
  rooms: RoomListItem[];
  onCreate: (name: string, capacity: number, mode: 'classic' | 'perfect' | 'reverse' | 'practice' | 'ai') => void;
  onJoin: (id: string) => void;
};

export default function Lobby({ rooms, onCreate, onJoin }: LobbyProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'classic' | 'perfect' | 'reverse' | 'practice' | 'ai'>('classic');
  const nameId = useId();
  const capId = useId();
  const configRef = useRef<HTMLDivElement>(null);
  // const modeId = useId();

  // Refs for mode buttons
  const classicBtnRef = useRef<HTMLButtonElement>(null);
  const perfectBtnRef = useRef<HTMLButtonElement>(null);
  const reverseBtnRef = useRef<HTMLButtonElement>(null);
  const practiceBtnRef = useRef<HTMLButtonElement>(null);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  // Animate config panel with GSAP
  useEffect(() => {
    if (!configRef.current) return;

    if (showConfig) {
      // Set initial state (hidden)
      gsap.set(configRef.current, {
        height: 0,
        opacity: 0,
        overflow: 'hidden',
      });
      // Animate to visible
      gsap.to(configRef.current, {
        height: 'auto',
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
      });
    } else {
      // Animate to hidden
      gsap.to(configRef.current, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      });
    }
  }, [showConfig]);

  // Animate mode button selection with GSAP
  useEffect(() => {
    const buttons = [
      { ref: classicBtnRef, mode: 'classic' },
      { ref: perfectBtnRef, mode: 'perfect' },
      { ref: reverseBtnRef, mode: 'reverse' },
      { ref: practiceBtnRef, mode: 'practice' },
      { ref: aiBtnRef, mode: 'ai' },
    ];

    buttons.forEach(({ ref, mode }) => {
      if (!ref.current) return;

      if (mode === selectedMode) {
        // Animate to selected state
        gsap.to(ref.current, {
          backgroundColor: '#e5e5e5', // neutral-200
          color: '#171717', // neutral-900
          duration: 0.3,
          ease: 'power2.out',
        });
      } else {
        // Animate to unselected state
        gsap.to(ref.current, {
          backgroundColor: 'transparent',
          color: 'inherit',
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    });
  }, [selectedMode]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-theme bg-surface p-4">
        <div className="text-sm text-muted mb-2">Create Room</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input id={nameId} placeholder="Room Name" className="flex-1 px-3 py-2 rounded-lg themed-input outline-none focus:ring-2 focus:ring-neutral-300" />
          <button
            type="button"
            onClick={() => setShowConfig((prev) => !prev)}
            className="p-2 rounded-lg border border-theme hover:bg-surface-muted transition flex items-center justify-center"
          >
            <Settings size={18} />
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 hover:bg-gray-400 transition"
            onClick={() => {
              const nameEl = document.getElementById(nameId) as HTMLInputElement | null;
              const capEl = document.getElementById(capId) as HTMLSelectElement | null;
              const name = nameEl?.value || "";
              const cap = Number(capEl?.value || 2);
              onCreate(name, cap, selectedMode);
            }}
          >Create</button>
        </div>
        <div ref={configRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
          <div className="mt-4">
            <div className="text-muted text-sm mb-2">Configure Options</div>
          <div className="flex items-center justify-between w-full mb-4">
            <label className="text-muted text-sm">Capacity</label>
            <div className="relative w-15">
              <select
                id={capId}
                defaultValue={2}
                className="w-full focus:ring-1 focus:ring-neutral-300 px-3 py-2 pr-9 rounded-lg control border appearance-none"
                aria-label="Capacity"
              >
                {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between w-full">
            <label className="text-muted text-sm">Game mode</label>
            <div className="flex">
              <button
                ref={classicBtnRef}
                type="button"
                onClick={() => setSelectedMode('classic')}
                className="px-3 py-1.5 rounded-l-lg text-sm border border-theme transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                Classic
              </button>
              <button
                ref={perfectBtnRef}
                type="button"
                onClick={() => setSelectedMode('perfect')}
                className="px-3 py-1.5 text-sm border-t border-b border-theme transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                Perfect pitch
              </button>
              <button
                ref={reverseBtnRef}
                type="button"
                onClick={() => setSelectedMode('reverse')}
                className="px-3 py-1.5 text-sm border-t border-b border-theme transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                Reverse
              </button>
              <button
                ref={practiceBtnRef}
                type="button"
                onClick={() => setSelectedMode('practice')}
                className="px-3 py-1.5 text-sm border-t border-b border-theme transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                Practice
              </button>
              <button
                ref={aiBtnRef}
                type="button"
                onClick={() => setSelectedMode('ai')}
                className="px-3 py-1.5 rounded-r-lg text-sm border border-theme transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                AI practice
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-theme bg-surface">
        <div className="p-4 text-muted font-medium">Available Rooms</div>
        <ul className="p-2">
          {rooms.length === 0 && (
            <li className="p-3 text-sm text-muted">
              No rooms yet. Create one!
              <div className="mt-2 text-xs text-muted">
                Tip: Play a full round to appear on the leaderboard. Scores are stored per device.
              </div>
            </li>
          )}
          {rooms.map((r) => (
            <li key={r.id} className="p-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-muted">{r.count}/{r.capacity}</span>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-neutral-200 text-gray-900 hover:bg-gray-400 transition" onClick={() => onJoin(r.id)}>Join</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


