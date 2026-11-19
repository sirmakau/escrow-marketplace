/**
 * Type helpers to work around Express 4/5 type inconsistencies
 * where req.params values are typed as string | string[].
 */

import { Request } from 'express';

/** Extract a single string route parameter */
export function param(req: Request, name: string): string {
  const val = req.params[name];
  if (Array.isArray(val)) return val[0];
  return val as string;
}

/** Extract a single string query parameter */
export function query(req: Request, name: string, defaultVal?: string): string {
  const val = req.query[name];
  if (Array.isArray(val)) return (val[0] as string) ?? defaultVal ?? '';
  return (val as string) ?? defaultVal ?? '';
}

/** Parse an integer query parameter */
export function queryInt(req: Request, name: string, defaultVal: number = 1): number {
  const val = query(req, name);
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}