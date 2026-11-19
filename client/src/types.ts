/** Shared types mirroring the JSON API payloads. */

export interface Wallet {
  id?: string;
  balance: number;
  heldBalance?: number;
}

export interface User {
  id: string;
  phone: string;
  displayName: string;
  role: string;
  kycTier: number;
  kycIdNumber?: string | null;
  kycVerifiedAt?: string | null;
  createdAt?: string;
  wallet?: Wallet | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface Session {
  phone: string;
  accessToken: string;
  refreshToken: string;
  user: User | null;
}

export interface Order {
  id: string;
  payerId: string;
  payeeId: string;
  state: string;
  version: number;
  termsVersion: number;
  currentTermsHash?: string | null;
  priceCents: number | null;
  feeCents: number | null;
  calloutFeeCents: number | null;
  deliveryMode: string | null;
  fundingDeadline: string | null;
  reviewDeadline: string | null;
  paidAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TermsVersion {
  id?: string;
  version?: number;
  hash?: string;
  priceCents: number;
  calloutFeeCents: number;
  scopeDescription: string;
  deliveryMode: string;
  extraTerms?: string | null;
  createdBy?: string;
  createdAt?: string;
}

export interface Acceptance {
  id: string;
  orderId: string;
  userId: string;
  termsVersion: number;
  acceptedAt: string;
}

export interface OrderDetail extends Order {
  terms?: TermsVersion[];
  acceptances?: Acceptance[];
}

export interface Dispute {
  id: string;
  orderId: string;
  openedBy: string;
  reason: string;
  description: string;
  status: string;
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
}

export interface DashboardStats {
  users: number;
  orders: number;
  disputes: number;
  revenue: number;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  orderId: string | null;
  fromAccount: string;
  toAccount: string;
  amountCents: number;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  tableName: string;
  recordId: string | null;
  action: string;
  actorId: string | null;
  createdAt: string;
  newValues?: unknown;
}

export interface Paged<T> {
  items: T[];
  page?: number;
  limit?: number;
  total?: number;
}
