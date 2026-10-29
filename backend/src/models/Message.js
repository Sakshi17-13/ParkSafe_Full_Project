import mongoose from 'mongoose';
const messageSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  content: { type: String, required: true, trim: true, maxlength: 500 },
  reply: { type: String, trim: true, maxlength: 500, default: '' },
  readAt: { type: Date, default: null },
}, { timestamps: true });
export default mongoose.model('Message', messageSchema);
