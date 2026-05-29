import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { authRequired, loadUser } from '../middleware/auth.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function userResponse(user) {
  return {
    id: user._id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    balance: user.balance,
    role: user.role,
    reputation: user.reputation,
    totalEarned: user.totalEarned,
    totalSpent: user.totalSpent,
    transactionCount: user.transactionCount,
    createdAt: user.createdAt,
  };
}

router.post(
  '/register',
  [
    body('firstname').trim().notEmpty().withMessage('Prénom requis'),
    body('lastname').trim().notEmpty().withMessage('Nom requis'),
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe min. 6 caractères'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { firstname, lastname, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 12);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [user] = await User.create(
        [{ firstname, lastname, email, passwordHash, balance: 10 }],
        { session }
      );
      await Transaction.create(
        [
          {
            fromUserId: null,
            toUserId: user._id,
            amount: 10,
            type: 'registration',
            description: 'Bonus de bienvenue',
          },
        ],
        { session }
      );
      user.transactionCount = 1;
      await user.save({ session });
      await session.commitTransaction();

      const token = signToken(user);
      res.status(201).json({ token, user: userResponse(user) });
    } catch (err) {
      await session.abortTransaction();
      res.status(500).json({ error: err.message });
    } finally {
      session.endSession();
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = signToken(user);
    res.json({ token, user: userResponse(user) });
  }
);

router.get('/me', authRequired, loadUser, (req, res) => {
  res.json({ user: userResponse(req.user) });
});

router.post('/logout', authRequired, (_req, res) => {
  res.json({ message: 'Déconnexion côté client (supprimer le token)' });
});

export default router;
