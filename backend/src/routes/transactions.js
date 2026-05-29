import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { authRequired, loadUser } from '../middleware/auth.js';
import { transferMilou } from '../services/wallet.js';

const router = Router();

router.use(authRequired, loadUser);

router.get('/', async (req, res) => {
  const filter = {
    $or: [{ fromUserId: req.userId }, { toUserId: req.userId }],
  };
  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('fromUserId', 'firstname lastname email')
    .populate('toUserId', 'firstname lastname email');
  res.json({ transactions });
});

router.post(
  '/transfer',
  [
    body('recipientEmail').isEmail().normalizeEmail(),
    body('amount').isFloat({ min: 0.01 }).withMessage('Montant invalide'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { recipientEmail, amount } = req.body;
    if (recipientEmail === req.user.email) {
      return res.status(400).json({ error: 'Impossible de transférer à soi-même' });
    }

    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) return res.status(404).json({ error: 'Destinataire introuvable' });

    try {
      const tx = await transferMilou({
        fromUserId: req.userId,
        toUserId: recipient._id,
        amount: Math.round(amount * 100) / 100,
        type: 'transfer',
        description: `Transfert vers ${recipient.email}`,
      });
      const updated = await User.findById(req.userId).select('-passwordHash');
      res.json({ transaction: tx, balance: updated.balance });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
