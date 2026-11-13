/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, ApiError } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';

export interface CrudOptions {
  entity: string;
  delegate: any;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  orderBy?: any;
  /** build the where clause for list requests (search/filters) */
  listWhere?: (req: Request) => any;
  /** mutate the parsed payload before create/update (slug, sanitize, etc.) */
  transform?: (data: any, req: Request) => Promise<any> | any;
  /** super-admin only for writes */
  superAdminOnlyWrites?: boolean;
}

/**
 * Produces a fully audited REST resource:
 *   GET /        list        GET /:id   read
 *   POST /       create      PUT/PATCH /:id  update
 *   DELETE /:id  remove
 */
export function crudRouter(opts: CrudOptions): Router {
  const router = Router();
  const { delegate, entity } = opts;

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const items = await delegate.findMany({
        where: opts.listWhere ? opts.listWhere(req) : undefined,
        orderBy: opts.orderBy ?? { id: 'asc' },
      });
      return ok(res, items);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const item = await delegate.findUnique({ where: { id: req.params.id } });
      if (!item) throw ApiError.notFound(`${entity} not found`);
      return ok(res, item);
    }),
  );

  router.post(
    '/',
    validate(opts.createSchema),
    asyncHandler(async (req, res) => {
      const data = opts.transform ? await opts.transform(req.body, req) : req.body;
      const created = await delegate.create({ data });
      await audit({
        adminId: req.admin?.sub,
        adminEmail: req.admin?.email ?? 'system',
        action: 'create',
        entity,
        entityId: created.id,
        details: data,
        req,
      });
      return ok(res, created, 201);
    }),
  );

  const updateHandler = asyncHandler(async (req, res) => {
    const data = opts.transform ? await opts.transform(req.body, req) : req.body;
    // Zod `.partial()` allows `{}` — Prisma rejects an empty update with a
    // 500, so reject it up front as a 400.
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw ApiError.badRequest('At least one field is required');
    }
    const updated = await delegate.update({ where: { id: req.params.id }, data });
    await audit({
      adminId: req.admin?.sub,
      adminEmail: req.admin?.email ?? 'system',
      action: 'update',
      entity,
      entityId: req.params.id,
      details: data,
      req,
    });
    return ok(res, updated);
  });

  router.put('/:id', validate(opts.updateSchema), updateHandler);
  router.patch('/:id', validate(opts.updateSchema), updateHandler);

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await delegate.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.admin?.sub,
        adminEmail: req.admin?.email ?? 'system',
        action: 'delete',
        entity,
        entityId: req.params.id,
        req,
      });
      return ok(res, { id: req.params.id, deleted: true });
    }),
  );

  return router;
}

