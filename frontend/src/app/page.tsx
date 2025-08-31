"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Piano from './components/Piano';

export default function Home() {
  type Player = { id: string; score: number };
  type GameState = {
    players: Record<string, Player>;
    gameStatus: 'WAITING' | 'CREATING_PATTERN' | 'PLAYING' | string;
    currentPattern: string[];
    currentPlayerTurn: string | null;
    currentRound: number;
  };

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const [socket, setSocket] = useState<Socket | null>(null);


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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-900 text-white">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold tracking-tighter">DupMe Game</h1>
        <p className="mt-2 text-lg text-gray-400">
          {gameInProgress ? (isMyTurn ? "It's your turn!" : "Waiting for opponent...") : "Welcome!"}
        </p>
        <p className="mt-1 text-sm text-gray-500">Your ID: {myId}</p>
      </div>

      {gameInProgress ? (
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
    </main>
  );
}

