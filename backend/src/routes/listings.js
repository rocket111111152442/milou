import { Router } from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Listing from '../models/Listing.js';
import Mission from '../models/Mission.js';
import User from '../models/User.js';
import { authRequired, loadUser } from '../middleware/auth.js';
import { holdEscrow, releaseEscrow } from '../services/wallet.js';

const router = Router();

router.get('/', async (req, res) => {
  const { category, type, status = 'open' } = req.query;
  const filter = { status: { $in: ['open', 'in_progress'] } };
  if (category) filter.category = category;
  if (type) filter.type = type;
  if (status && status !== 'all') filter.status = status;

  const listings = await Listing.find(filter)
    .sort({ createdAt: -1 })
    .populate('userId', 'firstname lastname email reputation');
  res.json({ listings });
});

router.get('/mine', authRequired, loadUser, async (req, res) => {
  const listings = await Listing.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ listings });
});

router.get('/missions/mine', authRequired, loadUser, async (req, res) => {
  const missions = await Mission.find({
    $or: [{ clientId: req.userId }, { providerId: req.userId }],
    status: 'in_progress',
  })
    .populate('listingId')
    .populate('clientId', 'firstname lastname email')
    .populate('providerId', 'firstname lastname email');
  res.json({ missions });
});

router.get('/:id', async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate(
    'userId',
    'firstname lastname email reputation'
  );
  if (!listing) return res.status(404).json({ error: 'Annonce introuvable' });
  res.json({ listing });
});

router.post(
  '/',
  authRequired,
  loadUser,
  [
    body('title').trim().notEmpty().isLength({ max: 120 }),
    body('description').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('price').isFloat({ min: 1 }),
    body('type').isIn(['offer', 'request']),
    body('tags').optional().isArray(),
    body('estimatedDelay').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const listing = await Listing.create({
      ...req.body,
      userId: req.userId,
      tags: req.body.tags || [],
    });
    const populated = await listing.populate('userId', 'firstname lastname email');
    res.status(201).json({ listing: populated });
  }
);

router.post('/:id/accept', authRequired, loadUser, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Annonce introuvable' });
  if (listing.status !== 'open') return res.status(400).json({ error: 'Annonce non disponible' });
  if (listing.userId.toString() === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas accepter votre propre annonce' });
  }

  const author = await User.findById(listing.userId);
  let clientId, providerId;

  if (listing.type === 'offer') {
    clientId = req.userId;
    providerId = listing.userId;
  } else {
    clientId = listing.userId;
    providerId = req.userId;
  }

  const client = await User.findById(clientId);
  if (client.balance < listing.price) {
    return res.status(400).json({ error: 'Solde insuffisant pour accepter cette annonce' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await holdEscrow({
      clientId,
      amount: listing.price,
      listingId: listing._id,
      missionId: null,
      session,
    });

    const [mission] = await Mission.create(
      [
        {
          listingId: listing._id,
          clientId,
          providerId,
          amount: listing.price,
          status: 'in_progress',
        },
      ],
      { session }
    );

    listing.status = 'in_progress';
    await listing.save({ session });

    await session.commitTransaction();
    const populated = await Mission.findById(mission._id)
      .populate('listingId')
      .populate('clientId', 'firstname lastname email')
      .populate('providerId', 'firstname lastname email');

    res.json({ mission: populated, message: 'Mission démarrée, Milou en escrow' });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

router.post('/missions/:missionId/complete', authRequired, loadUser, async (req, res) => {
  const mission = await Mission.findById(req.params.missionId);
  if (!mission) return res.status(404).json({ error: 'Mission introuvable' });
  if (mission.status !== 'in_progress') {
    return res.status(400).json({ error: 'Mission déjà terminée ou annulée' });
  }
  if (mission.clientId.toString() !== req.userId) {
    return res.status(403).json({ error: 'Seul le client peut valider la mission' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await releaseEscrow({
      providerId: mission.providerId,
      amount: mission.amount,
      listingId: mission.listingId,
      missionId: mission._id,
      session,
    });

    mission.status = 'completed';
    mission.escrowHeld = false;
    await mission.save({ session });

    await Listing.findByIdAndUpdate(mission.listingId, { status: 'closed' }, { session });

    await session.commitTransaction();
    res.json({ message: 'Mission validée, paiement libéré au prestataire' });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
