import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Owner from '../models/Owner.js';
import { requireAuth } from '../middleware.js';
const router = Router();
function tokenFor(owner) { return jwt.sign({ id: owner._id.toString(), name: owner.name, email: owner.email }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Name, email and password (8+ characters) are required.' });
    const normalized = email.trim().toLowerCase();
    if (await Owner.findOne({ email: normalized })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const owner = await Owner.create({ name: name.trim(), email: normalized, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: tokenFor(owner), owner: { id: owner._id, name: owner.name, email: owner.email } });
  } catch (e) { next(e); }
});
router.post('/login', async (req, res, next) => {
  try {
    const owner = await Owner.findOne({ email: String(req.body.email || '').trim().toLowerCase() });
    if (!owner || !await bcrypt.compare(String(req.body.password || ''), owner.passwordHash)) return res.status(401).json({ message: 'Invalid email or password.' });
    res.json({ token: tokenFor(owner), owner: { id: owner._id, name: owner.name, email: owner.email } });
  } catch (e) { next(e); }
});
router.get('/me', requireAuth, async (req, res, next) => {
  try { const owner = await Owner.findById(req.owner.id).select('name email'); if (!owner) return res.status(404).json({ message: 'Account not found' }); res.json({ owner: { id: owner._id, name: owner.name, email: owner.email } }); } catch (e) { next(e); }
});
export default router;
