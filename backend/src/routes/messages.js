import { Router } from 'express';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware.js';
const router = Router();
export async function postPublicMessage(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Vehicle not found' });
    const content = String(req.body.message || '').trim();
    if (!content || content.length > 500) return res.status(400).json({ message: 'Message must be between 1 and 500 characters.' });
    const vehicle = await Vehicle.findOne({ _id: req.params.id, active: true }).select('_id ownerId number');
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found or inactive' });
    const message = await Message.create({ vehicleId: vehicle._id, content });
    req.app.get('io')?.to(`owner:${vehicle.ownerId}`).emit('new-message', { id: message._id, vehicleNumber: vehicle.number, content, createdAt: message.createdAt });
    res.status(201).json({ ok: true, message: 'Message sent to the vehicle owner.' });
  } catch (e) { next(e); }
}
router.post('/public/:id/messages', postPublicMessage);
router.get('/mine', requireAuth, async (req, res, next) => {
  try { const vehicles = await Vehicle.find({ ownerId: req.owner.id }).select('_id number'); const ids = vehicles.map(v => v._id); const map = new Map(vehicles.map(v => [String(v._id), v.number])); const messages = await Message.find({ vehicleId: { $in: ids } }).sort({ createdAt: -1 }).limit(100).lean(); res.json({ messages: messages.map(m => ({ ...m, vehicleNumber: map.get(String(m.vehicleId)) || '' })) }); } catch (e) { next(e); }
});
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try { const vehicles = await Vehicle.find({ ownerId: req.owner.id }).select('_id'); const ids = vehicles.map(v => v._id); const m = await Message.findOneAndUpdate({ _id: req.params.id, vehicleId: { $in: ids } }, { readAt: new Date() }, { new: true }); if (!m) return res.status(404).json({ message: 'Message not found' }); res.json({ ok: true }); } catch (e) { next(e); }
});
router.patch('/:id/reply', requireAuth, async (req, res, next) => {
  try { const reply = String(req.body.reply || '').trim(); if (!reply || reply.length > 500) return res.status(400).json({ message: 'Reply must be between 1 and 500 characters.' }); const vehicles = await Vehicle.find({ ownerId: req.owner.id }).select('_id'); const m = await Message.findOneAndUpdate({ _id: req.params.id, vehicleId: { $in: vehicles.map(v => v._id) } }, { reply }, { new: true }); if (!m) return res.status(404).json({ message: 'Message not found' }); res.json({ ok: true, message: m }); } catch (e) { next(e); }
});
export default router;
