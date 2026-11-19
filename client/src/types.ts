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
  priceCents: number | null;
  calloutFeeCents: number | null;
  deliveryMode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TermsVersion {
  version?: number;
  priceCents: number;
  calloutFeeCents: number;
  scopeDescription: string;
  deliveryMode: string;
  extraTerms?: string | null;
}

export interface OrderDetail extends Order {
  terms?: TermsVersion[];
}

export interface Dispute {
  id: string;
  orderId: string;
  reason: string;
  description: string;
  status: string;
}

export interface DashboardStats {
  users: number;
  orders: number;
  disputes: number;
  revenue: number;
}
