import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';
import { toPercent } from './utils.js';
import { rooms, listRooms, createRoom, getRoomSnapshot, CREATE_MAX_NOTES } from './rooms.js';
import { makeGameApi } from './game.js';


const app = express();
app.use(cors());
const server = http.createServer(app);
const PORT = process.env.PORT || 6996;

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://10.98.94.14:3000", "http://10.98.94.191:3000"], // ip of the host, ip of the client
    methods: ["GET", "POST"]
  }
});



const defaultGameState = {
  players: {},
  currentPattern: [],
  currentPlayerTurn: null,
  currentRound: 0,
};

let gameState = { ...defaultGameState };


const resetGame = (preservePlayers = false) => {
  const preservedPlayers = preservePlayers ? { ...gameState.players } : {};
  gameState = {
    ...defaultGameState,
    players: preservedPlayers,
  };
};

// Per-room minimal game state
// phase: 'idle' | 'create' | 'replicate' | 'ended'
// creatorId: socket id of the creator
// pattern: array of notes created in create phase
// submissions: { socketId: string[] } notes from non-creators in replicate phase
// endsAt: epoch ms when current phase ends
// tCreate/tReplicate: timeout handles
// scores: total correct across game (per player)
// attempts: total attempts across game (per player)
// roundBase: snapshot of scores at round start (per player)
// roundBaseAttempts: snapshot of attempts at round start (per player)

// Game API (phase transitions)
const { startGame } = makeGameApi({
  getPlayersState: () => gameState.players,
  broadcastRoom: (roomId) => io.to(roomId).emit('SERVER:ROOM', getRoomSnapshot(roomId, gameState.players)),
  broadcastGameState: () => broadcastGameState(),
  io,
});

const broadcastRooms = () => io.emit('SERVER:ROOMS', listRooms());
const broadcastRoom = (roomId) => io.to(roomId).emit('SERVER:ROOM', getRoomSnapshot(roomId, gameState.players));

const broadcastGameState = () => {
  io.emit('gameStateUpdate', gameState);
  console.log('--- Game State Broadcast jaade bhaiye 😎 ---');
  console.log(JSON.stringify(gameState, null, 2)); 
  console.log('--------------------------');
};

io.on('connection', (socket) => {
  console.log(`✅ A user is trying to connect: ${socket.id}`);


  console.log(`Connection accepted for ${socket.id}`);
  gameState.players[socket.id] = {
    id: socket.id,
    score: 0,
    nickname: null,
  };

  broadcastGameState();
  // Send current rooms list to newcomer and everyone
  socket.emit('SERVER:ROOMS', listRooms());
  broadcastRooms();

  // Set nickname for this socket
  socket.on('CLIENT:SET_NICKNAME', (nickname) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    const clean = String(nickname || '').trim().slice(0, 20);
    player.nickname = clean || `Player-${socket.id.slice(0,4)}`;
    broadcastGameState();
  });

  socket.on('CLIENT:SUBMIT_NOTE', (note) => {
    console.log(`Received note: ${note} from ${socket.id}`);
    // If inside a room and in create/replicate phases, route accordingly
    const roomId = socket.data?.roomId;
    const room = roomId ? rooms[roomId] : null;
    if (room && room.game) {
      if (room.game.phase === 'create' && room.game.creatorId === socket.id) {
        // Enforce hard cap on pattern length
        if ((room.game.pattern?.length || 0) >= CREATE_MAX_NOTES) return;
        room.game.pattern.push(note);
        io.to(roomId).emit('SERVER:PATTERN', { roomId, pattern: room.game.pattern });
      } else if (room.game.phase === 'replicate' && room.game.creatorId !== socket.id) {
        const arr = room.game.submissions[socket.id] || (room.game.submissions[socket.id] = []);
        // Do not accept more notes than the pattern length
        const patternLen = room.game.pattern.length;
        if (arr.length >= patternLen) {
          // Count the rejected click (beyond cap) for visibility
          room.game.rejected = room.game.rejected || {};
          room.game.rejected[socket.id] = (room.game.rejected[socket.id] || 0) + 1;
          broadcastRoom(roomId);
          return;
        }
        arr.push(note);
        // Live scoring: idempotent per-index count (so no double counting)
        const base = (room.game.roundBase?.[socket.id] || 0);
        const baseAtt = (room.game.roundBaseAttempts?.[socket.id] || 0);
        let matches = 0;
        for (let i = 0; i < arr.length; i++) {
          if (room.game.pattern[i] === arr[i]) matches++;
        }
        room.game.scores[socket.id] = base + matches;
        room.game.attempts[socket.id] = baseAtt + arr.length;
        const correct = room.game.scores[socket.id];
        const att = room.game.attempts[socket.id];
        const percent = toPercent(correct, att);
        if (gameState.players[socket.id]) gameState.players[socket.id].score = percent;
        // Update scoreboard for room and global list
        broadcastRoom(roomId);
        broadcastGameState();
      }
      return; // handled by room mode
    }

  });

  // Rooms: create / join / leave
  socket.on('ROOMS:CREATE', ({ name, capacity } = {}) => {
    const id = createRoom({ name, capacity });
    broadcastRooms();
    joinRoom(socket, id);
  });

  socket.on('ROOMS:JOIN', (roomId) => joinRoom(socket, String(roomId || '')));
  socket.on('ROOMS:LEAVE', () => leaveRoom(socket));

  socket.on('disconnect', () => {
    console.log(`❌ A user disconnected: ${socket.id}`);
    // Leave any joined room first
    leaveRoom(socket);

    if (!gameState.players[socket.id]) {
      return; 
    }

        delete gameState.players[socket.id];

    
    if (Object.keys(gameState.players).length < 2) {
      console.log('A player left. Returning to WAITING state.');
      resetGame(true); 
    }

        broadcastGameState();
  });
  
  // Ready / Unready in a room
  socket.on('ROOMS:READY', (isReady) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;
    room.ready = room.ready || {};
    if (isReady) room.ready[socket.id] = true; else delete room.ready[socket.id];
    broadcastRoom(roomId);
    // If everyone is ready and at least 2 players, trigger game start for this room
    const playerCount = Object.keys(room.players).length;
    const readyCount = Object.keys(room.ready).length;
    if (playerCount >= 2 && readyCount === playerCount) {
      startGame(roomId);
    }
  });
});

// Helpers for room membership
function joinRoom(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (Object.keys(room.players).length >= room.capacity) {
    socket.emit('SERVER:ROOM_FULL', roomId);
    return;
  }
  // Leave previous room if any
  if (socket.data?.roomId && socket.data.roomId !== roomId) {
    leaveRoom(socket);
  }
  room.players[socket.id] = true;
  room.joinOrder = room.joinOrder || [];
  if (!room.joinOrder.includes(socket.id)) room.joinOrder.push(socket.id);
  socket.data = { ...(socket.data || {}), roomId };
  socket.join(roomId);
  broadcastRoom(roomId);
  broadcastRooms();
  socket.emit('SERVER:JOINED_ROOM', roomId);
}

function leaveRoom(socket) {
  const roomId = socket.data?.roomId;
  if (!roomId) return;
  const room = rooms[roomId];
  if (!room) { socket.data.roomId = null; return; }
  delete room.players[socket.id];
  if (room.ready) delete room.ready[socket.id];
  if (room.joinOrder) room.joinOrder = room.joinOrder.filter((id) => id !== socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;
  if (Object.keys(room.players).length === 0) {
    delete rooms[roomId];
  } else {
    broadcastRoom(roomId);
  }
  broadcastRooms();
  socket.emit('SERVER:LEFT_ROOM');
}

// (Phase management moved to game.js)

server.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on port ${PORT}`);
});

