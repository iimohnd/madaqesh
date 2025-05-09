// rooms.js

const rooms = {};

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

function createRoom(username, socketId) {
  const roomCode = generateRoomCode();
  rooms[roomCode] = {
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
  return { roomCode, roomData: rooms[roomCode] };
}

function joinRoom(roomCode, username, socketId) {
  const room = rooms[roomCode];
  if (!room) return null;
  room.players.push({
    id: socketId,
    name: username,
    balance: 10000,
  });
  return room;
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function removeRoomIfEmpty(socketId) {
  for (const [roomCode, room] of Object.entries(rooms)) {
    room.players = room.players.filter((p) => p.id !== socketId);
    if (room.players.length === 0) {
      delete rooms[roomCode];
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeRoomIfEmpty,
};
