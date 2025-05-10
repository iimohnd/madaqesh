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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("🔌 اتصال جديد:", socket.id);

  // إنشاء غرفة
  socket.on("createRoom", async (username, callback) => {
    const { roomCode, roomData } = await createRoom(username, socket.id);

    socket.join(roomCode);
    socket.roomCode = roomCode;

    io.to(roomCode).emit("updatePlayers", {
      players: roomData.players,
      ownerId: roomData.ownerId,
    });

    callback(roomCode);
  });

  // دخول غرفة
  socket.on("joinRoom", async ({ username, roomCode }, callback) => {
    console.log("🟨 يحاول دخول الغرفة:", roomCode);

    const room = await joinRoom(roomCode, username, socket.id);

    if (!room) {
      console.log("❌ الغرفة غير موجودة");
      return callback({ error: "Room not found" });
    }

    if (room.error === "Duplicate name") {
      console.log("❌ اسم مكرر");
      return callback({ error: "Duplicate name" });
    }

    socket.join(roomCode);
    socket.roomCode = roomCode;

    io.to(roomCode).emit("updatePlayers", {
      players: room.players,
      ownerId: room.ownerId,
    });

    callback({ success: true });
  });

  // تحديث الرصيد
  socket.on("updateBalance", async ({ roomCode, amount }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.balance += amount;

      await saveRoom(roomCode, room);

      io.to(roomCode).emit("updatePlayers", {
        players: room.players,
        ownerId: room.ownerId,
      });
    }
  });

  // تعديل الرصيد يدويًا (للمشرف)
  socket.on("manualUpdate", async ({ roomCode, playerId, newBalance }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    if (socket.id !== room.ownerId) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.balance = newBalance;

      await saveRoom(roomCode, room);

      io.to(roomCode).emit("updatePlayers", {
        players: room.players,
        ownerId: room.ownerId,
      });
    }
  });

  // حذف الغرفة
  socket.on("deleteRoom", async (roomCode) => {
    const { Redis } = require("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    await redis.del(roomCode);
    console.log("🚫 تم حذف الغرفة:", roomCode);
  });

  // عند فصل الاتصال
  socket.on("disconnect", async () => {
    console.log("❌ تم فصل:", socket.id);
    await removeRoomIfEmpty(socket.id);
  });
});

async function saveRoom(roomCode, data) {
  const { Redis } = require("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  await redis.set(roomCode, JSON.stringify(data), { ex: 60 * 60 * 12 });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
