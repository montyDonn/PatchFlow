import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/history', authenticate, ReportController.getHistory);
router.get('/data', authenticate, ReportController.getReportData);

export default router;
