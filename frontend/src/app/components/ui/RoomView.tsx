"use client";

import { Timer } from "lucide-react";
import Piano from "../Piano";

type Player = { id: string; nickname: string | null; score: number; attempts?: number; rejected?: number };

type RoomSnapshot = { id: string; name: string; capacity: number; players: Player[]; ready?: string[]; mode?: 'classic'|'perfect'|'reverse'|'practice' };

type RoomViewProps = {
  room: RoomSnapshot;
  phase: 'idle'|'demo'|'create'|'playback'|'replicate'|'ended'|'game_over'|'practice'|null;
  banner: string;
  canPlay: boolean;
  replicatePattern: string[];
  results: Array<{ id: string; nickname: string | null; score: number }> | null;
  isCreator: boolean;
  highlightIndex: number;
  highlightColor: string | null;
  remainingSeconds: number | null;
  progress?: number;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onKeyClick: (note: string) => void;
  playersState?: Record<string, { id: string; nickname?: string | null; score: number; avatar?: string | null }>;
};

export default function RoomView({ room, phase, banner, canPlay, replicatePattern, results, isCreator, highlightIndex, highlightColor, remainingSeconds, progress, onLeave, onReady, onKeyClick, playersState }: RoomViewProps) {
  const labelFor = (n: string) => {
    const u = (n || '').toUpperCase();
    const octave = '4';
    return ['C','D','E','F','G','A','B'].includes(u) ? `${u}${octave}` : u;
  };
  const ProgressRing = ({ value }: { value: number }) => {
    const p = Math.max(0, Math.min(1, value));
    const C = 2 * Math.PI * 8; // circumference for r=8
    const hue = 140 - (136 * p); // 140≈green → 4≈red
    const stroke = `hsl(${hue} 80% 60%)`;
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" className="-ml-1">
        <circle cx="10" cy="10" r="8" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" />
        <circle cx="10" cy="10" r="8" stroke={stroke} strokeWidth="3" fill="none"
          strokeDasharray={`${p * C} ${C}`} strokeLinecap="round" transform="rotate(-90 10 10)"
          style={{ transition: 'stroke-dasharray 0.2s linear, stroke 0.2s linear' }} />
      </svg>
    );
  };
  return (
    <div className="space-y-4 bg-surface border border-theme p-4 rounded-2xl">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Room {room.name} ({room.id}){room.mode !== 'practice' && ` ${room.players.length}/${room.capacity}`}
        </div>
        <button onClick={onLeave} className="px-3 py-1.5 bg-red-800 text-white rounded-lg">Leave</button>
      </div>

      {banner && (
        <div className="p-2 rounded-lg bg-surface-muted border border-theme flex items-center justify-between">
          <span>{banner}</span>
          {(phase === 'demo' || phase === 'create' || phase === 'playback' || phase === 'replicate') && typeof remainingSeconds === 'number' && (
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg control border text-xs">
              <span className="flex items-center gap-1" aria-hidden>
                <ProgressRing value={typeof progress === 'number' ? progress : 0} />
                <Timer size={16} />
              </span>
              <span>{phase === 'demo' ? 'Demo' : phase === 'create' ? 'Create' : phase === 'playback' ? 'Playback' : 'Replicate'}: {remainingSeconds}s</span>
            </span>
          )}
        </div>
      )}

      <ul className="text-sm space-y-1">
        {room.players.map((p) => {
          const playerState = playersState?.[p.id];
          const avatar = playerState?.avatar ?? undefined;
          const avatarSrc = typeof avatar === 'string' && avatar
            ? (avatar.startsWith('data:') || avatar.startsWith('http') || avatar.startsWith('/') ? avatar : `/avatars/${avatar}`)
            : '';
          const displayName = playerState?.nickname ?? p.nickname ?? p.id.slice(0,4);
          return (
            <li key={p.id} className="flex justify-between">
              <span className="flex items-center gap-2">
                {/* avatar */}
                {avatarSrc ? (
                  <img src={avatarSrc} alt={playerState?.nickname || ''} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-neutral-200 grid place-items-center text-[10px] text-gray-800">{(displayName || p.id.slice(0,2)).slice(0,2).toUpperCase()}</div>
                )}
                <span>{displayName}</span>
              </span>
              <span className="flex gap-3 items-center">
                <span className="text-muted">Score: {p.score}%</span>
                {typeof p.attempts === 'number' && (
                  <span className="text-muted">Attempts: {p.attempts}</span>
                )}
                {typeof p.rejected === 'number' && p.rejected > 0 && (
                  <span className="text-muted">Ignored: {p.rejected}</span>
                )}
                {room.ready?.includes(p.id) && <span className="text-green-500">Ready</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {(phase === null || phase === 'idle' || phase === 'game_over') && room.mode !== 'practice' && (
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-green-900 text-white rounded-lg" onClick={() => onReady(true)}>Ready</button>
          <button className="px-3 py-2 bg-neutral-200 text-neutral-900 hover:bg-gray-400 transition rounded-lg" onClick={() => onReady(false)}>Unready</button>
        </div>
      )}

      {(phase === 'practice' || room.mode === 'practice') && (
        <div className="mt-2">
          <div className="mb-3 p-3 bg-blue-900/30 rounded-lg text-sm text-gray-200">
            Practice Mode: Click the keys to test sounds. No game logic, just practice!
          </div>
          <Piano onKeyClick={onKeyClick} disabled={false} highlightIndex={highlightIndex} highlightColor={highlightColor} />
        </div>
      )}

      {(phase === 'demo' || phase === 'create' || phase === 'replicate' || phase === 'ended') && room.mode !== 'practice' && (
        <div className="mt-2">
          <Piano onKeyClick={onKeyClick} disabled={!canPlay} highlightIndex={highlightIndex} highlightColor={highlightColor} />
        </div>
      )}

      {phase === 'playback' && (
		<div className="mt-2">
      <Piano onKeyClick={onKeyClick} disabled={true} highlightIndex={highlightIndex} highlightColor={highlightColor} />
		</div>
	  )}

      {phase === 'replicate' && isCreator && (
        <div className="mt-2 p-3 bg-surface-muted border border-theme rounded-lg">
          <p className="text-sm text-muted">Pattern:</p>
          <p className="text-lg tracking-widest">{(replicatePattern.length ? replicatePattern.map(labelFor) : []).join(' ') || '...'}</p>
        </div>
      )}

      {phase === 'create' && isCreator && (
        <div className="mt-2 p-3 bg-surface-muted border border-theme rounded-lg text-sm">
          <span>Notes added: {replicatePattern.length} / 10</span>
          <span className="ml-3 text-muted">Extra clicks beyond 10 will be ignored</span>
        </div>
      )}

      {phase === 'ended' && results && (
        <div className="mt-2 p-4 bg-surface-muted border border-theme rounded-lg">
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
                  <span className="text-muted">{r.score}%</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-sm text-muted">Click Ready to start another round.</div>
        </div>
      )}

      {phase === 'game_over' && results && (
        <div className="mt-2 p-4 bg-surface-muted border border-theme rounded-lg">
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
                  <span className="text-muted">{r.score}%</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-sm text-muted">Click Ready to start a new game.</div>
        </div>
      )}
    </div>
  );
}


