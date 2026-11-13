import { Router } from 'express';
import { publicRouter } from './public.routes';
import { authRouter } from './admin/auth.routes';
import { catalogRouter } from './admin/catalog.routes';
import { contentRouter } from './admin/content.routes';
import { crmRouter } from './admin/crm.routes';
import { systemRouter } from './admin/system.routes';
import { requireAuth } from '../middleware/auth';
import { originGuard } from '../middleware/security';

export const apiRouter = Router();

const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(originGuard);
adminRouter.use(catalogRouter);
adminRouter.use(contentRouter);
adminRouter.use(crmRouter);
adminRouter.use(systemRouter);

const v1 = Router();
v1.use(publicRouter);
// Auth mutations (login/MFA/logout) get origin-guard CSRF protection; GET /me
// passes through because originGuard ignores safe methods.
v1.use('/admin/auth', originGuard, authRouter);
v1.use('/admin', adminRouter);

apiRouter.use('/v1', v1);
