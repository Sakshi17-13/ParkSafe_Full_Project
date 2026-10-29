import { Router } from 'express';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware.js';
const router = Router();
router.get('/mine', requireAuth, async (req, res, next) => { try { res.json({ vehicles: await Vehicle.find({ ownerId: req.owner.id }).sort({ createdAt: -1 }) }); } catch (e) { next(e); } });
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const number = String(req.body.number || '').trim().toUpperCase();
    const model = String(req.body.model || '').trim(); const color = String(req.body.color || '').trim();
    if (!/^[A-Z0-9 -]{4,20}$/.test(number) || !model || !color) return res.status(400).json({ message: 'Enter a valid vehicle number, model and color.' });
    const vehicle = await Vehicle.create({ ownerId: req.owner.id, number, model, color });
    res.status(201).json({ vehicle });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'This vehicle is already registered to your account.' }); next(e); }
});
router.patch('/:id', requireAuth, async (req, res, next) => {
  try { const vehicle = await Vehicle.findOneAndUpdate({ _id: req.params.id, ownerId: req.owner.id }, { $set: { number: String(req.body.number || '').trim().toUpperCase(), model: String(req.body.model || '').trim(), color: String(req.body.color || '').trim(), active: req.body.active !== false } }, { new: true, runValidators: true }); if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' }); res.json({ vehicle }); } catch (e) { next(e); }
});
router.delete('/:id', requireAuth, async (req, res, next) => { try { const v = await Vehicle.findOneAndDelete({ _id: req.params.id, ownerId: req.owner.id }); if (!v) return res.status(404).json({ message: 'Vehicle not found' }); await Message.deleteMany({ vehicleId: v._id }); res.json({ ok: true }); } catch (e) { next(e); } });
export async function getPublicVehicle(req, res, next) {
  try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Vehicle not found' }); const v = await Vehicle.findOne({ _id: req.params.id, active: true }).select('number model color'); if (!v) return res.status(404).json({ message: 'Vehicle not found or inactive' }); res.json({ vehicle: { id: v._id.toString(), number: v.number, model: v.model, color: v.color } }); } catch (e) { next(e); }
}
router.get('/public/:id', getPublicVehicle);
export default router;
