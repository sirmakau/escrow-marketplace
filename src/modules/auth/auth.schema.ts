import { z } from 'zod';
import { normalisePhone } from '../../utils/helpers.js';

export const registerSchema = z.object({
  phone: z.string().transform(normalisePhone),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  phone: z.string().transform(normalisePhone),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;