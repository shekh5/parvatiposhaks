import mongoose from 'mongoose';

// One document per signed-in device. Only a hash of the refresh token is stored.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

// MongoDB removes expired sessions on its own
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);
