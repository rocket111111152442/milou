export type UserRole = 'user' | 'admin' | 'moderator';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  balance: number;
  role: UserRole;
  status?: UserStatus;
  reputation: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
  moderatorNotes?: string;
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
  premiumActivatedAt?: string | null;
  lastSeenAt?: string | null;
  isOnline?: boolean;
  reviewCount?: number;
  averageRating?: number;
  createdAt: string;
  suspendedAt?: string | null;
}

export interface PremiumUsage {
  isPremium: boolean;
  limits: {
    maxListingsPerMonth: number;
    maxTransfersPerDay: number;
    maxActiveMissions: number;
    maxTransferAmount: number;
    marketplaceBoost: number;
  };
  usage: {
    listingsThisMonth: number;
    transfersToday: number;
    activeMissions: number;
  };
}

export interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Review {
  _id: string;
  rating: number;
  comment?: string;
  from?: Pick<User, 'id' | 'firstname' | 'lastname' | 'email'> | null;
  createdAt: string;
  autoPenalty?: boolean;
}

export interface ReviewReport {
  _id: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  details: string;
  status: string;
  reviewSnapshot?: {
    rating: number;
    comment: string;
    missionId: string;
    fromUserId: string;
    toUserId: string;
    fromName: string;
    autoPenalty?: boolean;
  };
  reporter?: Pick<User, 'id' | 'firstname' | 'lastname' | 'email'> | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  totalMilouInCirculation: number;
  totalListings: number;
  openListings: number;
  totalMissions: number;
  activeMissions: number;
  totalTransactions: number;
  registrationsLast7Days: number;
  topBalances: { id: string; name: string; email: string; balance: number }[];
}

export interface AdminUserDetailResponse {
  user: User;
  auth: {
    emailVerified: boolean;
    disabled: boolean;
    lastSignIn: string | null;
    creationTime: string | null;
  };
  transactions: Transaction[];
  listings: Listing[];
  missionsAsClient: Mission[];
  missionsAsProvider: Mission[];
  counts: {
    listings: number;
    missions: number;
    transactions: number;
  };
}

export interface AdminAuditEntry {
  _id: string;
  adminId: string;
  adminName?: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformAnnouncement {
  _id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt: string;
}

export interface PromoCode {
  _id: string;
  code: string;
  label: string;
  milouAmount: number;
  premiumDays: number;
  reputationBonus: number;
  maxUses: number;
  maxUsesPerUser: number;
  minAccountAgeDays: number;
  active: boolean;
  usedCount: number;
  expiresAt: string | null;
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

export interface ListingAuthor {
  firstname: string;
  lastname: string;
  email: string;
  reputation?: number;
  isPremium?: boolean;
  role?: UserRole;
  averageRating?: number;
}

export interface Listing {
  _id: string;
  /** UID propriétaire (marketplace) */
  authorId?: string;
  userId: ListingAuthor | string;
  title: string;
  description: string;
  category: string;
  price: number;
  type: 'offer' | 'request';
  tags: string[];
  estimatedDelay?: string;
  missionType?: string;
  featured?: boolean;
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
  dueAt?: string | null;
  estimatedDelay?: string;
  completedReason?: string | null;
  unreadCount?: number;
  createdAt: string;
}

export interface ChatAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'file' | 'archive';
}

export interface MissionMessage {
  _id: string;
  senderId: string;
  senderName: string;
  text: string;
  attachments?: ChatAttachment[];
  createdAt: string;
}
