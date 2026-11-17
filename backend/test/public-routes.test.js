import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { getPublicVehicle } from '../src/routes/vehicles.js';
import { getPublicConversation, patchOwnerReply, postPublicMessage } from '../src/routes/messages.js';
import Vehicle from '../src/models/Vehicle.js';
import Message from '../src/models/Message.js';

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('public vehicle lookup resolves the MongoDB _id used by the QR and omits owner data', async () => {
  const originalFindOne = Vehicle.findOne;
  const id = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  Vehicle.findOne = filter => ({
    select: async fields => {
      assert.deepEqual(filter, { _id: id.toString(), active: true });
      assert.equal(fields, 'number model color');
      return { _id: id, ownerId, number: 'DEMO-1234', model: 'Hatchback', color: 'Blue' };
    },
  });
  try {
    const res = response();
    await getPublicVehicle({ params: { id: id.toString() } }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      vehicle: { id: id.toString(), number: 'DEMO-1234', model: 'Hatchback', color: 'Blue' },
    });
  } finally {
    Vehicle.findOne = originalFindOne;
  }
});

test('anonymous message uses the public route and message field, persists, and notifies its owner', async () => {
  const originalFindOne = Vehicle.findOne;
  const originalCreate = Message.create;
  const id = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  let stored;
  let emitted;
  const vehicle = { _id: id, ownerId, number: 'DEMO-1234' };
  Vehicle.findOne = filter => ({
    select: async fields => {
      assert.deepEqual(filter, { _id: id.toString(), active: true });
      assert.equal(fields, '_id ownerId number');
      return vehicle;
    },
  });
  Message.create = async document => {
    stored = document;
    return {
      _id: new mongoose.Types.ObjectId(),
      content: document.content,
      reply: '',
      replyAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
  };
  try {
    const req = {
      params: { id: id.toString() },
      body: { message: 'Please move your car.' },
      app: { get: () => ({
      to(room) {
        return { emit(event, payload) { emitted = { room, event, payload }; } };
      },
      }) },
    };
    const res = response();
    await postPublicMessage(req, res, error => { throw error; });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.ok, true);
    assert.equal(String(stored.vehicleId), String(id));
    assert.equal(stored.content, 'Please move your car.');
    assert.match(stored.visitorTokenHash, /^[a-f0-9]{64}$/);
    assert.equal(res.body.conversation.content, 'Please move your car.');
    assert.equal(typeof res.body.conversationToken, 'string');
    assert.equal(res.body.conversationToken.length > 30, true);
    assert.notEqual(stored.visitorTokenHash, res.body.conversationToken);
    assert.equal(emitted.room, `owner:${ownerId}`);
    assert.equal(emitted.event, 'new-message');
    assert.equal(emitted.payload.content, 'Please move your car.');
    assert.equal(emitted.payload.vehicleNumber, vehicle.number);
  } finally {
    Vehicle.findOne = originalFindOne;
    Message.create = originalCreate;
  }
});

test('visitor conversation token retrieves only allowlisted data for its vehicle', async () => {
  const originalFindOne = Message.findOne;
  const id = new mongoose.Types.ObjectId();
  const token = 'visitor-secret-token';
  let receivedFilter;
  const conversation = {
    _id: new mongoose.Types.ObjectId(),
    content: 'Please move your car.',
    reply: 'I will move it now.',
    replyAt: new Date('2026-01-01T00:05:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const expectedHash = createHash('sha256').update(token).digest('hex');
  Message.findOne = filter => {
    receivedFilter = filter;
    return { select: async () => filter.visitorTokenHash === expectedHash ? conversation : null };
  };
  try {
    const res = response();
    await getPublicConversation({
      params: { id: id.toString() },
      headers: { authorization: `Bearer ${token}` },
    }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.body.conversation).sort(), ['content', 'createdAt', 'id', 'reply', 'replyAt']);
    assert.equal(receivedFilter.vehicleId, id.toString());
    assert.notEqual(receivedFilter.visitorTokenHash, token);

    const denied = response();
    await getPublicConversation({
      params: { id: id.toString() },
      headers: { authorization: 'Bearer another-visitors-token' },
    }, denied, error => { throw error; });
    assert.equal(denied.statusCode, 404);
    assert.deepEqual(denied.body, { message: 'Conversation not found' });
  } finally {
    Message.findOne = originalFindOne;
  }
});

test('owner reply is scoped to an owned vehicle and stores reply timestamp', async () => {
  const originalVehicleFind = Vehicle.find;
  const originalFindOneAndUpdate = Message.findOneAndUpdate;
  const ownerId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const messageId = new mongoose.Types.ObjectId();
  const replyAt = new Date('2026-01-01T00:05:00Z');
  let update;
  Vehicle.find = filter => ({
    select: async () => {
      assert.equal(String(filter.ownerId), String(ownerId));
      return [{ _id: vehicleId }];
    },
  });
  Message.findOneAndUpdate = (filter, change) => {
    assert.equal(String(filter._id), String(messageId));
    assert.deepEqual(filter.vehicleId.$in, [vehicleId]);
    update = change;
    return {
      select: async fields => {
        assert.equal(fields, '_id vehicleId content reply replyAt readAt createdAt updatedAt');
        return { _id: messageId, reply: 'I am moving it.', replyAt };
      },
    };
  };
  try {
    const res = response();
    await patchOwnerReply({
      params: { id: messageId.toString() },
      body: { reply: ' I am moving it. ' },
      owner: { id: ownerId.toString() },
    }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(update.$set.reply, 'I am moving it.');
    assert.ok(update.$set.replyAt instanceof Date);
    assert.equal(res.body.message.reply, 'I am moving it.');
  } finally {
    Vehicle.find = originalVehicleFind;
    Message.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
