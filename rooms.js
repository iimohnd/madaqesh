const Redis = require("ioredis");

const redis = new Redis({
  host: "redis-14196.c328.europe-west3-1.gce.redns.redis-cloud.com",
  port: 14196,
  password: "qu0hwwkbQNqQXQRqmGxqkzRabYOuUwV2"
});

console.log("🔐 Redis URL:", process.env.UPSTASH_REDIS_REST_URL);

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createRoom(username, socketId) {
  const roomCode = generateRoomCode();
  const roomData = {
    ownerId: socketId,
    players: [
      {
        id: socketId,
        name: username,
        balance: 10000,
      },
    ],
    createdAt: Date.now(),
  };

  // نحفظ كـ JSON string
  await redis.set(roomCode, JSON.stringify(roomData), { ex: 60 * 60 * 12 });
  console.log("✅ Created Room Code:", roomCode);

  return { roomCode, roomData };
}

async function joinRoom(roomCode, username, socketId) {
    console.log("🟨 Trying to join room:", roomCode);
  
    const raw = await redis.get(roomCode);
    const room = typeof raw === "string" ? JSON.parse(raw) : raw;
  
    console.log("🔎 Room found:", room);
  
    if (!room) return null;
  

  const nameExists = room.players.some((p) => p.name === username);
  if (nameExists) return { error: "Duplicate name" };

  room.players.push({
    id: socketId,
    name: username,
    balance: 10000,
  });

  await redis.set(roomCode, JSON.stringify(room), { ex: 60 * 60 * 12 });
  return room;
}

async function getRoom(roomCode) {
  const raw = await redis.get(roomCode);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function removeRoomIfEmpty(socketId) {
    const keys = await redis.keys("*");
  
    for (const key of keys) {
      const raw = await redis.get(key);
      const room = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!room) continue;
  
      const originalCount = room.players.length;
  
      room.players = room.players.filter((p) => p.id !== socketId);
  
      // ✅ لا تحذف الغرفة مباشرة، فقط حدث القائمة
      await redis.set(key, JSON.stringify(room), { ex: 60 * 60 * 12 });
  
      // ❌ لا تحذف الغرفة حتى لو صارت فاضية – لأن المشرف ممكن يرجع خلال لحظات
    }
  }
  

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
};
