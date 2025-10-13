"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import OnlineUsers from './components/ui/OnlineUsers';
import Lobby from './components/ui/Lobby';
import RoomView from './components/ui/RoomView';
import TrafficLights from './components/ui/TrafficLights';
import WinnerCelebration from './components/ui/WinnerCelebration';
import { Music } from 'lucide-react';
import { ensureAudioContext, playSequence, playBeep, getSoundPack, setSoundPack } from './utils/audio';

// Socket endpoint for the backend
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:6996';

// Shapes we expect from the server
type Player = { id: string; score: number; nickname?: string | null; avatar?: string | null };
type GameState = {
  players: Record<string, Player>;
  currentPattern: string[];
  currentPlayerTurn: string | null;
  currentRound: number;
};
type RoomListItem = { id: string; name: string; capacity: number; count: number };
type RoomSnapshot = { id: string; name: string; capacity: number; players: Array<{ id: string; nickname: string | null; score: number; attempts?: number; rejected?: number }>; ready?: string[] };

export default function Home() {
  // Connection + identity
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [hasNick, setHasNick] = useState<boolean>(false);
  // Start with null to keep initial render deterministic; populate from localStorage after mount
  const [avatar, setAvatar] = useState<string | null>(null);
  const AVATAR_LIST = ['avatar1.png','avatar2.png','avatar3.jpg','avatar4.jpg','avatar5.jpg','avatar6.jpg','avatar7.png','avatar8.png','avatar9.png','avatar10.png','avatar11.jpg','avatar12.png','avatar13.jpg','avatar14.jpg'];
  const [avatarIndex, setAvatarIndex] = useState<number>(0);

  // Server state and room lobby
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [userId, setUserId] = useState<string>("");

  // In-room status
  const [roomBanner, setRoomBanner] = useState<string>("");
  const [phase, setPhase] = useState<'idle'|'demo'|'create'|'playback'|'replicate'|'ended'|'game_over'|null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [replicatePattern, setReplicatePattern] = useState<string[]>([]);
  const [results, setResults] = useState<Array<{ id: string; nickname: string | null; score: number }> | null>(null);
  const [winnerOverlayOpen, setWinnerOverlayOpen] = useState<boolean>(false);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [phaseStartAt, setPhaseStartAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [lastPlaybackEndsAt, setLastPlaybackEndsAt] = useState<number | null>(null);
  const lastDemoEndsAtRef = useRef<number | null>(null);
  const [demoSequence, setDemoSequence] = useState<string[]>([]);
  const [demoNoteMs, setDemoNoteMs] = useState<number>(500);
  const [demoGapMs, setDemoGapMs] = useState<number>(150);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [highlightColor, setHighlightColor] = useState<string | null>(null);
  const clickGlowTimeoutRef = useRef<number | null>(null);
  const replicateLocalIndexRef = useRef<number>(0);
  const [timerProgress, setTimerProgress] = useState<number>(0);
  type LeaderRow = { user_id: string; nickname: string; best: number };
  const [lbAll, setLbAll] = useState<LeaderRow[]>([]);
  const [lbWeek, setLbWeek] = useState<LeaderRow[]>([]);
  const [lbTab, setLbTab] = useState<'all'|'week'>('all');
  const [soundPack, setSoundPackState] = useState<string>(() => getSoundPack());


  useEffect(() => {
    // Open socket connection once
    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    // Wire up server events
    newSocket.on('connect', () => {
      console.log(`✅ Connected! My ID is ${newSocket.id}`);
      setMyId(newSocket.id ?? null);
      // Stable user id (localStorage)
      const key = 'dupme_uid';
      let uid = '';
      try { uid = localStorage.getItem(key) || ''; } catch {}
      if (!uid) {
        try {
          uid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
        } catch {
          uid = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
        }
        try { localStorage.setItem(key, uid); } catch {}
      }
      setUserId(uid);
      // restore avatar from localStorage if present (after mount)
      try { const av = localStorage.getItem('dupme_avatar'); if (av) setAvatar(av); } catch {}
    });

    newSocket.on('gameStateUpdate', (newState: GameState) => {
      console.log('Received gameStateUpdate:', newState);
      setGameState(newState);
    });

    newSocket.on('SERVER:ROOMS', (list: RoomListItem[]) => setRooms(list));
    newSocket.on('SERVER:ROOM', (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
    });
    newSocket.on('SERVER:JOINED_ROOM', () => setRoomBanner(""));
    newSocket.on('SERVER:LEFT_ROOM', () => { setRoom(null); setRoomBanner(""); setAudioReady(false); setLastPlaybackEndsAt(null); });
    type GameStartPayload = { roomId: string; creatorId?: string; phase?: 'create'; endsAt?: number; roundIndex?: number; totalRounds?: number };
    type PhasePayload = { roomId: string; phase?: 'demo'|'create'|'playback'|'replicate'|'ended'|'game_over'; creatorId?: string; endsAt?: number; pattern?: string[]; sequence?: string[]; noteMs?: number; gapMs?: number; results?: Array<{ id: string; nickname: string | null; score: number }>} ;
    newSocket.on('SERVER:GAME_START', (p: GameStartPayload) => {
      setRoomBanner(`Round ${((p?.roundIndex ?? 0) + 1)}/${p?.totalRounds ?? ''} • Create phase: start playing notes`);
      setPhase('create');
      setCreatorId(p?.creatorId ?? null);
      setReplicatePattern([]);
      setResults(null);
      setPhaseEndsAt(typeof p?.endsAt === 'number' ? p.endsAt : null);
      setPhaseStartAt(Date.now());
      setWinnerOverlayOpen(false);
    });
    newSocket.on('SERVER:PHASE', (p: PhasePayload) => {
      setPhase(p?.phase ?? null);
      setCreatorId(p?.creatorId ?? null);
      if (p?.phase === 'demo') {
        setRoomBanner('Sound demo: listen to each note');
        setDemoSequence(p?.sequence || ['C','D','E','F','G','A','B']);
        if (typeof p?.noteMs === 'number') setDemoNoteMs(p.noteMs);
        if (typeof p?.gapMs === 'number') setDemoGapMs(p.gapMs);
        setReplicatePattern([]);
        setResults(null);
      }
      if (p?.phase === 'playback') setRoomBanner('Listening: melody is playing');
      if (p?.phase === 'replicate') setRoomBanner('Replicate phase: match the pattern');
      if (p?.phase === 'ended') setRoomBanner('Round ended');
      if (p?.phase === 'playback') setReplicatePattern(p?.pattern || []);
      if (p?.phase === 'replicate') setReplicatePattern(p?.pattern || []);
      if (p?.phase === 'ended') { setReplicatePattern([]); if (p?.results) setResults(p.results); }
      setPhaseEndsAt(typeof p?.endsAt === 'number' ? p.endsAt : null);
      setPhaseStartAt(typeof p?.endsAt === 'number' ? Date.now() : null);
    });
    newSocket.on('SERVER:GAME_END', (payload: { roomId: string; results: Array<{ id: string; nickname: string | null; score: number }> }) => {
      setPhase('game_over');
      setResults(payload.results || []);
      setRoomBanner('Game over');
      setPhaseEndsAt(null);
      setPhaseStartAt(null);
      setWinnerOverlayOpen(true);
      // Refresh leaderboard on game end
      void fetchLeaderboard();
    });
    newSocket.on('SERVER:PATTERN', (payload: { roomId: string; pattern: string[] }) => {
      if (!payload?.pattern) return;
      // Keep the latest pattern; we will display it during replicate
      setReplicatePattern(payload.pattern);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setRoomBanner("");
      setPhaseEndsAt(null);
      setWinnerOverlayOpen(false);
    });


    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []); 

  // keep avatarIndex in sync when avatar changes (must be at top-level of component)
  useEffect(() => {
    if (!avatar) return;
    const idx = AVATAR_LIST.findIndex((a) => avatar.endsWith(a));
    setAvatarIndex(idx >= 0 ? idx : 0);
  }, [avatar]);

  // Countdown timer + progress derived from server-provided endsAt/startAt
  useEffect(() => {
    if (!phaseEndsAt || !(phase === 'demo' || phase === 'create' || phase === 'playback' || phase === 'replicate')) {
      setRemainingSeconds(null);
      setTimerProgress(0);
      return;
    }

    const update = () => {
      const msLeft = phaseEndsAt - Date.now();
      const secs = Math.max(0, Math.ceil(msLeft / 1000));
      setRemainingSeconds(secs);
      if (phaseStartAt && phaseEndsAt) {
        const total = Math.max(1, phaseEndsAt - phaseStartAt);
        const done = Math.max(0, Math.min(total, total - msLeft));
        setTimerProgress(Math.max(0, Math.min(1, done / total)));
      } else {
        setTimerProgress(0);
      }
    };

    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [phaseEndsAt, phase, phaseStartAt]);

  // Auto-play pattern during playback phase once per round
  useEffect(() => {
    if (phase !== 'playback') return;
    if (!audioReady) return;
    if (!phaseEndsAt) return;
    if (lastPlaybackEndsAt === phaseEndsAt) return;
    setLastPlaybackEndsAt(phaseEndsAt);
    const notes = (replicatePattern && replicatePattern.length > 0) ? replicatePattern : [];
    if (notes.length === 0) return;
    // Determine playback timing from last SERVER:PHASE payload (stored via demoNoteMs/gapMs if playback provided)
    playSequence(notes, { noteMs: demoNoteMs || 500, gapMs: demoGapMs || 10 });
  }, [phase, audioReady, phaseEndsAt, replicatePattern, lastPlaybackEndsAt, demoNoteMs, demoGapMs]);

  // Auto-play demo sequence and schedule highlights
  useEffect(() => {
    if (phase !== 'demo') { setHighlightIndex(-1); return; }
    if (!audioReady) return;
    if (!phaseEndsAt) return;
    if (lastDemoEndsAtRef.current === phaseEndsAt) return;
    lastDemoEndsAtRef.current = phaseEndsAt;
    const seq = demoSequence && demoSequence.length ? demoSequence : ['C','D','E','F','G','A','B'];
    playSequence(seq, { noteMs: demoNoteMs, gapMs: demoGapMs });
    // schedule highlighting using timeouts to ensure exact sequence
    const timeouts: number[] = [];
    for (let i = 0; i < seq.length; i++) {
      const id = window.setTimeout(() => { setHighlightIndex(i); setHighlightColor(null); }, i * (demoNoteMs + demoGapMs));
      timeouts.push(id);
    }
    const clearId = window.setTimeout(() => { setHighlightIndex(-1); setHighlightColor(null); }, seq.length * (demoNoteMs + demoGapMs));
    timeouts.push(clearId);
    return () => { timeouts.forEach((id) => window.clearTimeout(id)); };
  }, [phase, audioReady, phaseEndsAt, demoSequence, demoNoteMs, demoGapMs]);

  // Derived flags for UI enablement
  const isCreator = creatorId ? myId === creatorId : false;
  const canPlay = phase === 'create' ? isCreator : phase === 'replicate' ? !isCreator : false;


  // Send a note to the server; server decides how to route it
  const handlePianoKeyClick = useCallback((note: string) => {
    if (!socket) return;
    const idx = ['C','D','E','F','G','A','B'].indexOf((note || '').toUpperCase());
    if (!isCreator && phase === 'replicate') {
      const pattern = replicatePattern || [];
      const localIdx = replicateLocalIndexRef.current;
      if (localIdx < pattern.length) {
        const expected = (pattern[localIdx] || '').toUpperCase();
        const isCorrect = (note || '').toUpperCase() === expected;
        if (idx >= 0) {
          setHighlightIndex(idx);
          setHighlightColor(isCorrect ? '#22C55E' : '#EF4444');
          if (clickGlowTimeoutRef.current) window.clearTimeout(clickGlowTimeoutRef.current);
          clickGlowTimeoutRef.current = window.setTimeout(() => { setHighlightIndex(-1); setHighlightColor(null); }, 200);
        }
        if (audioReady) playBeep(isCorrect ? 880 : 220, 200, 0.9);
        replicateLocalIndexRef.current = localIdx + 1;
      }
    } else {
      if (idx >= 0) {
        setHighlightIndex(idx);
        setHighlightColor(null);
        if (clickGlowTimeoutRef.current) window.clearTimeout(clickGlowTimeoutRef.current);
        clickGlowTimeoutRef.current = window.setTimeout(() => { setHighlightIndex(-1); setHighlightColor(null); }, 200);
      }
      if (isCreator && phase === 'create' && audioReady) {
        playSequence([note], { noteMs: 250, gapMs: 0 });
      }
    }
    socket.emit('CLIENT:SUBMIT_NOTE', note);
  }, [socket, isCreator, phase, audioReady, replicatePattern]);

  // Save nickname once per connection
  const submitNickname = useCallback(async () => {
    if (!socket) return;
    const clean = nickname.trim();
    if (!clean) return;
    socket.emit('CLIENT:SET_NICKNAME', { nickname: clean, userId, avatar });
    try { if (avatar) localStorage.setItem('dupme_avatar', avatar); } catch {}
    setHasNick(true);
    await ensureAudio();
  }, [socket, nickname, userId, avatar]);

  // Lobby actions
  const createRoom = (name: string, capacity: number) => {
    if (!socket) return;
    socket.emit('ROOMS:CREATE', { name, capacity });
  };

  const joinRoom = (id: string) : void => {
    if (!socket) return;
    socket.emit('ROOMS:JOIN', id);
  };

  const leaveRoom = () : void => {
    if (!socket) return;
    socket.emit('ROOMS:LEAVE');
  };

  // Unlock audio on any clear gesture: submitting nickname or toggling ready
  const ensureAudio = async () => {
    const ok = await ensureAudioContext();
    if (ok) setAudioReady(true);
  };

  // Fetch leaderboard (all + week)
  const fetchLeaderboard = useCallback(async () => {
    try {
      const base = SOCKET_URL;
      const [ra, rw] = await Promise.all([
        fetch(`${base}/leaderboard?range=all`).then(r=>r.json()).catch(()=>[]),
        fetch(`${base}/leaderboard?range=week`).then(r=>r.json()).catch(()=>[]),
      ]);
      setLbAll(Array.isArray(ra) ? ra : []);
      setLbWeek(Array.isArray(rw) ? rw : []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { void fetchLeaderboard(); }, [fetchLeaderboard]);

  // Keyboard controls: map keys to notes (left-to-right)
  const KEY_TO_NOTE = useMemo(() => ({
    'a': 'C', 's': 'D', 'd': 'E', 'f': 'F', 'g': 'G', 'h': 'A', 'j': 'B',
  } as Record<string, string>), []);

  // Global keydown handler for Enter (nickname) and note keys (create/replicate)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      if (key === 'enter') {
        if (!hasNick) {
          e.preventDefault();
          submitNickname();
        }
        return;
      }
      if (!hasNick) return;
      if (!(phase === 'create' || phase === 'replicate')) return;
      if (!canPlay) return;
      const note = KEY_TO_NOTE[key];
      if (!note) return;
      e.preventDefault();
      handlePianoKeyClick(note);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasNick, phase, canPlay, nickname, submitNickname, handlePianoKeyClick, KEY_TO_NOTE]);

  // Compute top-score winners (cap to two) when results are present
  const topWinners = useMemo(() => {
    if (!results || results.length === 0) return [] as Array<{ id: string; nickname: string | null; score: number }>;
    const sorted = [...results].sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    return sorted.filter(r => r.score === topScore).slice(0, 2);
  }, [results]);

  return (
    <main className="min-h-screen p-3 w-full text-neutral-900 flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between shrink-0 text-gray-50">
        <div className="flex items-center gap-4">
          <TrafficLights />
          <OnlineUsers users={gameState ? Object.values(gameState.players).map(p => ({ id: p.id, nickname: p.nickname ?? null, score: p.score, avatar: p.avatar ?? null })) : []} />
          <a className="text-gray-200 text-3xl font-licorice hover:text-white" href="/leaderboard">Leaderboard</a>
        </div>
        <div className="text-xs flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-gray-300">Tone:</span>
            <select
              className="px-2 py-1 rounded bg-white/10 text-gray-100 border border-white/10"
              value={soundPack}
              onChange={(e) => { const v = e.target.value as 'soft'|'classic'|'retro'; setSoundPack(v); setSoundPackState(v); }}
            >
              <option value="soft">Soft</option>
              <option value="classic">Classic</option>
              <option value="retro">Retro</option>
            </select>
          </div>
          <span>UID: {userId || '...'}</span>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-28 pt-4 space-y-8 overflow-y-auto">
        <div className="text-center space-y-4">
          <h1 className="text-8xl font-semibold font-licorice text-gray-50 tracking-tight">DupMe</h1>
          <p className="text-lg text-gray-200">
            {!room
              ? "Welcome!"
              : phase === 'create'
                ? (isCreator ? "You're creating the pattern" : "Waiting for creator...")
                : phase === 'playback'
                  ? "Listening..."
                : phase === 'replicate'
                  ? (isCreator ? "Waiting for players to follow" : "Follow the pattern")
                  : phase === 'ended'
                    ? "Round ended"
                    : phase === 'game_over'
                      ? "Game over"
                      : ""}
          </p>
        </div>

        {!hasNick && (
          <div className="w-full max-w-3xl mx-auto">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#272725] backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] text-gray-100 space-y-3">
              <p className="text-sm text-gray-200 mb-4">Enter your nickname to continue:</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-[#272725] text-white placeholder-white/60 border-white/10 outline-none"
                  placeholder="Nickname"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {/* Avatar preview / carousel toggle */}
                    <div>
                      <div className="text-xs text-gray-300 mb-1 text-center w-full">Pick an avatar</div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => {
                            const prev = (avatarIndex - 1 + AVATAR_LIST.length) % AVATAR_LIST.length;
                            const nextPath = `/avatars/${AVATAR_LIST[prev]}`;
                            setAvatarIndex(prev); setAvatar(nextPath); try { localStorage.setItem('dupme_avatar', nextPath); } catch {}
                          }} className="p-2 rounded bg-white/10">&lt;</button>
                          <div className="h-20 w-20 rounded-full overflow-hidden border border-white bg-neutral-200">
                            <img src={`/avatars/${AVATAR_LIST[avatarIndex]}`} alt="avatar large" className="h-20 w-20 object-cover" />
                          </div>
                          <button onClick={() => {
                            const nxt = (avatarIndex + 1) % AVATAR_LIST.length;
                            const nextPath = `/avatars/${AVATAR_LIST[nxt]}`;
                            setAvatarIndex(nxt); setAvatar(nextPath); try { localStorage.setItem('dupme_avatar', nextPath); } catch {}
                          }} className="p-2 rounded bg-white/10">&gt;</button>
                        </div>
                    </div>
                    {/* removed duplicate label */}
                  </div>
                  <button onClick={submitNickname} className="p-4 rounded-full bg-neutral-200 text-neutral-900 hover:bg-gray-400 transition"><Music size={18} /></button>
                </div>
              </div>
              {/* carousel picker is inline in the preview; no separate grid here */}
            </div>
          </div>
        )}

        {hasNick && (
          !room ? (
            <div className="w-full max-w-2xl mx-auto">
              <Lobby rooms={rooms} onCreate={createRoom} onJoin={joinRoom} />
              {(lbAll.length > 0 || lbWeek.length > 0) && (
                <div className="mt-6 p-5 rounded-2xl bg-[#272725] text-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Leaderboard</h2>
                    <div className="flex gap-2 text-xs">
                      <button onClick={()=>setLbTab('all')} className={lbTab==='all'? 'px-2 py-1 rounded bg-white/10' : 'px-2 py-1 rounded bg-white/5'}>All‑time</button>
                      <button onClick={()=>setLbTab('week')} className={lbTab==='week'? 'px-2 py-1 rounded bg-white/10' : 'px-2 py-1 rounded bg-white/5'}>This week</button>
                    </div>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {(lbTab==='all'? lbAll : lbWeek).map((r, idx) => (
                      <li key={r.user_id+idx} className="flex justify-between">
                        <span>{r.nickname || r.user_id.slice(0,6)}</span>
                        <span>{r.best}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto">
              <RoomView
                room={room}
                phase={phase}
                banner={roomBanner}
                canPlay={canPlay}
                replicatePattern={replicatePattern}
                results={results}
                isCreator={isCreator}
                highlightIndex={highlightIndex}
                highlightColor={highlightColor}
                remainingSeconds={remainingSeconds}
                progress={timerProgress}
                onLeave={leaveRoom}
                onReady={async (ready) => { await ensureAudio(); socket?.emit('ROOMS:READY', ready); }}
                onKeyClick={handlePianoKeyClick}
                playersState={gameState?.players || {}}
              />
              {phase === 'game_over' && (lbAll.length > 0 || lbWeek.length > 0) && (
                <div className="mt-6 p-5 rounded-2xl bg-[#272725] text-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Leaderboard</h2>
                    <div className="flex gap-2 text-xs">
                      <button onClick={()=>setLbTab('all')} className={lbTab==='all'? 'px-2 py-1 rounded bg-white/10' : 'px-2 py-1 rounded bg-white/5'}>All‑time</button>
                      <button onClick={()=>setLbTab('week')} className={lbTab==='week'? 'px-2 py-1 rounded bg-white/10' : 'px-2 py-1 rounded bg-white/5'}>This week</button>
                    </div>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {(lbTab==='all'? lbAll : lbWeek).map((r, idx) => (
                      <li key={r.user_id+idx} className="flex justify-between">
                        <span>{r.nickname || r.user_id.slice(0,6)}</span>
                        <span>{r.best}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        )}

        {gameState && gameState.currentPattern.length > 0 && (
          <div className="p-3 rounded-xl border border-neutral-200 bg-white/70 w-full max-w-2xl mx-auto">
            <p className="text-sm text-neutral-500">Current Pattern</p>
            <p className="text-neutral-800 tracking-wider">{gameState.currentPattern.join(', ')}</p>
          </div>
        )}
      </section>
      {/* Winner overlay - only visible at game over; click-to-dismiss */}
      <WinnerCelebration
        open={winnerOverlayOpen && phase === 'game_over' && topWinners.length > 0}
        winners={topWinners}
        onDismiss={() => setWinnerOverlayOpen(false)}
      />
    </main>
  );
}

