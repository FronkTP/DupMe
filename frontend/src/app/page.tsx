"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Piano from './components/Piano';

export default function Home() {
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

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [hasNick, setHasNick] = useState<boolean>(false);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [roomBanner, setRoomBanner] = useState<string>("");


  useEffect(() => {
    // 1. Create the socket connection
    const newSocket = io('http://localhost:6996');
    setSocket(newSocket);

    // 2. Set up event listeners
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
    newSocket.on('SERVER:GAME_START', () => setRoomBanner('Game starting!'));

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setRoomBanner("");
    });

    // 3. Cleanup: disconnect the socket when the component unmounts
    return () => {
      newSocket.disconnect();
    };
  }, []); 

    // Helper variables derived from state
  const isMyTurn = gameState && gameState.currentPlayerTurn === myId;
  const gameInProgress = gameState && gameState.gameStatus !== 'WAITING';


  const handlePianoKeyClick = (note: string) => {
    if (socket && isMyTurn) {
      console.log(`Sending note to server: ${note}`);
      socket.emit('CLIENT:SUBMIT_NOTE', note);
    } else {
      console.log("Not my turn or socket not ready!");
    }
  };

  const submitNickname = () => {
    if (!socket) return;
    const clean = nickname.trim();
    if (!clean) return;
    socket.emit('CLIENT:SET_NICKNAME', clean);
    setHasNick(true);
  };

  const createRoom = (name: string, capacity: number) => {
    if (!socket) return;
    socket.emit('ROOMS:CREATE', { name, capacity });
  };

  const joinRoom = (id: string) => {
    if (!socket) return;
    socket.emit('ROOMS:JOIN', id);
  };

  const leaveRoom = () => {
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

      {hasNick && room && gameInProgress ? (
        <Piano onKeyClick={handlePianoKeyClick} />
      ) : (
        hasNick && (
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
                        <span className="text-gray-500">score: {p.score}</span>
                        {room.ready?.includes(p.id) && <span className="text-green-500">ready</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button className="px-3 py-2 bg-green-600 rounded" onClick={() => socket?.emit('ROOMS:READY', true)}>Ready</button>
                  <button className="px-3 py-2 bg-gray-600 rounded" onClick={() => socket?.emit('ROOMS:READY', false)}>Unready</button>
                </div>
              </div>
            )}
          </div>
        )
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

