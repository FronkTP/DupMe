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

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [hasNick, setHasNick] = useState<boolean>(false);


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

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
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

      {hasNick && gameInProgress ? (
        <Piano onKeyClick={handlePianoKeyClick} />
      ) : (
        <div className="p-8 bg-gray-800 rounded-lg">
          <p className="text-xl">Waiting for another player to join...</p>
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

