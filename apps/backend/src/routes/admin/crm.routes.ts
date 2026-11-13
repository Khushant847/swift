import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok, ApiError, sanitizeText } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { bulkEnquirySchema, enquiryUpdateSchema } from '../../schemas';
import { audit } from '../../lib/audit';

export const crmRouter = Router();

function whereFromQuery(q: Record<string, string>) {
  const { search, status, from, to } = q;
  return {
    ...(status && status !== 'all' ? { status } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { companyName: { contains: search } },
            { message: { contains: search } },
          ],
        }
      : {}),
  };
}

// ─── Stats ───────────────────────────────────────────────────
crmRouter.get(
  '/enquiries/stats',
  asyncHandler(async (_req, res) => {
    const [total, newCount, contacted, closed] = await Promise.all([
      prisma.enquiry.count(),
      prisma.enquiry.count({ where: { status: 'new' } }),
      prisma.enquiry.count({ where: { status: 'contacted' } }),
      prisma.enquiry.count({ where: { status: 'closed' } }),
    ]);
    return ok(res, { total, new: newCount, contacted, closed });
  }),
);

// ─── CSV export (must precede /:id) ──────────────────────────
crmRouter.get(
  '/enquiries/export',
  asyncHandler(async (req, res) => {
    const rows = await prisma.enquiry.findMany({
      where: whereFromQuery(req.query as Record<string, string>),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const header = ['ID', 'Name', 'Email', 'Phone', 'Company', 'Subject', 'Message', 'Status', 'Created At'];
    // Neutralise CSV formula injection: values starting with = + - @ tab or
    // CR would execute in Excel/Sheets when the export is opened.
    const neutralise = (raw: string) => (/^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw);
    const esc = (v: unknown) => `"${neutralise(String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' '))}"`;
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [r.id, r.name, r.email, r.phone, r.companyName, r.subject, r.message, r.status, r.createdAt.toISOString()]
          .map(esc)
          .join(','),
      ),
    ].join('\r\n');

    await audit({
      adminId: req.admin?.sub,
      adminEmail: req.admin?.email ?? 'system',
      action: 'export',
      entity: 'enquiry',
      details: { count: rows.length },
      req,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="swift-enquiries-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  }),
);

// ─── Bulk actions (must precede /:id) ────────────────────────
crmRouter.post(
  '/enquiries/bulk',
  validate(bulkEnquirySchema),
  asyncHandler(async (req, res) => {
    const { ids, status, action } = req.body as {
      ids: string[];
      status?: 'new' | 'contacted' | 'closed';
      action: 'delete' | 'status';
    };
    if (action === 'delete') {
      const result = await prisma.enquiry.deleteMany({ where: { id: { in: ids } } });
      await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'delete', entity: 'enquiry', details: { ids }, req });
      return ok(res, { deleted: result.count });
    }
    if (!status) throw ApiError.badRequest('status required for status action');
    const result = await prisma.enquiry.updateMany({ where: { id: { in: ids } }, data: { status } });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'update', entity: 'enquiry', details: { ids, status }, req });
    return ok(res, { updated: result.count });
  }),
);

// ─── List ────────────────────────────────────────────────────
crmRouter.get(
  '/enquiries',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const take = Math.min(Math.max(Number(q.limit) || 25, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);
    const skip = (page - 1) * take;
    const where = whereFromQuery(q);
    const [items, total] = await Promise.all([
      prisma.enquiry.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, skip }),
      prisma.enquiry.count({ where }),
    ]);
    return ok(res, { items, total, page, pageSize: take });
  }),
);

crmRouter.get(
  '/enquiries/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
    if (!item) throw ApiError.notFound('Enquiry not found');
    return ok(res, item);
  }),
);

crmRouter.patch(
  '/enquiries/:id',
  validate(enquiryUpdateSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body } as { status?: string; notes?: string | null };
    if (typeof data.notes === 'string') data.notes = sanitizeText(data.notes);
    const updated = await prisma.enquiry.update({ where: { id: req.params.id }, data });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'update', entity: 'enquiry', entityId: req.params.id, details: data, req });
    return ok(res, updated);
  }),
);

crmRouter.delete(
  '/enquiries/:id',
  asyncHandler(async (req, res) => {
    await prisma.enquiry.delete({ where: { id: req.params.id } });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'delete', entity: 'enquiry', entityId: req.params.id, req });
    return ok(res, { deleted: true });
  }),
);
