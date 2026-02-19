/**
 * WebSocket Module for IOPHIN — Real-Time Alerts via Socket.IO
 */

let io = null;

export async function initWebSocket(httpServer) {
  const { Server } = await import('socket.io');
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 WebSocket client connected: ${socket.id}`);

    socket.on('subscribe-lga', (lgaName) => {
      if (lgaName) socket.join(`lga:${lgaName}`);
    });

    socket.on('subscribe-state', (state) => {
      if (state) socket.join(`state:${state}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitAlert(ioInstance, type, payload) {
  const target = ioInstance || io;
  if (!target) return;
  const event = { type, ...payload, timestamp: new Date().toISOString() };
  target.emit('alert', event);
  if (payload.lga_name) target.to(`lga:${payload.lga_name}`).emit('lga-update', payload);
  if (payload.state) target.to(`state:${payload.state}`).emit('state-update', payload);
}

export function getIO() { return io; }
