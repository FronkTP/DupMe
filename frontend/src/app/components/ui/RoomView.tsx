"use client";

import { Timer } from "lucide-react";
import Piano from "../Piano";

type Player = { id: string; nickname: string | null; score: number; attempts?: number; rejected?: number };

type RoomSnapshot = { id: string; name: string; capacity: number; players: Player[]; ready?: string[] };

type RoomViewProps = {
  room: RoomSnapshot;
  phase: 'idle'|'demo'|'create'|'playback'|'replicate'|'ended'|'game_over'|null;
  banner: string;
  canPlay: boolean;
  replicatePattern: string[];
  results: Array<{ id: string; nickname: string | null; score: number }> | null;
  isCreator: boolean;
  highlightIndex: number;
  remainingSeconds: number | null;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onKeyClick: (note: string) => void;
};

export default function RoomView({ room, phase, banner, canPlay, replicatePattern, results, isCreator, highlightIndex, remainingSeconds, onLeave, onReady, onKeyClick }: RoomViewProps) {
  const labelFor = (n: string) => {
    const u = (n || '').toUpperCase();
    const octave = '4';
    return ['C','D','E','F','G','A','B'].includes(u) ? `${u}${octave}` : u;
  };
  return (
    <div className="space-y-4 bg-[#272725] p-4 rounded-2xl text-gray-200">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Room {room.name} ({room.id}) {room.players.length}/{room.capacity}</div>
        <button onClick={onLeave} className="px-3 py-1.5 bg-red-800 text-white rounded-lg">Leave</button>
      </div>

      {banner && (
        <div className="p-2 rounded-lg bg-[#272725] text-gray-200 flex items-center justify-between">
          <span>{banner}</span>
          {(phase === 'demo' || phase === 'create' || phase === 'playback' || phase === 'replicate') && typeof remainingSeconds === 'number' && (
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-200">
              <span aria-hidden><Timer size={16} /></span>
              <span>{phase === 'demo' ? 'Demo' : phase === 'create' ? 'Create' : phase === 'playback' ? 'Playback' : 'Replicate'}: {remainingSeconds}s</span>
            </span>
          )}
        </div>
      )}

      <ul className="text-sm text-gray-200 space-y-1">
        {room.players.map((p) => (
          <li key={p.id} className="flex justify-between">
            <span>{p.nickname || p.id.slice(0,4)}</span>
            <span className="flex gap-3 items-center">
              <span className="text-gray-200">score: {p.score}%</span>
              {typeof p.attempts === 'number' && (
                <span className="text-gray-200">attempts: {p.attempts}</span>
              )}
              {typeof p.rejected === 'number' && p.rejected > 0 && (
                <span className="text-gray-200">ignored: {p.rejected}</span>
              )}
              {room.ready?.includes(p.id) && <span className="text-green-500">ready</span>}
            </span>
          </li>
        ))}
      </ul>

      {(phase === null || phase === 'idle' || phase === 'game_over') && (
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-green-900 text-white rounded-lg" onClick={() => onReady(true)}>Ready</button>
          <button className="px-3 py-2 bg-gray-400 text-neutral-900 hover:bg-neutral-200 transition rounded-lg" onClick={() => onReady(false)}>Unready</button>
        </div>
      )}

      {(phase === 'demo' || phase === 'create' || phase === 'replicate' || phase === 'ended') && (
        <div className="mt-2">
          <Piano onKeyClick={onKeyClick} disabled={!canPlay} highlightIndex={highlightIndex} />
        </div>
      )}

      {phase === 'playback' && (
		<div className="mt-2">
		  <Piano onKeyClick={onKeyClick} disabled={true} highlightIndex={-1} />
		</div>
	  )}

      {phase === 'replicate' && isCreator && (
        <div className="mt-2 p-3 bg-[#272725] rounded-lg">
          <p className="text-sm text-gray-200">Pattern:</p>
          <p className="text-lg tracking-widest">{(replicatePattern.length ? replicatePattern.map(labelFor) : []).join(' ') || '...'}</p>
        </div>
      )}

      {phase === 'create' && isCreator && (
        <div className="mt-2 p-3 bg-[#272725] rounded-lg text-sm text-gray-200">
          <span>Notes added: {replicatePattern.length} / 10</span>
          <span className="ml-3 text-gray-400">Extra clicks beyond 10 will be ignored</span>
        </div>
      )}

      {phase === 'ended' && results && (
        <div className="mt-2 p-4 bg-[#272725] rounded-lg">
          <p className="font-semibold mb-2">Round results</p>
          <ul className="space-y-1">
            {results.sort((a,b)=>b.score-a.score).map((r, idx, arr) => {
              const top = arr[0]?.score ?? 0;
              const isWinner = r.score === top && top > 0;
              return (
                <li key={r.id} className="flex justify-between">
                  <span>
                    {r.nickname || r.id.slice(0,4)}
                    {isWinner && <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500 text-black rounded">Winner</span>}
                  </span>
                  <span className="text-gray-200">{r.score}%</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-sm text-gray-200">Click Ready to start another round.</div>
        </div>
      )}

      {phase === 'game_over' && results && (
        <div className="mt-2 p-4 bg-[#272725] rounded-lg">
          <p className="font-semibold mb-2">Game winners</p>
          <ul className="space-y-1">
            {results.sort((a,b)=>b.score-a.score).map((r, idx, arr) => {
              const top = arr[0]?.score ?? 0;
              const isWinner = r.score === top && top > 0;
              return (
                <li key={r.id} className="flex justify-between">
                  <span>
                    {r.nickname || r.id.slice(0,4)}
                    {isWinner && <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500 text-black rounded">Winner</span>}
                  </span>
                  <span className="text-gray-200">{r.score}%</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-sm text-gray-200">Click Ready to start a new game.</div>
        </div>
      )}
    </div>
  );
}


