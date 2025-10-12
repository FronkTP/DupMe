"use client";

import { useId, useState } from "react";
import { Settings } from "lucide-react";

type RoomListItem = { id: string; name: string; capacity: number; count: number };

type LobbyProps = {
  rooms: RoomListItem[];
  onCreate: (name: string, capacity: number) => void;
  onJoin: (id: string) => void;
};

export default function Lobby({ rooms, onCreate, onJoin }: LobbyProps) {
  const [showConfig, setShowConfig] = useState(false);
  const nameId = useId();
  const capId = useId();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-[#272725] p-4">
        <div className="text-sm text-gray-200 mb-2">Create Room</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input id={nameId} placeholder="Room Name" className="flex-1 px-3 py-2 rounded-lg bg-[#272725] text-white outline-none focus:ring-2 focus:ring-neutral-300 border border-white/10" />
          <button
            type="button"
            onClick={() => setShowConfig((prev) => !prev)}
            className="p-2 rounded-lg border border-white/10 hover:bg-[#3a3a38] transition flex items-center justify-center"
          >
            <Settings size={18} className="text-gray-300" />
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 hover:bg-gray-400 transition"
            onClick={() => {
              const nameEl = document.getElementById(nameId) as HTMLInputElement | null;
              const capEl = document.getElementById(capId) as HTMLSelectElement | null;
              const name = nameEl?.value || "";
              const cap = Number(capEl?.value || 2);
              onCreate(name, cap);
            }}
          >Create</button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-500 ${showConfig ? "max-h-40 mt-4" : "max-h-0"
            }`}
        >
          <div className="text-gray-200 text-sm mb-2">Configure Options</div>
          <div className="flex items-center justify-between w-full">
            <label className="text-gray-300 text-sm">Capacity</label>
            <div className="relative w-30">
              <select
                id={capId}
                defaultValue={2}
                className="w-full px-3 py-2 pr-8 rounded-lg bg-[#272725] text-white outline-none focus:ring-2 focus:ring-neutral-300 border border-white/10 appearance-none"
                aria-label="Capacity"
              >
                {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-300">
                ▾
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-[#272725]">
        <div className="p-4 text-gray-200 font-medium">Available Rooms</div>
        <ul className="p-2">
          {rooms.length === 0 && (
            <li className="p-3 text-sm text-gray-200">
              No rooms yet. Create one!
              <div className="mt-2 text-xs text-gray-300">
                Tip: Play a full round to appear on the leaderboard. Scores are stored per device.
              </div>
            </li>
          )}
          {rooms.map((r) => (
            <li key={r.id} className="p-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-gray-200">{r.name}</span>
                <span className="text-gray-200 ml-2">{r.count}/{r.capacity}</span>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-neutral-200 text-gray-900 hover:bg-gray-400 transition" onClick={() => onJoin(r.id)}>Join</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


