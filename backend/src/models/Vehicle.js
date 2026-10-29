import mongoose from 'mongoose';
const vehicleSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },
  number: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
  model: { type: String, required: true, trim: true, maxlength: 80 },
  color: { type: String, required: true, trim: true, maxlength: 40 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
vehicleSchema.index({ ownerId: 1, number: 1 }, { unique: true });
export default mongoose.model('Vehicle', vehicleSchema);
