export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  balance: number;
  role: 'user' | 'admin';
  reputation: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
  createdAt: string;
}

export interface Transaction {
  _id: string;
  fromUserId?: { firstname: string; lastname: string; email: string } | null;
  toUserId?: { firstname: string; lastname: string; email: string } | null;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
}

export interface Listing {
  _id: string;
  userId: { firstname: string; lastname: string; email: string; reputation?: number };
  title: string;
  description: string;
  category: string;
  price: number;
  type: 'offer' | 'request';
  tags: string[];
  estimatedDelay?: string;
  status: string;
  createdAt: string;
}

export interface Mission {
  _id: string;
  listingId: Listing;
  clientUid?: string;
  providerUid?: string;
  clientId: { firstname: string; lastname: string; email: string };
  providerId: { firstname: string; lastname: string; email: string };
  amount: number;
  status: string;
  unreadCount?: number;
  createdAt: string;
}

export interface MissionMessage {
  _id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}
