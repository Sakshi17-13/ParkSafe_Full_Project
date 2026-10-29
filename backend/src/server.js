import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import messageRoutes from './routes/messages.js';

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.port !== '5173') return false;
    const octets = url.hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    return octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
  } catch { return false; }
}
const corsOrigin = (origin, callback) => callback(null, isAllowedOrigin(origin));
const io = new Server(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE'] } });
app.set('io', io);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/public', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ParkSafe API' }));
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api', messageRoutes);
app.use((req, res) => res.status(404).json({ message: 'API route not found' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ message: 'Unexpected server error' }); });

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.owner = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { next(new Error('Invalid session')); }
});
const activeCalls = new Map(); // callId -> { visitorSocketId, ownerId }
io.on('connection', socket => {
  socket.join(`owner:${socket.owner.id}`);
  socket.on('call:join', ({ callId }) => { if (typeof callId === 'string') socket.join(`call:${callId}`); });
  socket.on('call:request', ({ vehicleId, callId }) => {
    // Only forward a request to the owner who owns the selected vehicle.
    import('./models/Vehicle.js').then(({ default: Vehicle }) => Vehicle.findById(vehicleId).then(v => {
      if (v && String(v.ownerId) === String(socket.owner.id)) socket.emit('call:error', { callId, message: 'Owner cannot call their own vehicle QR.' });
    })).catch(() => {});
  });
  socket.on('call:signal', payload => {
    if (!payload || typeof payload.callId !== 'string' || !['offer','answer','ice','accepted','rejected','ended'].includes(payload.type)) return;
    const active = activeCalls.get(payload.callId);
    if (!active || String(active.ownerId) !== String(socket.owner.id)) return;
    visitorNs.to(active.visitorSocketId).emit('call:signal', { ...payload, from: socket.id });
  });
  socket.on('disconnect', () => {});
});
// Visitor signaling namespace is intentionally separate from owner-authenticated socket.
const visitorNs = io.of('/visitor');
visitorNs.on('connection', socket => {
  socket.on('call:start', async ({ vehicleId, callId }) => {
    try {
      const { default: Vehicle } = await import('./models/Vehicle.js');
      const vehicle = await Vehicle.findById(vehicleId).select('ownerId active number');
      if (!vehicle || !vehicle.active || typeof callId !== 'string') return socket.emit('call:error', { message: 'Vehicle unavailable.' });
      socket.join(`call:${callId}`);
      activeCalls.set(callId, { visitorSocketId: socket.id, ownerId: String(vehicle.ownerId) });
      io.to(`owner:${vehicle.ownerId}`).emit('call:incoming', { callId, vehicleId, vehicleNumber: vehicle.number, visitorSocketId: socket.id });
      socket.data.callId = callId;
    } catch { socket.emit('call:error', { message: 'Unable to start call.' }); }
  });
  socket.on('call:signal', payload => {
    if (!payload || typeof payload.callId !== 'string' || !['offer','answer','ice','accepted','rejected','ended'].includes(payload.type)) return;
    // Owner sockets and visitor namespace exchange SDP/ICE through the same call room.
    const active = activeCalls.get(payload.callId);
    if (!active || active.visitorSocketId !== socket.id) return;
    io.to(`owner:${active.ownerId}`).emit('call:signal', { ...payload, from: socket.id });
    if (['ended','rejected'].includes(payload.type)) activeCalls.delete(payload.callId);
  });
});

const port = Number(process.env.PORT || 4000);
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error('Set MONGODB_URI and JWT_SECRET in backend/.env'); process.exit(1);
}
try { await mongoose.connect(process.env.MONGODB_URI); server.listen(port, () => console.log(`ParkSafe API listening on http://localhost:${port}`)); }
catch (e) { console.error('MongoDB connection failed:', e.message); process.exit(1); }
