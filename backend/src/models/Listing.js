import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['offer', 'request'], required: true },
    tags: [{ type: String, trim: true }],
    estimatedDelay: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed', 'in_progress', 'moderated'], default: 'open' },
  },
  { timestamps: true }
);

export default mongoose.model('Listing', listingSchema);
