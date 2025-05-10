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

  socket.on("createRoom", async (username, callback) => {
    const { roomCode, roomData } = await createRoom(username, socket.id);
    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", roomData.players);
    callback(roomCode);
  });

  socket.on("joinRoom", async ({ username, roomCode }, callback) => {
    const room = await joinRoom(roomCode, username, socket.id);
    if (!room) return callback({ error: "Room not found" });
    if (room.error === "Duplicate name") return callback({ error: "Duplicate name" });
    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", room.players);
    callback({ success: true });
  });

  socket.on("updateBalance", async ({ roomCode, amount }) => {
    const room = await getRoom(roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.balance += amount;
      await redis.set(roomCode, room); // احفظ التحديث في Redis
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  socket.on("manualUpdate", async ({ roomCode, playerId, newBalance }) => {
    const room = await getRoom(roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player && socket.id === room.ownerId) {
      player.balance = newBalance;
      await redis.set(roomCode, room); // احفظ التحديث في Redis
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  socket.on("disconnect", async () => {
    console.log("❌ Disconnected", socket.id);
    await removeRoomIfEmpty(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
socket.on("deleteRoom", async (roomCode) => {
    await redis.del(roomCode);
  });
  