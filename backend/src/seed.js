import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';

async function seed() {
  await connectDB();
  const email = 'admin@milou.app';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin déjà existant:', email);
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash('admin123', 12);
  await User.create({
    firstname: 'Admin',
    lastname: 'MILOU',
    email,
    passwordHash,
    balance: 1000,
    role: 'admin',
    reputation: 100,
  });
  console.log('Admin créé — email: admin@milou.app / mot de passe: admin123');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
