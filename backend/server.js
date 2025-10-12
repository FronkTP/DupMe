import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';
import { toPercent } from './utils.js';
import { rooms, listRooms, createRoom, getRoomSnapshot, CREATE_MAX_NOTES } from './rooms.js';
import { makeGameApi } from './game.js';
import pkg from 'pg';
const { Pool } = pkg;


const app = express();
// CORS allowlist from env (comma-separated)
const FRONTEND_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST'],
}));
// simple health endpoint for platform checks
app.get('/health', (_req, res) => res.status(200).send('ok'));
const server = http.createServer(app);
const PORT = process.env.PORT || 6996;

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
  }
});

// --- Neon Postgres (optional, enabled if DATABASE_URL is present) ---
let db = null;
if (process.env.DATABASE_URL) {
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  // Minimal schema: users and results
  (async () => {
    try {
      await db.query(`create table if not exists users (
        user_id text primary key,
        latest_nickname text,
        created_at timestamptz default now()
      )`);
      await db.query(`create table if not exists results (
        id bigserial primary key,
        user_id text references users(user_id),
        correct int not null,
        attempts int not null,
        percent int not null,
        created_at timestamptz default now()
      )`);
      await db.query(`alter table results add column if not exists nickname text`);
      console.log('✅ Neon schema ready');
    } catch (e) {
      console.error('❌ Neon init failed', e);
    }
  })();
}



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
  persistResults: async (rows) => {
    if (!db || !Array.isArray(rows) || rows.length === 0) return;
    for (const r of rows) {
      if (!r?.userId) continue;
      try {
        await db.query('insert into results(user_id, correct, attempts, percent, nickname) values($1,$2,$3,$4,$5)', [String(r.userId), Number(r.correct)||0, Number(r.attempts)||0, Number(r.percent)||0, String(r.nickname || '')]);
      } catch {}
    }
  }
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
    avatar: null,
    nickname: null,
    userId: null,
  };

  broadcastGameState();
  // Send current rooms list to newcomer and everyone
  socket.emit('SERVER:ROOMS', listRooms());
  broadcastRooms();

  // Set nickname for this socket
  socket.on('CLIENT:SET_NICKNAME', (payload) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    const { nickname, userId, avatar } = (typeof payload === 'object' && payload) ? payload : { nickname: payload, userId: null, avatar: null };
    const clean = String(nickname || '').trim().slice(0, 20);
    player.nickname = clean || `Player-${socket.id.slice(0,4)}`;
    // Accept optional avatar (string, data URL or identifier)
    player.avatar = avatar || player.avatar || null;
    // Attach stable userId and avatar to this socket for later persistence (if set)
    if (userId) {
      socket.data.userId = String(userId);
      player.userId = String(userId);
    }
    if (avatar) {
      socket.data.avatar = String(avatar);
    }
    // Upsert user in Neon if enabled
    if (db && userId) {
      db.query('insert into users(user_id, latest_nickname) values($1,$2) on conflict (user_id) do update set latest_nickname=excluded.latest_nickname', [String(userId), player.nickname]).catch(()=>{});
    }
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

// Leaderboard API
app.get('/leaderboard', async (req, res) => {
  if (!db) { res.json([]); return; }
  const range = String(req.query.range || 'all');
  const filter = range === 'week' ? "where r.created_at >= now() - interval '7 days'" : '';
  try {
    const sql = `with scoped as (
                   select r.user_id, r.percent, r.attempts, r.correct, r.created_at,
                          coalesce(nullif(r.nickname,''), u.latest_nickname) as nickname
                   from results r left join users u on u.user_id = r.user_id
                   ${filter}
                 ),
                 best as (
                   select distinct on (user_id)
                          user_id, nickname, percent as best, attempts as attempts_at_best, created_at as best_at
                   from scoped
                   order by user_id, percent desc, attempts desc, created_at asc
                 ),
                 agg as (
                   select user_id,
                          sum(correct) as total_correct,
                          sum(attempts) as total_attempts,
                          count(*) as games_played,
                          max(created_at) as last_played
                   from scoped
                   group by user_id
                 )
                 select b.user_id, b.nickname, b.best, b.attempts_at_best,
                        a.games_played, a.total_attempts, a.total_correct, a.last_played
                 from best b join agg a using (user_id)
                 order by b.best desc, b.attempts_at_best desc, a.last_played desc
                 limit 50`;
    const { rows } = await db.query(sql);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: 'leaderboard_failed' });
  }
});

app.get('/leaderboard/me', async (req, res) => {
  if (!db) { res.json({ summary: null, recent: [] }); return; }
  const userId = String(req.query.userId || '')
  if (!userId) { res.json({ summary: null, recent: [] }); return; }
  try {
    const sqlSummary = `with s as (
                          select r.user_id, r.percent, r.attempts, r.correct, r.created_at,
                                 coalesce(nullif(r.nickname,''), u.latest_nickname) as nickname
                          from results r left join users u on u.user_id = r.user_id
                          where r.user_id = $1
                        ),
                        best as (
                          select distinct on (user_id)
                                 user_id, nickname, percent as best, attempts as attempts_at_best, created_at as best_at
                          from s
                          order by user_id, percent desc, attempts desc, created_at asc
                        ),
                        agg as (
                          select user_id,
                                 sum(correct) as total_correct,
                                 sum(attempts) as total_attempts,
                                 count(*) as games_played,
                                 max(created_at) as last_played
                          from s
                          group by user_id
                        )
                        select b.user_id, b.nickname, b.best, b.attempts_at_best,
                               a.games_played, a.total_attempts, a.total_correct, a.last_played
                        from best b join agg a using (user_id)`;
    const { rows: srows } = await db.query(sqlSummary, [userId]);
    const sqlRecent = `select coalesce(nullif(r.nickname,''), u.latest_nickname) as nickname,
                              percent, attempts, correct, created_at
                       from results r left join users u on u.user_id=r.user_id
                       where r.user_id = $1
                       order by created_at desc
                       limit 10`;
    const { rows: rrows } = await db.query(sqlRecent, [userId]);
    res.json({ summary: srows?.[0] || null, recent: rrows || [] });
  } catch (e) {
    res.status(500).json({ summary: null, recent: [], error: 'leaderboard_me_failed' });
  }
});

