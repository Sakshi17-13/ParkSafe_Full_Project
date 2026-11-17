import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Owner from '../src/models/Owner.js';
import { requireAuth } from '../src/middleware.js';
import { registerFcmToken, removeFcmToken } from '../src/routes/auth.js';

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('FCM token registration is scoped to the JWT owner and removes a device token from other owners', async () => {
  const originalUpdateMany = Owner.updateMany;
  const originalFindByIdAndUpdate = Owner.findByIdAndUpdate;
  const ownerId = new mongoose.Types.ObjectId().toString();
  const calls = [];
  Owner.updateMany = async (...args) => calls.push(['updateMany', ...args]);
  Owner.findByIdAndUpdate = async (...args) => { calls.push(['findByIdAndUpdate', ...args]); return { _id: ownerId }; };
  try {
    const res = response();
    await registerFcmToken({ owner: { id: ownerId }, body: { token: 'fcm-demo-token' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.deepEqual(calls, [
      ['updateMany', { _id: { $ne: ownerId }, fcmTokens: 'fcm-demo-token' }, { $pull: { fcmTokens: 'fcm-demo-token' } }],
      ['findByIdAndUpdate', ownerId, { $addToSet: { fcmTokens: 'fcm-demo-token' } }, { new: false }],
    ]);
  } finally {
    Owner.updateMany = originalUpdateMany;
    Owner.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('FCM token registration rejects an empty token without touching MongoDB', async () => {
  const originalFindByIdAndUpdate = Owner.findByIdAndUpdate;
  let updated = false;
  Owner.findByIdAndUpdate = async () => { updated = true; };
  try {
    const res = response();
    await registerFcmToken({ owner: { id: 'owner-id' }, body: { token: ' ' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.equal(updated, false);
  } finally {
    Owner.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('protected FCM route middleware derives the owner ID from the signed JWT', () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'parksafe-test-signing-key';
  try {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const req = { headers: { authorization: `Bearer ${jwt.sign({ id: ownerId }, process.env.JWT_SECRET)}` } };
    let proceeded = false;
    requireAuth(req, response(), error => { if (error) throw error; proceeded = true; });
    assert.equal(proceeded, true);
    assert.equal(req.owner.id, ownerId);
  } finally {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('FCM token removal is limited to the authenticated owner', async () => {
  const originalUpdateOne = Owner.updateOne;
  const ownerId = new mongoose.Types.ObjectId().toString();
  let call;
  Owner.updateOne = async (...args) => { call = args; };
  try {
    const res = response();
    await removeFcmToken({ owner: { id: ownerId }, body: { token: 'device-token' } }, res, error => { throw error; });
    assert.deepEqual(call, [{ _id: ownerId }, { $pull: { fcmTokens: 'device-token' } }]);
    assert.deepEqual(res.body, { ok: true });
  } finally {
    Owner.updateOne = originalUpdateOne;
  }
});
