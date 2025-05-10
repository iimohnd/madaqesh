const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 🔢 توليد كود الغرفة
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4 أرقام
}

// ✅ إنشاء غرفة
async function createRoom(username) {
  const roomCode = generateRoomCode();
  const roomData = {
    ownerName: username,
    players: [
      {
        id: username, // نستخدم الاسم كمعرف ثابت
        name: username,
        balance: 10000,
      },
    ],
    createdAt: Date.now(),
  };

  await redis.set(roomCode, JSON.stringify(roomData), { ex: 60 * 60 * 4 });
  console.log("✅ Created Room Code:", roomCode);

  return { roomCode, roomData };
}

// ✅ دخول غرفة
async function joinRoom(roomCode, username) {
  const raw = await redis.get(roomCode);
  const room = typeof raw === "string" ? JSON.parse(raw) : raw;

  if (!room) return null;

  // إذا الاسم موجود فعلاً، نسمح له يرجع بدون تكرار
  const nameExists = room.players.some((p) => p.name === username);
  if (nameExists) return { error: "Duplicate name" };

  room.players.push({
    id: username,
    name: username,
    balance: 10000,
  });

  await redis.set(roomCode, JSON.stringify(room), { ex: 60 * 60 * 4 });
  return room;
}

// ✅ الحصول على بيانات الغرفة
async function getRoom(roomCode) {
  const raw = await redis.get(roomCode);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// ✅ حذف لاعب من الغرفة (عند الفصل)
async function removeRoomIfEmpty(socketIdOrName) {
  const keys = await redis.keys("*");

  for (const key of keys) {
    const raw = await redis.get(key);
    const room = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!room) continue;

    const originalCount = room.players.length;
    room.players = room.players.filter((p) => p.id !== socketIdOrName);

    if (room.players.length === 0) {
      await redis.del(key);
      console.log(`🗑️ Deleted empty room: ${key}`);
    } else if (room.players.length < originalCount) {
      await redis.set(key, JSON.stringify(room), { ex: 60 * 60 * 4 });
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
