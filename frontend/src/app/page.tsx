"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Piano from './components/Piano';

// Socket endpoint for the backend
const SOCKET_URL = 'http://localhost:6996';

// Shapes we expect from the server
type Player = { id: string; score: number };
type GameState = {
  players: Record<string, Player & { nickname: string | null }>;
  gameStatus: 'WAITING' | 'CREATING_PATTERN' | 'PLAYING' | string;
  currentPattern: string[];
  currentPlayerTurn: string | null;
  currentRound: number;
};
type RoomListItem = { id: string; name: string; capacity: number; count: number };
type RoomSnapshot = { id: string; name: string; capacity: number; players: Array<{ id: string; nickname: string | null; score: number }>; ready?: string[] };

export default function Home() {
  // Connection + identity
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [hasNick, setHasNick] = useState<boolean>(false);

  // Server state and room lobby
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);

  // In-room status
  const [roomBanner, setRoomBanner] = useState<string>("");
  const [phase, setPhase] = useState<'idle'|'create'|'replicate'|'ended'|'game_over'|null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [replicatePattern, setReplicatePattern] = useState<string[]>([]);
  const [results, setResults] = useState<Array<{ id: string; nickname: string | null; score: number }> | null>(null);


  useEffect(() => {
    // Open socket connection once
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Wire up server events
    newSocket.on('connect', () => {
      console.log(`✅ Connected! My ID is ${newSocket.id}`);
      setMyId(newSocket.id ?? null);
    });

    newSocket.on('gameStateUpdate', (newState: GameState) => {
      console.log('Received gameStateUpdate:', newState);
      setGameState(newState);
    });

    newSocket.on('SERVER:ROOMS', (list: RoomListItem[]) => setRooms(list));
    newSocket.on('SERVER:ROOM', (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      const readyLen = snapshot.ready?.length ?? 0;
      const playerLen = snapshot.players.length;
      if (playerLen < 2 || readyLen !== playerLen) {
        setRoomBanner("");
      }
    });
    newSocket.on('SERVER:JOINED_ROOM', () => setRoomBanner(""));
    newSocket.on('SERVER:LEFT_ROOM', () => { setRoom(null); setRoomBanner(""); });
    type GameStartPayload = { roomId: string; creatorId?: string; phase?: 'create'; endsAt?: number; roundIndex?: number; totalRounds?: number };
    type PhasePayload = { roomId: string; phase?: 'create'|'replicate'|'ended'|'game_over'; creatorId?: string; endsAt?: number; pattern?: string[]; results?: Array<{ id: string; nickname: string | null; score: number }>} ;
    newSocket.on('SERVER:GAME_START', (p: GameStartPayload) => {
      setRoomBanner(`Round ${((p?.roundIndex ?? 0) + 1)}/${p?.totalRounds ?? ''} • Create phase: start playing notes`);
      setPhase('create');
      setCreatorId(p?.creatorId ?? null);
      setReplicatePattern([]);
      setResults(null);
    });
    newSocket.on('SERVER:PHASE', (p: PhasePayload) => {
      setPhase(p?.phase ?? null);
      setCreatorId(p?.creatorId ?? null);
      if (p?.phase === 'replicate') setRoomBanner('Replicate phase: match the pattern');
      if (p?.phase === 'ended') setRoomBanner('Round ended');
      if (p?.phase === 'replicate') setReplicatePattern(p?.pattern || []);
      if (p?.phase === 'ended') { setReplicatePattern([]); if (p?.results) setResults(p.results); }
    });
    newSocket.on('SERVER:GAME_END', (payload: { roomId: string; results: Array<{ id: string; nickname: string | null; score: number }> }) => {
      setPhase('game_over');
      setResults(payload.results || []);
      setRoomBanner('Game over');
    });
    newSocket.on('SERVER:PATTERN', (payload: { roomId: string; pattern: string[] }) => {
      if (!payload?.pattern) return;
      // Keep the latest pattern; we will display it during replicate
      setReplicatePattern(payload.pattern);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setRoomBanner("");
    });

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []); 

  // Derived flags for UI enablement
  const isMyTurn = gameState && gameState.currentPlayerTurn === myId;
  const gameInProgress = gameState && gameState.gameStatus !== 'WAITING';
  const isCreator = creatorId ? myId === creatorId : false;
  const canPlay = phase === 'create' ? isCreator : phase === 'replicate' ? !isCreator : false;


  // Send a note to the server; server decides how to route it
  const handlePianoKeyClick = (note: string) => {
    if (!socket) return;
    socket.emit('CLIENT:SUBMIT_NOTE', note);
  };

  // Save nickname once per connection
  const submitNickname = () => {
    if (!socket) return;
    const clean = nickname.trim();
    if (!clean) return;
    socket.emit('CLIENT:SET_NICKNAME', clean);
    setHasNick(true);
  };

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-900 text-white">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold tracking-tighter">DupMe Game</h1>
        <p className="mt-2 text-lg text-gray-400">
          {gameInProgress ? (isMyTurn ? "It's your turn!" : "Waiting for opponent...") : "Welcome!"}
        </p>
        <p className="mt-1 text-sm text-gray-500">Your ID: {myId}</p>
      </div>

      {!hasNick && (
        <div className="p-4 bg-gray-800 rounded-lg w-full max-w-md">
          <p className="mb-2">Enter your nickname to continue:</p>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-gray-900 border border-gray-700 outline-none"
              placeholder="Nickname"
            />
            <button onClick={submitNickname} className="px-4 py-2 bg-blue-600 rounded">Save</button>
          </div>
        </div>
      )}

      {hasNick && (
          <div className="p-8 bg-gray-800 rounded-lg w-full max-w-2xl">
            {!room ? (
              <div>
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-400">Create room</label>
                    <div className="flex gap-2">
                      <input id="roomName" placeholder="Room name" className="px-3 py-2 rounded bg-gray-900 border border-gray-700" />
                      <input id="roomCap" type="number" min={2} max={12} placeholder="Cap" className="w-20 px-3 py-2 rounded bg-gray-900 border border-gray-700" />
                      <button
                        className="px-4 py-2 bg-blue-600 rounded"
                        onClick={() => {
                          const name = (document.getElementById('roomName') as HTMLInputElement)?.value || '';
                          const cap = Number((document.getElementById('roomCap') as HTMLInputElement)?.value || 2);
                          createRoom(name, cap);
                        }}
                      >Create</button>
                    </div>
                  </div>
                </div>
                <p className="mb-2 font-semibold">Available rooms</p>
                <ul className="space-y-2">
                  {rooms.length === 0 && <li className="text-gray-400">No rooms yet. Create one!</li>}
                  {rooms.map(r => (
                    <li key={r.id} className="flex justify-between items-center bg-gray-900 rounded p-3">
                      <span>{r.name} — {r.count}/{r.capacity}</span>
                      <button className="px-3 py-1 bg-green-600 rounded" onClick={() => joinRoom(r.id)}>Join</button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold">Room {room.name} ({room.id}) {room.players.length}/{room.capacity}</p>
                  <button onClick={leaveRoom} className="px-3 py-1 bg-red-600 rounded">Leave</button>
                </div>
                {roomBanner && (
                  <div className="mb-3 p-2 bg-blue-900 text-blue-200 rounded">{roomBanner}</div>
                )}
                <ul className="text-sm text-gray-300 space-y-1 mb-4">
                  {room.players.map(p => (
                    <li key={p.id} className="flex justify-between">
                      <span>{p.nickname || p.id.slice(0,4)}</span>
                      <span className="flex gap-3 items-center">
                        <span className="text-gray-500">score: {p.score}%</span>
                        {room.ready?.includes(p.id) && <span className="text-green-500">ready</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {(phase === null || phase === 'idle' || phase === 'game_over') && (
                  <div className="flex gap-2">
                    <button className="px-3 py-2 bg-green-600 rounded" onClick={() => socket?.emit('ROOMS:READY', true)}>Ready</button>
                    <button className="px-3 py-2 bg-gray-600 rounded" onClick={() => socket?.emit('ROOMS:READY', false)}>Unready</button>
                  </div>
                )}
                {(phase === 'create' || phase === 'replicate' || phase === 'ended') && (
                  <div className="mt-4">
                    <Piano onKeyClick={handlePianoKeyClick} disabled={!canPlay} />
                  </div>
                )}
                {phase === 'replicate' && (
                  <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700">
                    <p className="text-sm text-gray-400">Pattern:</p>
                    <p className="text-lg tracking-widest">{replicatePattern.join(' ') || '...'}</p>
                  </div>
                )}
                {phase === 'ended' && results && (
                  <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700">
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
                            <span className="text-gray-300">{r.score}%</span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 text-sm text-gray-400">Click Ready to start another round.</div>
                  </div>
                )}
                {phase === 'game_over' && results && (
                  <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700">
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
                            <span className="text-gray-300">{r.score}%</span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 text-sm text-gray-400">Click Ready to start a new game.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {gameState && gameState.currentPattern.length > 0 && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <p>Current Pattern: {gameState.currentPattern.join(', ')}</p>
          </div>
      )}

      {gameState && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg w-full max-w-md">
          <p className="mb-2 font-semibold">Online users</p>
          <ul className="text-sm text-gray-300 space-y-1">
            {Object.values(gameState.players).map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.nickname || p.id.slice(0,4)}</span>
                <span className="text-gray-500">score: {p.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

