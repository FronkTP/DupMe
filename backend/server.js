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

const broadcastGameState = () => {
  io.emit('gameStateUpdate', gameState);
  console.log('--- Game State Broadcast jaade bhaiye 😎 ---');
  console.log(JSON.stringify(gameState, null, 2)); 
  console.log('--------------------------');
};

io.on('connection', (socket) => {
  console.log(`✅ A user is trying to connect: ${socket.id}`);


  if (Object.keys(gameState.players).length >= 2) {
    console.log(`🚨 Game is full. Rejecting connection for ${socket.id}`);
    socket.emit('SERVER:GAME_FULL', 'Sorry, the game is already in progress.');
    socket.disconnect(true); 
    return; 
  }

  // If the game is not full, proceed with adding the player.
  console.log(`Connection accepted for ${socket.id}`);
  gameState.players[socket.id] = {
    id: socket.id,
    score: 0,
  };

  if (Object.keys(gameState.players).length === 2 && gameState.gameStatus === 'WAITING') {
    gameState.gameStatus = 'CREATING_PATTERN';
    const playerIds = Object.keys(gameState.players);
    gameState.currentPlayerTurn = playerIds[Math.floor(Math.random() * playerIds.length)];
    console.log(`Game starting! First player is ${gameState.currentPlayerTurn}`);
  }

  broadcastGameState();

  socket.on('CLIENT:SUBMIT_NOTE', (note) => {
    console.log(`Received note: ${note} from ${socket.id}`);
    if (gameState.currentPlayerTurn === socket.id) {
      gameState.currentPattern.push(note);
      broadcastGameState();
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ A user disconnected: ${socket.id}`);

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

server.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on port ${PORT}`);
});

