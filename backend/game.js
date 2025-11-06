import { toPercent } from './utils.js';
import { rooms } from './rooms.js';

// Broadcast helpers are provided by the host server file via callbacks

export const makeGameApi = ({ getPlayersState, broadcastRoom, broadcastGameState, io, persistResults }) => {
  // Start a new game in the room
  const startGame = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.ready = {};
    const currentPlayers = Object.keys(room.players);
    const order = (room.joinOrder || []).filter((id) => currentPlayers.includes(id));

    // Randomize turn order using Fisher-Yates shuffle
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const scores = {}; const attempts = {};
    order.forEach((sid) => { scores[sid] = 0; attempts[sid] = 0; const p = getPlayersState()[sid]; if (p) p.score = 0; });
    // inherit room mode (default to classic)
    const mode = room.mode || 'classic';
    const numRounds = room.numRounds || 1;
    const totalTurns = order.length * numRounds;
    room.game = {
      phase: 'demo',
      mode,
      order,
      numRounds,
      currentRound: 1,
      currentTurn: 0,
      totalTurns,
      creatorId: order[0],
      pattern: [],
      submissions: {},
      endsAt: Date.now(),
      scores,
      attempts,
      rejected: {},
      roundBase: { ...scores },
      roundBaseAttempts: { ...attempts }
    };
    // Broadcast zeroed scoreboard immediately so clients don't show stale scores
    broadcastGameState();
    broadcastRoom(roomId);
    // Start with a short sound demo before create
    startDemoPhase(roomId);
  };

  const startCreatePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    room.game.phase = 'create';
    room.game.pattern = [];
    room.game.submissions = {};

    // Use modulo for wrap-around: supports multi-round games
    const playerIndex = room.game.currentTurn % room.game.order.length;
    room.game.creatorId = room.game.order[playerIndex];

    // Calculate current round (1-indexed)
    room.game.currentRound = Math.floor(room.game.currentTurn / room.game.order.length) + 1;

    room.game.endsAt = Date.now() + 10000;
    room.game.roundBase = { ...(room.game.scores || {}) };
    room.game.roundBaseAttempts = { ...(room.game.attempts || {}) };
    Object.keys(room.game.roundBase).forEach((sid) => {
      const p = getPlayersState()[sid];
      if (!p) return;
      p.score = toPercent(room.game.roundBase[sid] || 0, room.game.roundBaseAttempts[sid] || 0);
    });
    broadcastGameState();
  io.to(roomId).emit('SERVER:GAME_START', {
      roomId,
      creatorId: room.game.creatorId,
      phase: 'create',
      endsAt: room.game.endsAt,
      currentRound: room.game.currentRound,
      totalRounds: room.game.numRounds,
      currentTurn: room.game.currentTurn,
      totalTurns: room.game.totalTurns,
      mode: room.game.mode
    });
    clearTimeout(room.game.tCreate);
    room.game.tCreate = setTimeout(() => startPlaybackPhase(roomId), 10000);
  };

  // New: sound demo phase at the beginning of the game
  const startDemoPhase = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    room.game.phase = 'demo';
    const sequence = ['C','D','E','F','G','A','B'];
    const noteMs = 500;
    const gapMs = 150;
    const leadMs = 150;
    const tailMs = 150;
    const totalMs = leadMs + (sequence.length * (noteMs + gapMs) - gapMs) + tailMs;
    const playbackDurationMs = Math.min(totalMs, 8000);
    room.game.endsAt = Date.now() + playbackDurationMs;
  io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'demo', creatorId: room.game.creatorId, endsAt: room.game.endsAt, sequence, noteMs, gapMs, mode: room.game.mode });
    clearTimeout(room.game.tDemo);
    room.game.tDemo = setTimeout(() => startCreatePhase(roomId), playbackDurationMs);
  };

  // New: playback phase between create and replicate
  const startPlaybackPhase = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    room.game.phase = 'playback';
    // Basic timing for fixed-step playback
    const noteMs = 500; // tone length per note
    const gapMs = 150;  // gap between notes
    const leadMs = 200; // small lead-in before first note
    const tailMs = 200; // small tail after last note
    const patternLen = (room.game.pattern?.length || 0);
    const base = patternLen > 0 ? (leadMs + patternLen * (noteMs + gapMs) - gapMs + tailMs) : 700;
    const playbackDurationMs = Math.min(base, 8000); // cap to keep rounds snappy
    room.game.endsAt = Date.now() + playbackDurationMs;
  io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'playback', creatorId: room.game.creatorId, endsAt: room.game.endsAt, pattern: room.game.pattern, noteMs, gapMs, mode: room.game.mode });
    clearTimeout(room.game.tPlayback);
    room.game.tPlayback = setTimeout(() => startReplicatePhase(roomId), playbackDurationMs);
  };

  const startReplicatePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    room.game.phase = 'replicate';
    room.game.submissions = {};
    room.game.rejected = {};
    room.game.endsAt = Date.now() + 15000;
  io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'replicate', creatorId: room.game.creatorId, endsAt: room.game.endsAt, pattern: room.game.pattern, mode: room.game.mode });
    clearTimeout(room.game.tReplicate);
    room.game.tReplicate = setTimeout(() => finishRound(roomId), 15000);
  };

  const finishRound = (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    const pattern = room.game.pattern || [];
    const rows = [];
    Object.keys(room.players).forEach((sid) => {
      if (sid === room.game.creatorId) return;
      const sub = (room.game.submissions[sid] || []);
      let matches = 0;
      for (let i = 0; i < Math.min(pattern.length, sub.length); i++) {
        const expected = room.game.mode === 'reverse' ? pattern[pattern.length - 1 - i] : pattern[i];
        if (expected === sub[i]) matches++;
      }
      const base = (room.game.roundBase?.[sid] || 0);
      const baseAtt = (room.game.roundBaseAttempts?.[sid] || 0);
      room.game.scores[sid] = base + matches;
      room.game.attempts[sid] = baseAtt + sub.length;
      const p = getPlayersState()[sid];
      if (!p) return;
      p.score = toPercent(room.game.scores[sid], room.game.attempts[sid]);
      const sock = io.sockets.sockets.get(sid);
      const userId = sock?.data?.userId || null;
      if (userId) {
        rows.push({ userId, correct: room.game.scores[sid], attempts: room.game.attempts[sid], percent: p.score, nickname: getPlayersState()[sid]?.nickname || '' });
      }
    });

    // Check if game is over (all turns completed)
    const isGameOver = (room.game.currentTurn + 1 >= room.game.totalTurns);

    // CRITICAL FIX: Only persist results at game end, not every turn
    if (isGameOver && persistResults && rows.length > 0) {
      persistResults(rows);
    }

    broadcastGameState();

    // Check if we should continue or end the game
    if (!isGameOver) {
      room.game.currentTurn += 1;

      // Check if we just completed a round (all players had a turn)
      const justCompletedRound = (room.game.currentTurn % room.game.order.length === 0);

      if (justCompletedRound && room.game.currentRound < room.game.numRounds) {
        // Show round summary
        room.game.phase = 'round_summary';
        const roundResults = room.game.order.map((sid) => ({
          id: sid,
          nickname: getPlayersState()[sid]?.nickname || null,
          score: toPercent(room.game.scores[sid] || 0, room.game.attempts?.[sid] || 0),
        }));
        io.to(roomId).emit('SERVER:ROUND_SUMMARY', {
          roomId,
          roundCompleted: room.game.currentRound,
          totalRounds: room.game.numRounds,
          results: roundResults
        });
        // 3-second pause before next round
        setTimeout(() => {
          room.game.phase = 'ended';
          io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'ended' });
          setTimeout(() => startCreatePhase(roomId), 1000);
        }, 3000);
      } else {
        // Continue to next turn within same round
        room.game.phase = 'ended';
        io.to(roomId).emit('SERVER:PHASE', { roomId, phase: 'ended' });
        setTimeout(() => startCreatePhase(roomId), 1000);
      }
      return;
    }

    // Game over - all turns completed
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


