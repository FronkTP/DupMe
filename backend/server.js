import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';
import { toPercent } from './utils.js';
import { rooms, listRooms, createRoom, getRoomSnapshot, CREATE_MAX_NOTES, isPracticeRoom, isAiPracticeRoom } from './rooms.js';
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
app.use(express.json());

// simple health endpoint for platform checks
app.get('/health', (_req, res) => res.status(200).send('ok'));

// --- Admin Authentication System ---
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'iseedeadpeople';
const ADMIN_READ_PASSWORD = process.env.ADMIN_READ_PASSWORD || 'thaidog';
const adminTokens = new Map(); // token -> { mode, expiresAt }

// Validate password and issue token
app.post('/admin/validate', (req, res) => {
  const { password } = req.body;

  let mode = null;
  if (password === ADMIN_PASSWORD) mode = 'full';
  else if (password === ADMIN_READ_PASSWORD) mode = 'readonly';
  else return res.status(401).json({ valid: false, error: 'Invalid password' });

  // Generate random token
  const token = crypto.randomBytes(32).toString('hex');

  // Store token with mode and expiration (1 hour)
  adminTokens.set(token, {
    mode,
    expiresAt: Date.now() + 3600000 // 1 hour
  });

  res.json({ token, mode, valid: true });
});

// Verify token validity
app.get('/admin/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const tokenData = verifyAdminToken(token);

  if (!tokenData) {
    return res.status(403).json({ valid: false, error: 'Invalid or expired token' });
  }

  res.json({ valid: true, mode: tokenData.mode });
});

// Token verification helper
function verifyAdminToken(token) {
  if (!token) return null;

  const tokenData = adminTokens.get(token);
  if (!tokenData) return null;

  // Check expiration
  if (Date.now() > tokenData.expiresAt) {
    adminTokens.delete(token);
    return null;
  }

  return tokenData;
}

// Middleware: Require any admin token
function requireAdminToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const tokenData = verifyAdminToken(token);

  if (!tokenData) {
    return res.status(403).json({ error: 'Admin authentication required' });
  }

  req.adminMode = tokenData.mode;
  next();
}

// Middleware: Require full admin mode
function requireFullAdmin(req, res, next) {
  if (req.adminMode !== 'full') {
    return res.status(403).json({ error: 'Full admin access required' });
  }
  next();
}

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
    // Practice mode rooms don't process notes - they're handled client-side only
    if (room && room.mode === 'practice') return;

    // Handle AI mode note submissions
    if (room && room.mode === 'ai' && room.game && room.game.phase === 'replicate') {
      const seq = room.game.pattern || [];
      room.game.submissions = room.game.submissions || {};
      room.game.submissions[socket.id] = room.game.submissions[socket.id] || [];
      room.game.submissions[socket.id].push(note);

      const sub = room.game.submissions[socket.id];
      const seqLen = seq.length;

      // If player finished the pattern, compute their score now
      if (sub.length >= seqLen) {
        let correct = 0;
        for (let i = 0; i < seqLen; i++) {
          if (sub[i] === seq[i]) correct++;
        }
        const percent = seqLen ? Math.round((correct / seqLen) * 100) : 0;

        // Update player score in gameState
        if (gameState.players[socket.id]) gameState.players[socket.id].score = percent;

        // Update or add result for this player
        room.game.results = room.game.results || [];
        room.game.results = room.game.results.filter(r => r.id !== socket.id);
        room.game.results.push({
          id: socket.id,
          nickname: gameState.players[socket.id]?.nickname ?? null,
          score: percent
        });

        // Broadcast updated score
        broadcastGameState();

        // If all players finished, finalize now
        const allPlayers = Object.keys(room.players || {});
        const finished = allPlayers.every(pid =>
          (room.game.submissions[pid] && room.game.submissions[pid].length >= seqLen)
        );
        if (finished) {
          finalizeAiRound(roomId);
        }
      }
      return;
    }

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
          const expected = room.game.mode === 'reverse' ? room.game.pattern[room.game.pattern.length - 1 - i] : room.game.pattern[i];
          if (expected === arr[i]) matches++;
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
  socket.on('ROOMS:CREATE', (payload = {}) => {
    const { name, capacity, mode, numRounds } = (typeof payload === 'object' && payload) ? payload : {};
    const id = createRoom({ name, capacity, mode, numRounds });
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
    // Practice and AI mode rooms don't use ready/game start logic
    if (room.mode === 'practice' || room.mode === 'ai') return;
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

// AI Mode Helper Functions
function generateAiPattern(len = 6) {
  const NOTES = ['C','D','E','F','G','A','B'];
  const pattern = [];
  for (let i = 0; i < Math.max(1, Math.min(len, 10)); i++) {
    pattern.push(NOTES[Math.floor(Math.random() * NOTES.length)]);
  }
  return pattern;
}

function startAiRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const noteMs = 500;
  const gapMs = 150;
  const seq = generateAiPattern(6);
  const playbackDuration = seq.length * (noteMs + gapMs);

  // Store pattern & state on room.game
  room.game = room.game || {};
  room.game.pattern = seq;
  room.game.submissions = {}; // socketId -> array of notes
  room.game.results = []; // results to emit at end

  // Emit AI playback phase with sequence & timing
  io.to(roomId).emit('SERVER:PHASE', {
    phase: 'ai',
    sequence: seq,
    noteMs,
    gapMs,
    endsAt: Date.now() + playbackDuration
  });

  // After playback, move to replicate phase for players to submit
  setTimeout(() => {
    const replicateDuration = Math.max(5000, seq.length * 1200);
    io.to(roomId).emit('SERVER:PHASE', {
      phase: 'replicate',
      endsAt: Date.now() + replicateDuration
    });
    // Schedule finalization if players don't finish before timeout
    setTimeout(() => finalizeAiRound(roomId), replicateDuration + 50);
  }, playbackDuration + 50);
}

function finalizeAiRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const seq = room.game?.pattern || [];
  const players = Object.keys(room.players || {});
  const results = [];

  for (const pid of players) {
    const sub = (room.game?.submissions?.[pid]) || [];
    // Compute score as percentage of correct items in order
    let correct = 0;
    for (let i = 0; i < seq.length; i++) {
      if (sub[i] && sub[i] === seq[i]) correct++;
    }
    const percent = seq.length ? Math.round((correct / seq.length) * 100) : 0;

    // Update player score in gameState
    const playerState = gameState.players[pid];
    if (playerState) playerState.score = percent;

    results.push({
      id: pid,
      nickname: playerState?.nickname ?? null,
      score: percent
    });
  }

  room.game.results = results;
  // Broadcast ended with results
  io.to(roomId).emit('SERVER:PHASE', {
    phase: 'ended',
    results
  });

  // Broadcast updated game state
  broadcastGameState();
}

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
  // Auto-start practice mode when joining a practice room
  if (isPracticeRoom(roomId)) {
    io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'practice', mode: 'practice' });
  }
  // Auto-start AI practice mode when joining an AI practice room
  if (isAiPracticeRoom(roomId)) {
    startAiRound(roomId);
  }
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
  console.log(`Server is running and listening on port ${PORT}`);
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

// --- Admin API Endpoints ---

// Get server statistics (both tiers)
app.get('/admin/stats', requireAdminToken, (req, res) => {
  const stats = {
    players: Object.keys(gameState.players).length,
    rooms: Object.keys(rooms).length,
    activeGames: Object.values(rooms).filter(r => r.game && r.game.phase !== 'idle').length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  };
  res.json(stats);
});

// Get all connected players (both tiers)
app.get('/admin/players', requireAdminToken, (req, res) => {
  const players = Object.entries(gameState.players).map(([socketId, data]) => ({
    socketId,
    nickname: data.nickname || 'Anonymous',
    userId: data.userId || null,
    score: data.score || 0,
    room: Object.keys(rooms).find(roomId => rooms[roomId].players[socketId]) || null,
  }));
  res.json(players);
});

// Get all rooms with details (both tiers)
app.get('/admin/rooms', requireAdminToken, (req, res) => {
  const roomList = Object.values(rooms).map(room => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    playerCount: Object.keys(room.players).length,
    players: Object.keys(room.players).map(sid => ({
      socketId: sid,
      nickname: gameState.players[sid]?.nickname || 'Anonymous',
      ready: room.ready?.[sid] || false,
    })),
    mode: room.mode || 'classic',
    game: room.game ? {
      phase: room.game.phase,
      round: room.game.currentRound || 1,
      totalRounds: room.game.numRounds || 1,
      turn: (room.game.currentTurn || 0) + 1,
      totalTurns: room.game.totalTurns || room.game.order?.length || 0,
      creatorId: room.game.creatorId,
      patternLength: room.game.pattern?.length || 0,
    } : null,
  }));
  res.json(roomList);
});

// Get database statistics (both tiers)
app.get('/admin/db-stats', requireAdminToken, async (req, res) => {
  if (!db) {
    return res.json({ enabled: false, totalUsers: 0, totalResults: 0, recentGames: [] });
  }

  try {
    const usersQuery = await db.query('SELECT COUNT(*) as count FROM users');
    const resultsQuery = await db.query('SELECT COUNT(*) as count FROM results');
    const recentQuery = await db.query(`
      SELECT r.nickname, r.percent, r.created_at
      FROM results r
      ORDER BY r.created_at DESC
      LIMIT 10
    `);

    res.json({
      enabled: true,
      totalUsers: parseInt(usersQuery.rows[0]?.count || 0),
      totalResults: parseInt(resultsQuery.rows[0]?.count || 0),
      recentGames: recentQuery.rows || [],
    });
  } catch (e) {
    res.status(500).json({ error: 'db_stats_failed', message: e.message });
  }
});

// Kick player (full admin only)
app.post('/admin/kick-player', requireAdminToken, requireFullAdmin, (req, res) => {
  const { socketId } = req.body;

  if (!socketId) {
    return res.status(400).json({ error: 'socketId required' });
  }

  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    socket.disconnect(true);
    res.json({ success: true, message: 'Player kicked' });
  } else {
    res.status(404).json({ error: 'Socket not found' });
  }
});

// End game in a room (full admin only)
app.post('/admin/end-game', requireAdminToken, requireFullAdmin, (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId required' });
  }

  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (!room.game || room.game.phase === 'idle') {
    return res.json({ success: false, message: 'No active game in this room' });
  }

  // Force game over
  const results = (room.game.order || []).map((sid) => ({
    id: sid,
    nickname: gameState.players[sid]?.nickname || null,
    score: toPercent(room.game.scores?.[sid] || 0, room.game.attempts?.[sid] || 0),
  }));

  room.game.phase = 'game_over';
  io.to(roomId).emit('SERVER:GAME_END', { roomId, results });

  res.json({ success: true, message: 'Game ended' });
});

// Delete room (full admin only)
app.post('/admin/delete-room', requireAdminToken, requireFullAdmin, (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId required' });
  }

  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Disconnect all players in the room
  Object.keys(room.players).forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(roomId);
      socket.emit('SERVER:LEFT_ROOM');
      if (socket.data) socket.data.roomId = null;
    }
  });

  // Delete the room
  delete rooms[roomId];
  broadcastRooms();

  res.json({ success: true, message: 'Room deleted' });
});

// Clear leaderboard (full admin only)
app.delete('/admin/clear-leaderboard', requireAdminToken, requireFullAdmin, async (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'Database not enabled' });
  }

  try {
    await db.query('TRUNCATE TABLE results');
    res.json({ success: true, message: 'Leaderboard cleared' });
  } catch (e) {
    res.status(500).json({ error: 'clear_failed', message: e.message });
  }
});

// Broadcast global message (full admin only)
app.post('/admin/broadcast', requireAdminToken, requireFullAdmin, (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  io.emit('ADMIN:MESSAGE', { message, timestamp: Date.now() });
  res.json({ success: true, message: 'Broadcast sent' });
});

