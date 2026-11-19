/**
 * Server-Sent Events for realtime order updates.
 *
 * Clients subscribe to /api/events/orders/:orderId and receive
 * state-change notifications as SSE events.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { param } from '../../utils/params.js';
import { db, schema } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'node:events';

// In-memory event bus for order state changes
const orderEvents = new EventEmitter();
orderEvents.setMaxListeners(1000);

const router = Router();

/**
 * Subscribe to order state changes via SSE.
 * Authenticated; caller must be a party to the order or staff.
 */
router.get('/orders/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = param(req, 'orderId');
    const userId = req.user!.id;

    // Verify caller is a party
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!order) {
      return res.status(404).json({ error: { message: 'Order not found' } });
    }
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'support';
    if (order.payerId !== userId && order.payeeId !== userId && !isStaff) {
      return res.status(403).json({ error: { message: 'Not a party to this order' } });
    }

    // SSE setup
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ orderId })}\n\n`);

    // Keep alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15_000);

    // Listen for updates to this order
    const channel = `order:${orderId}`;
    const handler = (data: any) => {
      res.write(`event: state_change\ndata: ${JSON.stringify(data)}\n\n`);
    };

    orderEvents.on(channel, handler);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      orderEvents.off(channel, handler);
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Emit a state change event. Called by services when an order transitions.
 */
export function emitOrderEvent(orderId: string, event: { state: string; version: number; timestamp: string; [key: string]: any }) {
  orderEvents.emit(`order:${orderId}`, event);
}

export default router;