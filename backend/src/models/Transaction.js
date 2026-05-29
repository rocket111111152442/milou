import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['registration', 'transfer', 'service_payment', 'escrow_hold', 'escrow_release', 'admin_adjustment'],
      required: true,
    },
    description: { type: String, default: '' },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null },
    missionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mission', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
