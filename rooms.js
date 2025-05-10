const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
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
  return { roomCode, roomData };
}

async function joinRoom(roomCode, username, socketId) {
  const raw = await redis.get(roomCode);
  const room = typeof raw === "string" ? JSON.parse(raw) : raw;
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

    room.players = room.players.filter((p) => p.id !== socketId);

    if (room.players.length === 0) {
      await redis.del(key);
    } else {
      await redis.set(key, JSON.stringify(room), { ex: 60 * 60 * 12 });
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
};
