import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Listing from '../models/Listing.js';
import Mission from '../models/Mission.js';
import { authRequired, loadUser, adminOnly } from '../middleware/auth.js';
import { transferMilou } from '../services/wallet.js';

const router = Router();

router.use(authRequired, loadUser, adminOnly);

router.get('/users', async (_req, res) => {
  const docs = await User.find().select('-passwordHash').sort({ createdAt: -1 });
  const users = docs.map((u) => ({
    id: u._id,
    firstname: u.firstname,
    lastname: u.lastname,
    email: u.email,
    balance: u.balance,
    role: u.role,
    reputation: u.reputation,
    totalEarned: u.totalEarned,
    totalSpent: u.totalSpent,
    transactionCount: u.transactionCount,
    createdAt: u.createdAt,
  }));
  res.json({ users });
});

router.get('/transactions', async (_req, res) => {
  const transactions = await Transaction.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('fromUserId', 'firstname lastname email')
    .populate('toUserId', 'firstname lastname email');
  res.json({ transactions });
});

router.get('/listings', async (_req, res) => {
  const listings = await Listing.find()
    .sort({ createdAt: -1 })
    .populate('userId', 'firstname lastname email');
  res.json({ listings });
});

router.patch(
  '/users/:id/balance',
  [body('amount').isFloat(), body('action').isIn(['add', 'remove'])],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const amount = Math.abs(req.body.amount);
    try {
      if (req.body.action === 'add') {
        await transferMilou({
          fromUserId: null,
          toUserId: user._id,
          amount,
          type: 'admin_adjustment',
          description: 'Ajustement admin (+)',
        });
      } else {
        if (user.balance < amount) {
          return res.status(400).json({ error: 'Solde insuffisant pour retirer' });
        }
        await transferMilou({
          fromUserId: user._id,
          toUserId: null,
          amount,
          type: 'admin_adjustment',
          description: 'Ajustement admin (-)',
        });
      }
      const updated = await User.findById(user._id).select('-passwordHash');
      res.json({
        user: {
          id: updated._id,
          firstname: updated.firstname,
          lastname: updated.lastname,
          email: updated.email,
          balance: updated.balance,
          role: updated.role,
        },
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte admin' });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  await Listing.deleteMany({ userId: req.params.id });
  res.json({ message: 'Utilisateur supprimé' });
});

router.patch(
  '/listings/:id/moderate',
  [body('status').isIn(['open', 'closed', 'moderated'])],
  async (req, res) => {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!listing) return res.status(404).json({ error: 'Annonce introuvable' });
    res.json({ listing });
  }
);

export default router;
