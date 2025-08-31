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
const rooms = {}; // { [roomId]: { id, name, capacity, players: { [socketId]: true } } }

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
  return { id: room.id, name: room.name, capacity: room.capacity, players };
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
    if (gameState.currentPlayerTurn === socket.id) {
      gameState.currentPattern.push(note);
      broadcastGameState();
    }
  });

  // Rooms: create / join / leave
  socket.on('ROOMS:CREATE', ({ name, capacity } = {}) => {
    const id = generateRoomId();
    const cap = Math.max(2, Math.min(12, Number(capacity) || 2));
    rooms[id] = { id, name: String(name || `Room ${id}`), capacity: cap, players: {} };
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

server.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on port ${PORT}`);
});

