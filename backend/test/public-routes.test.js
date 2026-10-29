import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { getPublicVehicle } from '../src/routes/vehicles.js';
import { postPublicMessage } from '../src/routes/messages.js';
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
    return { _id: new mongoose.Types.ObjectId(), createdAt: new Date('2026-01-01T00:00:00Z') };
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
    assert.deepEqual(stored, { vehicleId: id, content: 'Please move your car.' });
    assert.equal(emitted.room, `owner:${ownerId}`);
    assert.equal(emitted.event, 'new-message');
    assert.equal(emitted.payload.content, 'Please move your car.');
    assert.equal(emitted.payload.vehicleNumber, vehicle.number);
  } finally {
    Vehicle.findOne = originalFindOne;
    Message.create = originalCreate;
  }
});
