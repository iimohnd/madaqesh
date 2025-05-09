// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { createRoom, joinRoom, getRoom, removeRoomIfEmpty } = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Socket.io logic
io.on("connection", (socket) => {
  console.log("🔌 New connection", socket.id);

  socket.on("createRoom", (username, callback) => {
    const { roomCode, roomData } = createRoom(username, socket.id);
    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", roomData.players);
    callback(roomCode);
  });

  socket.on("joinRoom", ({ username, roomCode }, callback) => {
    const room = getRoom(roomCode);
    if (!room) return callback({ error: "Room not found" });

    const nameExists = room.players.some(p => p.name === username);
    if (nameExists) return callback({ error: "Duplicate name" });

    room.players.push({
      id: socket.id,
      name: username,
      balance: 10000,
    });
    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", room.players);
    callback({ success: true });
  });

  socket.on("updateBalance", ({ roomCode, amount }) => {
    const room = getRoom(roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.balance += amount;
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  socket.on("manualUpdate", ({ roomCode, playerId, newBalance }) => {
    const room = getRoom(roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player && socket.id === room.ownerId) {
      player.balance = newBalance;
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected", socket.id);
    removeRoomIfEmpty(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
