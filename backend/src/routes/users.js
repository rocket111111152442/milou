import { Router } from 'express';
import Listing from '../models/Listing.js';
import Mission from '../models/Mission.js';
import { authRequired, loadUser } from '../middleware/auth.js';

const router = Router();

router.use(authRequired, loadUser);

router.get('/profile', async (req, res) => {
  const activeListings = await Listing.countDocuments({
    userId: req.userId,
    status: { $in: ['open', 'in_progress'] },
  });
  const activeMissions = await Mission.countDocuments({
    $or: [{ clientId: req.userId }, { providerId: req.userId }],
    status: 'in_progress',
  });

  res.json({
    user: {
      id: req.user._id,
      firstname: req.user.firstname,
      lastname: req.user.lastname,
      email: req.user.email,
      balance: req.user.balance,
      role: req.user.role,
      reputation: req.user.reputation,
      totalEarned: req.user.totalEarned,
      totalSpent: req.user.totalSpent,
      transactionCount: req.user.transactionCount,
      createdAt: req.user.createdAt,
    },
    stats: { activeListings, activeMissions },
  });
});

export default router;
