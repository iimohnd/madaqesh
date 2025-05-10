const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

  await redis.set(roomCode, roomData, { ex: 60 * 60 * 12 });
  return { roomCode, roomData };
}

async function joinRoom(roomCode, username, socketId) {
  const room = await redis.get(roomCode);
  if (!room) return null;

  const nameExists = room.players.some((p) => p.name === username);
  if (nameExists) return { error: "Duplicate name" };

  room.players.push({
    id: socketId,
    name: username,
    balance: 10000,
  });

  // مهم: إعادة حفظ الغرفة وتحديث مدة التخزين
  await redis.set(roomCode, room, { ex: 60 * 60 * 12 });

  return room; // 💥 هذا السطر أساسي لتأكيد أن الرد يرجع للعميل
}

async function getRoom(roomCode) {
  return await redis.get(roomCode);
}

async function removeRoomIfEmpty(socketId) {
  const keys = await redis.keys("*");

  for (const key of keys) {
    const room = await redis.get(key);
    if (!room) continue;

    room.players = room.players.filter((p) => p.id !== socketId);

    if (room.players.length === 0) {
      await redis.del(key);
    } else {
      await redis.set(key, room, { ex: 60 * 60 * 12 });
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
};
