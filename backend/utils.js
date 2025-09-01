

// Whole-number percent from correct/attempts
export const toPercent = (correct, attempts) => attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

// Short id for rooms
export const generateRoomId = () => Math.random().toString(36).slice(2, 6).toUpperCase();

// No-op guard
export const noop = () => {};


