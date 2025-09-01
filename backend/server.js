import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';


const app = express();
app.use(cors());
const server = http.createServer(app);
const PORT = process.env.PORT || 6996;

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const defaultGameState = {
  players: {},
  gameStatus: 'WAITING',
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

// Minimal in-memory rooms (prototype)
const rooms = {}; // { [roomId]: { id, name, capacity, players: { [socketId]: true }, ready: { [socketId]: true }, joinOrder: string[], game?: GameState } }

// Per-room minimal game state
// phase: 'idle' | 'create' | 'replicate' | 'ended'
// creatorId: socket id of the creator
// pattern: array of notes created in create phase
// submissions: { socketId: string[] } notes from non-creators in replicate phase
// endsAt: epoch ms when current phase ends
// tCreate/tReplicate: timeout handles
// scores use global gameState.players[sid].score for simplicity

const CREATE_MAX_NOTES = 10;

const generateRoomId = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const listRooms = () => Object.values(rooms).map((r) => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity,
  count: Object.keys(r.players).length,
}));

const getRoomSnapshot = (roomId) => {
  const room = rooms[roomId];
  if (!room) return null;
  const players = Object.keys(room.players).map((sid) => {
    const p = gameState.players[sid];
    return p ? { id: p.id, nickname: p.nickname, score: p.score } : { id: sid, nickname: null, score: 0 };
  });
  const ready = Object.keys(room.ready || {}).filter((sid) => room.ready[sid]);
  return { id: room.id, name: room.name, capacity: room.capacity, players, ready };
};

const broadcastRooms = () => io.emit('SERVER:ROOMS', listRooms());

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
        if (arr.length >= patternLen) return;
        arr.push(note);
        // Live scoring: idempotent per-index count (so no double counting)
        const base = (room.game.roundBase?.[socket.id] || 0);
        let matches = 0;
        for (let i = 0; i < arr.length; i++) {
          if (room.game.pattern[i] === arr[i]) matches++;
        }
        room.game.scores[socket.id] = base + matches;
        if (gameState.players[socket.id]) gameState.players[socket.id].score = room.game.scores[socket.id];
        // Update scoreboard for room and global list
        io.to(roomId).emit('SERVER:ROOM', getRoomSnapshot(roomId));
        broadcastGameState();
      }
      return; // handled by room mode
    }

    // Legacy global mode (unused once rooms active)
    if (gameState.currentPlayerTurn === socket.id) {
      gameState.currentPattern.push(note);
      broadcastGameState();
    }
  });

  // Rooms: create / join / leave
  socket.on('ROOMS:CREATE', ({ name, capacity } = {}) => {
    const id = generateRoomId();
    const cap = Math.max(2, Math.min(12, Number(capacity) || 2));
    rooms[id] = { id, name: String(name || `Room ${id}`), capacity: cap, players: {}, ready: {} };
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
    io.to(roomId).emit('SERVER:ROOM', getRoomSnapshot(roomId));
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
  io.to(roomId).emit('SERVER:ROOM', getRoomSnapshot(roomId));
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
    io.to(roomId).emit('SERVER:ROOM', getRoomSnapshot(roomId));
  }
  broadcastRooms();
  socket.emit('SERVER:LEFT_ROOM');
}

// Phase management (very small prototype)
function startGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.ready = {}; // reset ready state
  // order based on join sequence, filtered to current players
  const currentPlayers = Object.keys(room.players);
  const order = (room.joinOrder || []).filter((id) => currentPlayers.includes(id));
  const scores = {};
  order.forEach((sid) => { scores[sid] = 0; if (gameState.players[sid]) gameState.players[sid].score = 0; });
  room.game = { phase: 'create', order, roundIndex: 0, creatorId: order[0], pattern: [], submissions: {}, endsAt: Date.now() + 10000, scores, roundBase: { ...scores } };
  io.to(roomId).emit('SERVER:GAME_START', { roomId, creatorId: room.game.creatorId, phase: 'create', endsAt: room.game.endsAt, roundIndex: room.game.roundIndex, totalRounds: order.length });
  clearTimeout(room.game.tCreate);
  room.game.tCreate = setTimeout(() => startReplicatePhase(roomId), 10000);
}

function startCreatePhase(roomId) {
  const room = rooms[roomId];
  if (!room || !room.game) return;
  room.game.phase = 'create';
  room.game.pattern = [];
  room.game.submissions = {};
  room.game.creatorId = room.game.order[room.game.roundIndex];
  room.game.endsAt = Date.now() + 10000;
  room.game.roundBase = { ...(room.game.scores || {}) };
  // Also sync visible scoreboard to base at the start of each creator round
  Object.keys(room.game.roundBase).forEach((sid) => {
    if (gameState.players[sid]) gameState.players[sid].score = room.game.roundBase[sid];
  });
  broadcastGameState();
  io.to(roomId).emit('SERVER:GAME_START', { roomId, creatorId: room.game.creatorId, phase: 'create', endsAt: room.game.endsAt, roundIndex: room.game.roundIndex, totalRounds: room.game.order.length });
  clearTimeout(room.game.tCreate);
  room.game.tCreate = setTimeout(() => startReplicatePhase(roomId), 10000);
}

function startReplicatePhase(roomId) {
  const room = rooms[roomId];
  if (!room || !room.game) return;
  room.game.phase = 'replicate';
  room.game.submissions = {};
  room.game.endsAt = Date.now() + 20000;
  io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'replicate', creatorId: room.game.creatorId, endsAt: room.game.endsAt, pattern: room.game.pattern });
  clearTimeout(room.game.tReplicate);
  room.game.tReplicate = setTimeout(() => finishRound(roomId), 20000);
}

function finishRound(roomId) {
  const room = rooms[roomId];
  if (!room || !room.game) return;
  // scoring: compare each non-creator submission to pattern per-index
  const pattern = room.game.pattern || [];
  Object.keys(room.players).forEach((sid) => {
    if (sid === room.game.creatorId) return;
    const sub = (room.game.submissions[sid] || []);
    let matches = 0;
    for (let i = 0; i < Math.min(pattern.length, sub.length); i++) {
      if (pattern[i] === sub[i]) matches++;
    }
    const base = (room.game.roundBase?.[sid] || 0);
    room.game.scores[sid] = base + matches;
    if (gameState.players[sid]) gameState.players[sid].score = room.game.scores[sid];
  });
  broadcastGameState();
  // If more rounds remain, advance to next creator
  if (room.game.roundIndex + 1 < room.game.order.length) {
    room.game.roundIndex += 1;
    room.game.phase = 'ended';
    io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'ended' });
    // brief pause before next round
    setTimeout(() => startCreatePhase(roomId), 1000);
    return;
  }
  // Game over: prepare final results
  const results = room.game.order.map((sid) => ({
    id: sid,
    nickname: gameState.players[sid]?.nickname || null,
    score: room.game.scores[sid] || 0,
  }));
  // Keep scores until the next Ready cycle; do not reset immediately
  room.game.phase = 'game_over';
  io.to(roomId).emit('SERVER:GAME_END', { roomId, results });
}

server.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on port ${PORT}`);
});

