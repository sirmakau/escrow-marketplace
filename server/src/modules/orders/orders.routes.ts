import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requireKycTier, requireOrderParty } from '../../middleware/requireOrderParty.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import { param, queryInt } from '../../utils/params.js';
import * as ordersService from './orders.service.js';

const router = Router();

const createOrderSchema = z.object({
  payerId: z.string().uuid(),
});

const termsSchema = z.object({
  priceCents: z.number().int().positive(),
  calloutFeeCents: z.number().int().min(0).default(0),
  scopeDescription: z.string().min(1).max(5000),
  deliveryMode: z.enum(['in_person', 'digital']),
  extraTerms: z.string().max(5000).optional(),
});

const acceptSchema = z.object({
  termsVersion: z.number().int().positive(),
});

// Create order (payee initiates)
router.post('/', authenticate, requireKycTier(1), validate(createOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.createOrder(req.user!.id, req.body.payerId);
    res.status(201).json({ data: order });
  } catch (err) { next(err); }
});

// Get order
router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.getOrder(param(req, 'orderId'), req.user!.id, req.user!.role);
    res.json({ data: order });
  } catch (err) { next(err); }
});

// List my orders
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ordersService.listOrders(req.user!.id, req.user!.role, queryInt(req, 'page'), queryInt(req, 'limit', 20));
    res.json({ data: result });
  } catch (err) { next(err); }
});

// Set terms (payee only)
router.put('/:orderId/terms', authenticate, validate(termsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ordersService.setTerms(param(req, 'orderId'), req.user!.id, req.body);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// Propose order (payee)
router.post('/:orderId/propose', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.proposeOrder(param(req, 'orderId'), req.user!.id);
    res.json({ data: order });
  } catch (err) { next(err); }
});

// Accept terms (payer)
router.post('/:orderId/accept', authenticate, validate(acceptSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ordersService.acceptOrder(param(req, 'orderId'), req.user!.id, req.body.termsVersion);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// Start work — payer check-in or payee digital delivery (FUNDED → IN_PROGRESS)
router.post('/:orderId/start', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.startOrder(param(req, 'orderId'), req.user!.id);
    res.json({ data: order });
  } catch (err) { next(err); }
});

// Mark delivered (payee, IN_PROGRESS → DELIVERED)
router.post('/:orderId/deliver', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.deliverOrder(param(req, 'orderId'), req.user!.id);
    res.json({ data: order });
  } catch (err) { next(err); }
});

// Complete (payer, DELIVERED → COMPLETED)
router.post('/:orderId/complete', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.completeOrder(param(req, 'orderId'), req.user!.id);
    res.json({ data: order });
  } catch (err) { next(err); }
});

// Cancel
router.post('/:orderId/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.cancelOrder(param(req, 'orderId'), req.user!.id);
    res.json({ data: order });
  } catch (err) { next(err); }
});

export default router;