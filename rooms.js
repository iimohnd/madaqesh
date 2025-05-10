const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// توليد كود عشوائي للغرفة
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// إنشاء غرفة جديدة
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

  await redis.set(roomCode, JSON.stringify(roomData), { ex: 60 * 60 * 12 });
  console.log("✅ Created Room Code:", roomCode);

  return { roomCode, roomData };
}

// دخول غرفة موجودة
async function joinRoom(roomCode, username, socketId) {
  console.log("🟨 Trying to join room:", roomCode);

  const raw = await redis.get(roomCode);
  if (!raw) return null;

  const room = typeof raw === "string" ? JSON.parse(raw) : raw;

  console.log("🔎 Room found:", room);

  if (!room || !room.players) return null;

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

// جلب بيانات الغرفة
async function getRoom(roomCode) {
  const raw = await redis.get(roomCode);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// حذف الغرفة إذا أصبحت فارغة
async function removeRoomIfEmpty(socketId) {
  const keys = await redis.keys("*");

  for (const key of keys) {
    const raw = await redis.get(key);
    const room = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!room || !room.players) continue;

    const originalCount = room.players.length;

    room.players = room.players.filter((p) => p.id !== socketId);

    if (room.players.length === 0) {
      await redis.del(key);
      console.log(`🗑️ Deleted empty room: ${key}`);
    } else if (room.players.length < originalCount) {
      await redis.set(key, JSON.stringify(room), { ex: 60 * 60 * 12 });
      console.log(`📝 Updated room ${key}, removed player`);
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
};
