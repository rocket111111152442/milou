import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

export async function recordTransaction(session, data) {
  const [tx] = await Transaction.create([data], { session });
  return tx;
}

export async function transferMilou({
  fromUserId,
  toUserId,
  amount,
  type,
  description = '',
  listingId = null,
  missionId = null,
  session: externalSession,
}) {
  if (amount <= 0) throw new Error('Le montant doit être positif');

  const run = async (session) => {
    const from = fromUserId ? await User.findById(fromUserId).session(session) : null;
    const to = toUserId ? await User.findById(toUserId).session(session) : null;

    if (fromUserId && !from) throw new Error('Émetteur introuvable');
    if (toUserId && !to) throw new Error('Destinataire introuvable');
    if (from && from.balance < amount) throw new Error('Solde insuffisant');

    if (from) {
      from.balance -= amount;
      from.totalSpent += amount;
      from.transactionCount += 1;
      await from.save({ session });
    }
    if (to) {
      to.balance += amount;
      to.totalEarned += amount;
      to.transactionCount += 1;
      await to.save({ session });
    }

    return recordTransaction(session, {
      fromUserId,
      toUserId,
      amount,
      type,
      description,
      listingId,
      missionId,
    });
  };

  if (externalSession) return run(externalSession);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tx = await run(session);
    await session.commitTransaction();
    return tx;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function holdEscrow({ clientId, amount, listingId, missionId, session }) {
  const client = await User.findById(clientId).session(session);
  if (!client) throw new Error('Client introuvable');
  if (client.balance < amount) throw new Error('Solde insuffisant pour bloquer les Milou');

  client.balance -= amount;
  client.totalSpent += amount;
  await client.save({ session });

  return recordTransaction(session, {
    fromUserId: clientId,
    toUserId: null,
    amount,
    type: 'escrow_hold',
    description: 'Milou bloqués en escrow',
    listingId,
    missionId,
  });
}

export async function releaseEscrow({ providerId, amount, listingId, missionId, session }) {
  const provider = await User.findById(providerId).session(session);
  if (!provider) throw new Error('Prestataire introuvable');

  provider.balance += amount;
  provider.totalEarned += amount;
  provider.reputation += 1;
  provider.transactionCount += 1;
  await provider.save({ session });

  return recordTransaction(session, {
    fromUserId: null,
    toUserId: providerId,
    amount,
    type: 'escrow_release',
    description: 'Paiement mission validée',
    listingId,
    missionId,
  });
}
