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

  // إنشاء غرفة
  socket.on("createRoom", async (username, callback) => {
    const { roomCode, roomData } = await createRoom(username, socket.id);
    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", roomData.players);
    callback(roomCode);
  });

  // دخول غرفة
  socket.on("joinRoom", async ({ username, roomCode }, callback) => {
    const room = await joinRoom(roomCode, username, socket.id);
    if (!room) return callback({ error: "Room not found" });
    if (room.error === "Duplicate name")
      return callback({ error: "Duplicate name" });

    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", room.players);
    callback({ success: true });
  });

  // تحديث رصيد اللاعب الحالي
  socket.on("updateBalance", async ({ roomCode, amount }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.balance += amount;
      await redis.set(roomCode, room, { ex: 60 * 60 * 12 }); // جدد التخزين 12 ساعة
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  // تعديل يدوي من المشرف
  socket.on("manualUpdate", async ({ roomCode, playerId, newBalance }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player && socket.id === room.ownerId) {
      player.balance = newBalance;
      await redis.set(roomCode, room, { ex: 60 * 60 * 12 });
      io.to(roomCode).emit("updatePlayers", room.players);
    }
  });

  // حذف الغرفة يدويًا من المشرف
  socket.on("deleteRoom", async (roomCode) => {
    await redis.del(roomCode);
  });

  // عند الخروج
  socket.on("disconnect", async () => {
    console.log("❌ Disconnected", socket.id);
    await removeRoomIfEmpty(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
