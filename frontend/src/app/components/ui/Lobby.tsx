"use client";

import { useId } from "react";

type RoomListItem = { id: string; name: string; capacity: number; count: number };

type LobbyProps = {
  rooms: RoomListItem[];
  onCreate: (name: string, capacity: number) => void;
  onJoin: (id: string) => void;
};

export default function Lobby({ rooms, onCreate, onJoin }: LobbyProps) {
  const nameId = useId();
  const capId = useId();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-[#272725] p-4">
        <div className="text-sm text-gray-200 mb-2">Create room</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input id={nameId} placeholder="Room name" className="flex-1 px-3 py-2 rounded-lg bg-[#272725] text-white outline-none focus:ring-2 focus:ring-neutral-300" />
          <input id={capId} type="number" min={2} max={12} placeholder="Cap" className="w-28 px-3 py-2 rounded-lg bg-[#272725] text-white outline-none focus:ring-2 focus:ring-neutral-300" />
          <button
            className="px-4 py-2 rounded-lg bg-gray-400 text-neutral-900 hover:bg-neutral-200 transition"
            onClick={() => {
              const nameEl = document.getElementById(nameId) as HTMLInputElement | null;
              const capEl = document.getElementById(capId) as HTMLInputElement | null;
              const name = nameEl?.value || "";
              const cap = Number(capEl?.value || 2);
              onCreate(name, cap);
            }}
          >Create</button>
        </div>
      </div>

      <div className="rounded-xl border bg-[#272725]">
        <div className="p-4 text-gray-200 font-medium">Available rooms</div>
        <ul className="p-2">
          {rooms.length === 0 && (
            <li className="p-3 text-sm text-gray-200">No rooms yet. Create one!</li>
          )}
          {rooms.map((r) => (
            <li key={r.id} className="p-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-gray-200">{r.name}</span>
                <span className="text-gray-200 ml-2">{r.count}/{r.capacity}</span>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-gray-400 text-gray-900 hover:bg-neutral-200 transition" onClick={() => onJoin(r.id)}>Join</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


