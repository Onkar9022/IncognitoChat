

import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: PORT });

interface User {
  socket: WebSocket;
  room: string;
}

/* ===========================
   DATA STRUCTURES
=========================== */
const users = new Map<WebSocket, User>();
const rooms = new Map<string, Set<WebSocket>>();

const MAX_USERS_PER_ROOM = 2;

/* ===========================
   ROOM ID GENERATOR
=========================== */
function generateRoomId(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function createUniqueRoomId(): string {
  let id: string;
  do {
    id = generateRoomId();
  } while (rooms.has(id));
  return id;
}

/* ===========================
   USER COUNT BROADCAST
=========================== */
function broadcastUserCount(roomId: string) {
  const roomSockets = rooms.get(roomId);
  if (!roomSockets) return;

  const countPayload = JSON.stringify({
    type: "user-count",
    payload: {
      count: roomSockets.size,
      max: MAX_USERS_PER_ROOM,
    },
  });

  roomSockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(countPayload);
    }
  });
}

/* ===========================
   CONNECTION
=========================== */
wss.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("message", (data) => {
    let message: any;

    try {
      message = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({
        type: "error",
        payload: { message: "Invalid JSON format" },
      }));
      return;
    }

    /* =======================
       CREATE ROOM
    ======================= */
    if (message.type === "create-room") {
      if (users.has(socket)) return;

      const roomId = createUniqueRoomId();

      users.set(socket, { socket, room: roomId });
      rooms.set(roomId, new Set([socket]));

      socket.send(JSON.stringify({
        type: "room-created",
        payload: { room: roomId },
      }));

      broadcastUserCount(roomId);
      return;
    }

    /* =======================
       JOIN ROOM
    ======================= */
    if (message.type === "join-room") {
      const { room } = message.payload || {};

      if (!room || !rooms.has(room)) {
        socket.send(JSON.stringify({
          type: "error",
          payload: { message: "Room does not exist" },
        }));
        return;
      }

      const roomSockets = rooms.get(room)!;

      if (roomSockets.size >= MAX_USERS_PER_ROOM) {
        socket.send(JSON.stringify({
          type: "error",
          payload: { message: "Room is full" },
        }));
        return;
      }

      users.set(socket, { socket, room });
      roomSockets.add(socket);

      socket.send(JSON.stringify({
        type: "joined",
        payload: { room },
      }));

      broadcastUserCount(room);
      return;
    }

    const user = users.get(socket);
    if (!user) return;

    const roomSockets = rooms.get(user.room);
    if (!roomSockets) return;

    /* =======================
       TYPING
    ======================= */
    if (message.type === "typing") {
      const payload = JSON.stringify({
        type: "typing",
        payload: { typing: message.payload.typing },
      });

      roomSockets.forEach((client) => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
      return;
    }

    /* =======================
       MESSAGE
    ======================= */
    if (message.type === "message") {
      const { id, text } = message.payload || {};
      if (!id || !text) return;

      const chatPayload = JSON.stringify({
        type: "message",
        payload: { id, message: text },
      });
roomSockets.forEach((client) => {
  if (client !== socket && client.readyState === WebSocket.OPEN) {
    client.send(chatPayload);
  }
});


      socket.send(JSON.stringify({
        type: "delivered",
        payload: { id },
      }));
      return;
    }

    /* =======================
       SEEN
    ======================= */
    if (message.type === "seen") {
      const { id } = message.payload || {};
      if (!id) return;

      const seenPayload = JSON.stringify({
        type: "seen",
        payload: { id },
      });

      roomSockets.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(seenPayload);
        }
      });
    }
  });

  /* =======================
     CLEANUP ON DISCONNECT
  ======================= */
  socket.on("close", () => {
    const user = users.get(socket);
    if (!user) return;

    const roomSockets = rooms.get(user.room);
    roomSockets?.delete(socket);

    if (roomSockets && roomSockets.size === 0) {
      rooms.delete(user.room); // ✅ ROOM DISMISSED
      console.log(`Room ${user.room} dismissed`);
    } else {
      broadcastUserCount(user.room);
    }

    users.delete(socket);
    console.log("Client disconnected");
  });
});

console.log("WebSocket server running on ws://localhost:8080");
