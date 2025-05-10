const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
} = require("./rooms");

const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("🔌 New connection", socket.id);

  socket.on("createRoom", async (username, callback) => {
    const { roomCode, roomData } = await createRoom(username, socket.id);
    socket.join(roomCode);
    socket.roomCode = roomCode; // نحتفظ بالكود داخل الجلسة
    io.to(roomCode).emit("updatePlayers", roomData.players);
    callback(roomCode);
  });

  socket.on("joinRoom", async ({ username, roomCode }, callback) => {
    console.log("🟨 Trying to join room:", roomCode);
    const room = await joinRoom(roomCode, username, socket.id);
    console.log("🔎 Room found:", room);
    if (!room) return callback({ error: "Room not found" });
    if (room.error === "Duplicate name")
      return callback({ error: "Duplicate name" });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    io.to(roomCode).emit("updatePlayers", room.players);
    callback({ success: true });
  });

  socket.on("updateBalance", async ({ roomCode, amount }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.balance += amount;
      await redis.set(roomCode, JSON.stringify(room), { ex: 60 * 60 * 12 });
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  socket.on("manualUpdate", async ({ roomCode, playerId, newBalance }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player && socket.id === room.ownerId) {
      player.balance = newBalance;
      await redis.set(roomCode, JSON.stringify(room), { ex: 60 * 60 * 12 });
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  socket.on("deleteRoom", async (roomCode) => {
    await redis.del(roomCode);
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
