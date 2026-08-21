import { isAtlasConnected, inMemoryDB } from '../config/database';
import { AuditLogModel } from '../models';
import { ChannelType } from '../../types';

export interface AuditParams {
  userId?: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  channel?: ChannelType;
  ip?: string;
  userAgent?: string;
  before?: any;
  after?: any;
}

export class AuditService {
  public async log(params: AuditParams) {
    const entry = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: params.userId || 'system',
      userName: params.userName || 'System',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId || '-',
      channel: params.channel || ChannelType.WEB,
      ip: params.ip || '127.0.0.1',
      userAgent: params.userAgent || 'Server',
      before: params.before || null,
      after: params.after || null,
      timestamp: new Date().toISOString()
    };

    if (isAtlasConnected()) {
      try {
        const doc = new AuditLogModel(entry);
        await doc.save();
      } catch (e) {
        console.warn('Could not save audit log to MongoDB:', e);
      }
    } else {
      inMemoryDB.auditLogs.unshift(entry);
    }
  }

  public async listLogs(filters: { search?: string; entity?: string } = {}) {
    if (isAtlasConnected()) {
      const q: any = {};
      if (filters.entity) q.entity = filters.entity;
      if (filters.search) {
        q.$or = [
          { action: new RegExp(filters.search, 'i') },
          { userName: new RegExp(filters.search, 'i') },
          { entityId: new RegExp(filters.search, 'i') }
        ];
      }
      return await AuditLogModel.find(q).sort({ timestamp: -1 }).limit(200);
    } else {
      let list = [...inMemoryDB.auditLogs];
      if (filters.entity) list = list.filter(l => l.entity === filters.entity);
      if (filters.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(l =>
          l.action.toLowerCase().includes(s) ||
          l.userName.toLowerCase().includes(s) ||
          (l.entityId && l.entityId.toLowerCase().includes(s))
        );
      }
      return list.slice(0, 200);
    }
  }
}

export const auditService = new AuditService();
