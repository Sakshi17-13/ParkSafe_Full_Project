import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware.js';
import { sendPushToOwner } from '../services/pushNotifications.js';
const router = Router();
const visitorTokenHash = token => createHash('sha256').update(token).digest('hex');

export async function postPublicMessage(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Vehicle not found' });
    const content = String(req.body.message || '').trim();
    if (!content || content.length > 500) return res.status(400).json({ message: 'Message must be between 1 and 500 characters.' });
    const vehicle = await Vehicle.findOne({ _id: req.params.id, active: true }).select('_id ownerId number');
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found or inactive' });
    const conversationToken = randomBytes(32).toString('base64url');
    const message = await Message.create({ vehicleId: vehicle._id, content, visitorTokenHash: visitorTokenHash(conversationToken) });
    if (process.env.PARKSAFE_DIAGNOSTICS === 'true') console.info('[messages] saved public message', { vehicleId: String(vehicle._id), ownerId: String(vehicle.ownerId), messageId: String(message._id) });
    void sendPushToOwner(vehicle.ownerId, {
      title: 'New ParkSafe message',
      body: `A visitor sent a message about ${vehicle.number}.`,
      data: { type: 'message', vehicleId: String(vehicle._id), vehicleNumber: vehicle.number, messageId: String(message._id) },
    });
    req.app.get('io')?.to(`owner:${vehicle.ownerId}`).emit('new-message', { id: message._id, vehicleNumber: vehicle.number, content, createdAt: message.createdAt });
    res.status(201).json({
      ok: true,
      message: 'Message sent to the vehicle owner.',
      conversationToken,
      conversation: {
        id: String(message._id),
        content: message.content,
        reply: message.reply || '',
        replyAt: message.replyAt || null,
        createdAt: message.createdAt,
      },
    });
  } catch (e) { next(e); }
}
router.post('/public/:id/messages', postPublicMessage);
export async function getPublicConversation(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Conversation not found' });
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token || token.length > 200) return res.status(404).json({ message: 'Conversation not found' });
    const conversation = await Message.findOne({
      vehicleId: req.params.id,
      visitorTokenHash: visitorTokenHash(token),
    }).select('_id content reply replyAt createdAt');
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    res.json({
      conversation: {
        id: String(conversation._id),
        content: conversation.content,
        reply: conversation.reply || '',
        replyAt: conversation.replyAt || null,
        createdAt: conversation.createdAt,
      },
    });
  } catch (e) { next(e); }
}
router.get('/public/:id/conversation', getPublicConversation);
router.get('/mine', requireAuth, async (req, res, next) => {
  try { const vehicles = await Vehicle.find({ ownerId: req.owner.id }).select('_id number'); const ids = vehicles.map(v => v._id); const map = new Map(vehicles.map(v => [String(v._id), v.number])); const messages = await Message.find({ vehicleId: { $in: ids } }).select('_id vehicleId content reply replyAt readAt createdAt updatedAt').sort({ createdAt: -1 }).limit(100).lean(); if (process.env.PARKSAFE_DIAGNOSTICS === 'true') console.info('[messages] owner inbox query', { ownerId: String(req.owner.id), vehicleCount: vehicles.length, messageCount: messages.length }); res.json({ messages: messages.map(m => ({ ...m, vehicleNumber: map.get(String(m.vehicleId)) || '' })) }); } catch (e) { next(e); }
});
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try { const vehicles = await Vehicle.find({ ownerId: req.owner.id }).select('_id'); const ids = vehicles.map(v => v._id); const m = await Message.findOneAndUpdate({ _id: req.params.id, vehicleId: { $in: ids } }, { readAt: new Date() }, { new: true }); if (!m) return res.status(404).json({ message: 'Message not found' }); res.json({ ok: true }); } catch (e) { next(e); }
});
export async function patchOwnerReply(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Message not found' });
    const reply = String(req.body.reply || '').trim();
    if (!reply || reply.length > 500) return res.status(400).json({ message: 'Reply must be between 1 and 500 characters.' });
    const vehicles = await Vehicle.find({ ownerId: req.owner.id }).select('_id');
    const m = await Message.findOneAndUpdate(
      { _id: req.params.id, vehicleId: { $in: vehicles.map(v => v._id) } },
      { $set: { reply, replyAt: new Date() } },
      { new: true },
    ).select('_id vehicleId content reply replyAt readAt createdAt updatedAt');
    if (!m) return res.status(404).json({ message: 'Message not found' });
    res.json({ ok: true, message: m });
  } catch (e) { next(e); }
}
router.patch('/:id/reply', requireAuth, patchOwnerReply);
export default router;
