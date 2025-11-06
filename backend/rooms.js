import { generateRoomId } from './utils.js';

// Simple in-memory rooms store for the prototype
export const rooms = {}; // id -> room

export const CREATE_MAX_NOTES = 10;

// List rooms for lobby
export const listRooms = () => Object.values(rooms).map((r) => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity,
  count: Object.keys(r.players).length,
  mode: r.mode || 'classic',
}));

// Create a new room and return its id
export const createRoom = ({ name, capacity, mode, numRounds } = {}) => {
  const id = generateRoomId();
  const cap = Math.max(2, Math.min(12, Number(capacity) || 2));
  // Accept practice and ai modes, but convert ai to classic for now
  const m = (mode === 'perfect' || mode === 'reverse' || mode === 'practice') ? mode : 'classic';
  // Validate numRounds: 1-5 rounds, default to 1
  const rounds = Math.max(1, Math.min(5, Number(numRounds) || 1));
  rooms[id] = { id, name: String(name || `Room ${id}`), capacity: cap, players: {}, ready: {}, joinOrder: [], mode: m, numRounds: rounds };
  return id;
};

// Snapshot sent to clients
export const getRoomSnapshot = (roomId, playersState) => {
  const room = rooms[roomId];
  if (!room) return null;
  const attemptsMap = room.game?.attempts || {};
  const rejectedMap = room.game?.rejected || {};
  const players = Object.keys(room.players).map((sid) => {
    const p = playersState[sid];
    return p
      ? { id: p.id, nickname: p.nickname, score: p.score, attempts: attemptsMap[sid] || 0, rejected: rejectedMap[sid] || 0 }
      : { id: sid, nickname: null, score: 0, attempts: attemptsMap[sid] || 0, rejected: rejectedMap[sid] || 0 };
  });
  const ready = Object.keys(room.ready || {}).filter((sid) => room.ready[sid]);
  return { id: room.id, name: room.name, capacity: room.capacity, players, ready, mode: room.mode || 'classic' };
};

// Check if a room is in practice mode
export const isPracticeRoom = (roomId) => {
  const room = rooms[roomId];
  return room && room.mode === 'practice';
};



