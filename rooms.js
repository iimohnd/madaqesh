// rooms.js (Redis version)

const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
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
  await redis.set(roomCode, roomData);
  return { roomCode, roomData };
}

async function joinRoom(roomCode, username, socketId) {
  const room = await redis.get(roomCode);
  if (!room) return null;

  // منع تكرار الاسم
  const nameExists = room.players.some((p) => p.name === username);
  if (nameExists) return { error: "Duplicate name" };

  room.players.push({
    id: socketId,
    name: username,
    balance: 10000,
  });

  await redis.set(roomCode, room);
  return room;
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
      await redis.set(key, room);
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
};
