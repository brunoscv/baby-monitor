import { createServer } from 'node:http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;

// roomId -> { token, broadcasterSocketId, viewers: Map<socketId, { joinedAt }> }
const rooms = new Map();

// endpoint leve pra tela "câmeras recentes" do viewer checar se uma sala segue
// online sem precisar abrir socket + WebRTC só pra descobrir isso.
const httpServer = createServer((req, res) => {
  const match = req.method === 'GET' && req.url.match(/^\/rooms\/([^/?]+)\/status/);
  if (match) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ online: rooms.has(match[1]) }));
  }
});
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('create-room', ({ roomId, token }) => {
    rooms.set(roomId, { token, broadcasterSocketId: socket.id, viewers: new Map() });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'broadcaster';
  });

  // Fase 2: sala aceita múltiplos viewers (ex.: celular do casal). Cada viewer
  // negocia sua própria RTCPeerConnection com o broadcaster, por isso todo
  // sinal precisa ser roteado por targetId em vez de broadcast pra sala toda.
  socket.on('join-room', ({ roomId, token }) => {
    const room = rooms.get(roomId);
    if (!room || room.token !== token) {
      socket.emit('join-error', { reason: 'invalid-room-or-token' });
      return;
    }
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'viewer';
    room.viewers.set(socket.id, { joinedAt: Date.now() });
    io.to(room.broadcasterSocketId).emit('viewer-joined', { viewerId: socket.id });
  });

  socket.on('webrtc-offer', ({ targetId, sdp }) => relayTo(socket, targetId, 'webrtc-offer', { sdp }));
  socket.on('webrtc-answer', ({ targetId, sdp }) => relayTo(socket, targetId, 'webrtc-answer', { sdp }));
  socket.on('ice-candidate', ({ targetId, candidate }) => relayTo(socket, targetId, 'ice-candidate', { candidate }));

  socket.on('kick-viewer', ({ roomId, viewerId }) => {
    const room = rooms.get(roomId);
    if (!room || room.broadcasterSocketId !== socket.id) return;
    room.viewers.delete(viewerId);
    io.to(viewerId).emit('kicked');
    io.sockets.sockets.get(viewerId)?.leave(roomId);
  });

  socket.on('disconnect', () => {
    const { roomId, role } = socket.data;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (role === 'broadcaster') {
      rooms.delete(roomId);
      socket.to(roomId).emit('broadcaster-left');
    } else {
      room.viewers.delete(socket.id);
      io.to(room.broadcasterSocketId).emit('viewer-left', { viewerId: socket.id });
    }
  });
});

function relayTo(fromSocket, targetId, event, payload) {
  if (!targetId) return;
  io.to(targetId).emit(event, { ...payload, fromId: fromSocket.id });
}

httpServer.listen(PORT, () => console.log(`signaling server ouvindo em :${PORT}`));
