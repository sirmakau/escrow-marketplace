import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { param, queryInt } from '../../utils/params.js';
import * as adminService from './admin.service.js';

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ data: stats });
  } catch (err) { next(err); }
});

router.get('/ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.listAllLedgerEntries(queryInt(req, 'page'), queryInt(req, 'limit', 50));
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/audit-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = req.query.tableName as string | undefined;
    const recordId = req.query.recordId as string | undefined;
    const result = await adminService.listAuditLog(tableName, recordId, queryInt(req, 'page'), queryInt(req, 'limit', 50));
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/orders/:orderId/force-state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { state } = req.body;
    if (!state) return res.status(400).json({ error: { message: 'state is required' } });
    const order = await adminService.updateOrderStateByAdmin(param(req, 'orderId'), state, req.user!.id);
    res.json({ data: order });
  } catch (err) { next(err); }
});

export default router;