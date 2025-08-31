## DupMe Incremental Plan (Prototype-first, simple-by-default)

Phase 1 — Identity and presence (this PR)

- Add nickname prompt on client after socket connects
- Server stores `players[socketId] = { id, nickname, score }`
- Broadcast `onlineUsers` so both clients see who is online

Phase 2 — Minimal game loop (2 players only)

- Ready button for each player; game starts when both are ready
- Randomize first creator; 10s create window; then 20s replicate window
- Score = number of correct notes in order
- End after each player has created once; show winner

Phase 3 — Rooms (lightweight, no DB)

- Server maintains `rooms: { [roomId]: RoomState }`
- Players can create/join room; ready-up per room
- Game loop runs per room with same logic as Phase 2

Phase 4 — Quality of life

- Simple server admin page: connected count + reset
- Nickname validation and persistence in localStorage
- Basic error toasts and reconnection handling

Notes

- Avoid DB for now; keep all state in-memory
- Keep functions small and pure; single-responsibility utilities for timers
- Types shared on client; server uses plain objects for simplicity
