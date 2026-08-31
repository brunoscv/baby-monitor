import { createServer } from 'node:http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;

// roomId -> { token, broadcasterSocketId }
const rooms = new Map();

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('create-room', ({ roomId, token }) => {
    rooms.set(roomId, { token, broadcasterSocketId: socket.id });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'broadcaster';
  });

  socket.on('join-room', ({ roomId, token }) => {
    const room = rooms.get(roomId);
    if (!room || room.token !== token) {
      socket.emit('join-error', { reason: 'invalid-room-or-token' });
      return;
    }
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'viewer';
    socket.to(roomId).emit('viewer-joined');
  });

  // A sala tem no máximo broadcaster + 1 viewer (fase 1), então só precisa
  // repassar pro outro membro da sala — sem precisar rotear por socket id.
  socket.on('webrtc-offer', (payload) => relay(socket, 'webrtc-offer', payload));
  socket.on('webrtc-answer', (payload) => relay(socket, 'webrtc-answer', payload));
  socket.on('ice-candidate', (payload) => relay(socket, 'ice-candidate', payload));

  socket.on('disconnect', () => {
    const { roomId, role } = socket.data;
    if (!roomId) return;
    if (role === 'broadcaster') {
      rooms.delete(roomId);
      socket.to(roomId).emit('broadcaster-left');
    } else {
      socket.to(roomId).emit('viewer-left');
    }
  });
});

function relay(socket, event, payload) {
  const { roomId } = socket.data;
  if (roomId) socket.to(roomId).emit(event, payload);
}

httpServer.listen(PORT, () => console.log(`signaling server ouvindo em :${PORT}`));
