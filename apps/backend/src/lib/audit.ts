import type { Request } from 'express';
import { prisma } from './prisma';
import { logger } from './logger';

export interface AuditInput {
  adminId?: string | null;
  adminEmail: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'config' | 'upload' | 'export';
  entity: string;
  entityId?: string | null;
  details?: unknown;
  req?: Request;
}

export function clientIp(req?: Request): string {
  if (!req) return '';
  // req.ip already honours Express's `trust proxy` setting, so this cannot be
  // spoofed via a raw X-Forwarded-For header the way a direct header read can.
  return req.ip || req.socket?.remoteAddress || '';
}

/** Fire-and-forget audit trail writer (never throws into request flow). */
export async function audit(entry: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? null,
        adminEmail: entry.adminEmail,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details: entry.details === undefined ? null : JSON.stringify(entry.details).slice(0, 4000),
        ipAddress: clientIp(entry.req),
        userAgent: (entry.req?.headers['user-agent'] as string) ?? null,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', err);
  }
}
