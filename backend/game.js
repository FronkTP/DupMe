import { toPercent } from './utils.js';
import { rooms } from './rooms.js';

// Broadcast helpers are provided by the host server file via callbacks

export const makeGameApi = ({ getPlayersState, broadcastRoom, broadcastGameState, io }) => {
  // Start a new game in the room
  const startGame = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.ready = {};
    const currentPlayers = Object.keys(room.players);
    const order = (room.joinOrder || []).filter((id) => currentPlayers.includes(id));
    const scores = {}; const attempts = {};
    order.forEach((sid) => { scores[sid] = 0; attempts[sid] = 0; const p = getPlayersState()[sid]; if (p) p.score = 0; });
    room.game = { phase: 'create', order, roundIndex: 0, creatorId: order[0], pattern: [], submissions: {}, endsAt: Date.now() + 10000, scores, attempts, roundBase: { ...scores }, roundBaseAttempts: { ...attempts } };
    io.to(roomId).emit('SERVER:GAME_START', { roomId, creatorId: room.game.creatorId, phase: 'create', endsAt: room.game.endsAt, roundIndex: room.game.roundIndex, totalRounds: order.length });
    clearTimeout(room.game.tCreate);
    room.game.tCreate = setTimeout(() => startReplicatePhase(roomId), 10000);
  };

  const startCreatePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    room.game.phase = 'create';
    room.game.pattern = [];
    room.game.submissions = {};
    room.game.creatorId = room.game.order[room.game.roundIndex];
    room.game.endsAt = Date.now() + 10000;
    room.game.roundBase = { ...(room.game.scores || {}) };
    room.game.roundBaseAttempts = { ...(room.game.attempts || {}) };
    Object.keys(room.game.roundBase).forEach((sid) => {
      const p = getPlayersState()[sid];
      if (!p) return;
      p.score = toPercent(room.game.roundBase[sid] || 0, room.game.roundBaseAttempts[sid] || 0);
    });
    broadcastGameState();
    io.to(roomId).emit('SERVER:GAME_START', { roomId, creatorId: room.game.creatorId, phase: 'create', endsAt: room.game.endsAt, roundIndex: room.game.roundIndex, totalRounds: room.game.order.length });
    clearTimeout(room.game.tCreate);
    room.game.tCreate = setTimeout(() => startReplicatePhase(roomId), 10000);
  };

  const startReplicatePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    room.game.phase = 'replicate';
    room.game.submissions = {};
    room.game.endsAt = Date.now() + 20000;
    io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'replicate', creatorId: room.game.creatorId, endsAt: room.game.endsAt, pattern: room.game.pattern });
    clearTimeout(room.game.tReplicate);
    room.game.tReplicate = setTimeout(() => finishRound(roomId), 20000);
  };

  const finishRound = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    const pattern = room.game.pattern || [];
    Object.keys(room.players).forEach((sid) => {
      if (sid === room.game.creatorId) return;
      const sub = (room.game.submissions[sid] || []);
      let matches = 0;
      for (let i = 0; i < Math.min(pattern.length, sub.length); i++) {
        if (pattern[i] === sub[i]) matches++;
      }
      const base = (room.game.roundBase?.[sid] || 0);
      const baseAtt = (room.game.roundBaseAttempts?.[sid] || 0);
      room.game.scores[sid] = base + matches;
      room.game.attempts[sid] = baseAtt + sub.length;
      const p = getPlayersState()[sid];
      if (!p) return;
      p.score = toPercent(room.game.scores[sid], room.game.attempts[sid]);
    });
    broadcastGameState();
    if (room.game.roundIndex + 1 < room.game.order.length) {
      room.game.roundIndex += 1;
      room.game.phase = 'ended';
      io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'ended' });
      setTimeout(() => startCreatePhase(roomId), 1000);
      return;
    }
    const results = room.game.order.map((sid) => ({
      id: sid,
      nickname: getPlayersState()[sid]?.nickname || null,
      score: toPercent(room.game.scores[sid] || 0, room.game.attempts?.[sid] || 0),
    }));
    room.game.phase = 'game_over';
    io.to(roomId).emit('SERVER:GAME_END', { roomId, results });
  };

  return { startGame, startCreatePhase, startReplicatePhase, finishRound };
};


