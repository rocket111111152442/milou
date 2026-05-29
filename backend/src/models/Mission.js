import mongoose from 'mongoose';

const missionSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'cancelled', 'disputed'],
      default: 'in_progress',
    },
    escrowHeld: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Mission', missionSchema);
