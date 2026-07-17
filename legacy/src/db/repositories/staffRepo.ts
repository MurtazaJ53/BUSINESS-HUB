/**
 * Staff Repositories
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import { ADMIN_PERMISSION_TEMPLATE, normalizePermissionMatrix } from '../../lib/permissions';
import type { Staff, StaffPrivate, Attendance } from '../../lib/types';

const now = () => Date.now();

export interface StaffListFilters {
  search?: string;
}

export interface StaffListMetrics {
  totalCount: number;
  activeCount: number;
}

const parseStaffRow = (row: Record<string, unknown>): Staff => ({
  ...(row as unknown as Staff),
  permissions: normalizePermissionMatrix(
    row.permissions && typeof row.permissions === 'string' ? JSON.parse(row.permissions) : {},
    row.role === 'admin' ? ADMIN_PERMISSION_TEMPLATE : {},
  ),
});

const buildStaffWhereClause = (
  filters: StaffListFilters = {},
): { clause: string; params: Array<string | number> } => {
  const conditions = ['tombstone = 0'];
  const params: Array<string | number> = [];

  if (filters.search?.trim()) {
    const lowered = `%${filters.search.trim().toLowerCase()}%`;
    const phoneLike = `%${filters.search.trim()}%`;
    conditions.push('(LOWER(name) LIKE ? OR phone LIKE ? OR LOWER(COALESCE(role, \'\')) LIKE ?)');
    params.push(lowered, phoneLike, lowered);
  }

  return {
    clause: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
};

export const staffRepo = {
  async getAll(): Promise<Staff[]> {
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, phone, email, role, joinedAt, status, permissions
       FROM staff
       WHERE tombstone = 0
       ORDER BY name ASC;`,
    );
    return rows.map(parseStaffRow);
  },

  async getPage(filters: StaffListFilters = {}, page: number = 1, pageSize: number = 24): Promise<Staff[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 200));
    const offset = (safePage - 1) * safePageSize;
    const { clause, params } = buildStaffWhereClause(filters);
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, phone, email, role, joinedAt, status, permissions
       FROM staff
       ${clause}
       ORDER BY name ASC
       LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );
    return rows.map(parseStaffRow);
  },

  async getMetrics(filters: StaffListFilters = {}): Promise<StaffListMetrics> {
    const { clause, params } = buildStaffWhereClause(filters);
    const rows = await Database.query<StaffListMetrics>(
      `SELECT COUNT(*) AS totalCount,
              COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS activeCount
       FROM staff
       ${clause};`,
      params,
    );
    return rows[0] ?? { totalCount: 0, activeCount: 0 };
  },

  async getById(id: string): Promise<Staff | null> {
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, phone, email, role, joinedAt, status, permissions
       FROM staff
       WHERE id = ? AND tombstone = 0;`,
      [id],
    );
    return rows[0] ? parseStaffRow(rows[0]) : null;
  },

  async upsert(staffMember: Staff): Promise<void> {
    const normalizedPermissions = normalizePermissionMatrix(
      staffMember.permissions || {},
      staffMember.role === 'admin' ? ADMIN_PERMISSION_TEMPLATE : {},
    );
    await Database.run(
      `INSERT OR REPLACE INTO staff (id, name, phone, email, role, joinedAt, status, permissions, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [
        staffMember.id,
        staffMember.name,
        staffMember.phone,
        staffMember.email ?? null,
        staffMember.role,
        staffMember.joinedAt,
        staffMember.status,
        JSON.stringify(normalizedPermissions),
        now(),
      ],
    );
    tableEvents.emit('staff');
  },

  async remove(id: string): Promise<void> {
    await Database.run(
      `UPDATE staff SET tombstone = 1, dirty = 1, updatedAt = ? WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit('staff');
  },

  async hardDelete(id: string): Promise<void> {
    await Database.run(`DELETE FROM staff WHERE id = ?;`, [id]);
  },

  async getDirty(): Promise<Staff[]> {
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, phone, email, role, joinedAt, status, permissions, updatedAt, tombstone
       FROM staff
       WHERE dirty = 1;`,
    );
    return rows.map(parseStaffRow);
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await Database.run(`UPDATE staff SET dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(staffMember: Staff, remoteUpdatedAt: number): Promise<void> {
    const normalizedPermissions = normalizePermissionMatrix(
      staffMember.permissions || {},
      staffMember.role === 'admin' ? ADMIN_PERMISSION_TEMPLATE : {},
    );
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      `SELECT updatedAt, dirty FROM staff WHERE id = ?;`,
      [staffMember.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO staff (id, name, phone, email, role, joinedAt, status, permissions, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [
          staffMember.id,
          staffMember.name,
          staffMember.phone,
          staffMember.email ?? null,
          staffMember.role,
          staffMember.joinedAt,
          staffMember.status,
          JSON.stringify(normalizedPermissions),
          remoteUpdatedAt,
        ],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE staff
         SET name = ?, phone = ?, email = ?, role = ?, status = ?, permissions = ?, updatedAt = ?, dirty = 0, tombstone = 0
         WHERE id = ?;`,
        [
          staffMember.name,
          staffMember.phone,
          staffMember.email ?? null,
          staffMember.role,
          staffMember.status,
          JSON.stringify(normalizedPermissions),
          remoteUpdatedAt,
          staffMember.id,
        ],
      );
    }
  },
};

export const staffPrivateRepo = {
  async getAll(): Promise<StaffPrivate[]> {
    return Database.query<StaffPrivate>(
      `SELECT id, salary, pin
       FROM staff_private
       WHERE tombstone = 0;`,
    );
  },

  async getByIds(ids: string[]): Promise<StaffPrivate[]> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return Database.query<StaffPrivate>(
      `SELECT id, salary, pin
       FROM staff_private
       WHERE tombstone = 0 AND id IN (${placeholders});`,
      ids,
    );
  },

  async upsert(staffPrivate: StaffPrivate): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO staff_private (id, salary, pin, updatedAt, dirty)
       VALUES (?, ?, ?, ?, 1);`,
      [staffPrivate.id, staffPrivate.salary ?? 0, staffPrivate.pin ?? null, now()],
    );
    tableEvents.emit('staff_private');
  },

  async remove(id: string): Promise<void> {
    await Database.run(
      `UPDATE staff_private SET tombstone = 1, updatedAt = ?, dirty = 1 WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit('staff_private');
  },

  async getDirty(): Promise<Array<StaffPrivate & { updatedAt: number }>> {
    return Database.query<Array<StaffPrivate & { updatedAt: number }>[number]>(
      `SELECT id, salary, pin, updatedAt
       FROM staff_private
       WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await Database.run(`UPDATE staff_private SET dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(staffPrivate: StaffPrivate, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      `SELECT updatedAt, dirty FROM staff_private WHERE id = ?;`,
      [staffPrivate.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO staff_private (id, salary, pin, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, 0, 0);`,
        [staffPrivate.id, staffPrivate.salary ?? 0, staffPrivate.pin ?? null, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE staff_private
         SET salary = ?, pin = ?, updatedAt = ?, dirty = 0, tombstone = 0
         WHERE id = ?;`,
        [staffPrivate.salary ?? 0, staffPrivate.pin ?? null, remoteUpdatedAt, staffPrivate.id],
      );
    }
  },
};

export const attendanceRepo = {
  async getAll(sinceDate?: string): Promise<Attendance[]> {
    if (sinceDate) {
      return Database.query<Attendance>(
        `SELECT id, staffId, date, clockIn, clockOut, status, totalHours, overtime, bonus, note
         FROM attendance
         WHERE tombstone = 0 AND date >= ?
         ORDER BY date DESC;`,
        [sinceDate],
      );
    }
    return Database.query<Attendance>(
      `SELECT id, staffId, date, clockIn, clockOut, status, totalHours, overtime, bonus, note
       FROM attendance
       WHERE tombstone = 0
       ORDER BY date DESC;`,
    );
  },

  async getByStaffIdsAndRange(staffIds: string[], dateFrom?: string, dateTo?: string): Promise<Attendance[]> {
    if (!staffIds.length) return [];
    const placeholders = staffIds.map(() => '?').join(',');
    const conditions = [`tombstone = 0`, `staffId IN (${placeholders})`];
    const params: Array<string | number> = [...staffIds];

    if (dateFrom) {
      conditions.push('date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('date <= ?');
      params.push(dateTo);
    }

    return Database.query<Attendance>(
      `SELECT id, staffId, date, clockIn, clockOut, status, totalHours, overtime, bonus, note
       FROM attendance
       WHERE ${conditions.join(' AND ')}
       ORDER BY date DESC, clockIn DESC;`,
      params,
    );
  },

  async upsert(entry: Attendance): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO attendance
         (id, staffId, date, clockIn, clockOut, status, totalHours, overtime, bonus, note, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [
        entry.id,
        entry.staffId,
        entry.date,
        entry.clockIn ?? null,
        entry.clockOut ?? null,
        entry.status,
        entry.totalHours ?? null,
        entry.overtime ?? null,
        entry.bonus ?? null,
        entry.note ?? null,
        now(),
      ],
    );
    tableEvents.emit('attendance');
  },

  async getDirty(): Promise<Array<Attendance & { updatedAt: number }>> {
    return Database.query<Array<Attendance & { updatedAt: number }>[number]>(
      `SELECT id, staffId, date, clockIn, clockOut, status, totalHours, overtime, bonus, note, updatedAt
       FROM attendance
       WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await Database.run(`UPDATE attendance SET dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(entry: Attendance, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      `SELECT updatedAt, dirty FROM attendance WHERE id = ?;`,
      [entry.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO attendance
           (id, staffId, date, clockIn, clockOut, status, totalHours, overtime, bonus, note, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [
          entry.id,
          entry.staffId,
          entry.date,
          entry.clockIn ?? null,
          entry.clockOut ?? null,
          entry.status,
          entry.totalHours ?? null,
          entry.overtime ?? null,
          entry.bonus ?? null,
          entry.note ?? null,
          remoteUpdatedAt,
        ],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE attendance
         SET staffId = ?, date = ?, clockIn = ?, clockOut = ?, status = ?, totalHours = ?, overtime = ?, bonus = ?, note = ?, updatedAt = ?, dirty = 0, tombstone = 0
         WHERE id = ?;`,
        [
          entry.staffId,
          entry.date,
          entry.clockIn ?? null,
          entry.clockOut ?? null,
          entry.status,
          entry.totalHours ?? null,
          entry.overtime ?? null,
          entry.bonus ?? null,
          entry.note ?? null,
          remoteUpdatedAt,
          entry.id,
        ],
      );
    }
  },
};
