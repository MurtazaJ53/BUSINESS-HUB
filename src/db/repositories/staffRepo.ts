/**
 * Staff Repository — Local SQLite CRUD with sync metadata
 */

import { execQuery, execRun } from '../connection';
import type { Staff, StaffPrivate, Attendance } from '../../lib/types';

const now = () => new Date().toISOString();

export const staffRepo = {
  async getAll(): Promise<Staff[]> {
    const rows = await execQuery<any>(
      `SELECT id, name, phone, email, role, joined_at as joinedAt, status, permissions,
              updated_at as updatedAt
       FROM staff ORDER BY name ASC;`
    );
    // Parse JSON permissions column
    return rows.map((r: any) => ({
      ...r,
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
    }));
  },

  async getById(id: string): Promise<Staff | null> {
    const rows = await execQuery<any>(
      `SELECT id, name, phone, email, role, joined_at as joinedAt, status, permissions
       FROM staff WHERE id = ?;`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return { ...r, permissions: r.permissions ? JSON.parse(r.permissions) : [] };
  },

  async upsert(s: Staff): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO staff (id, name, phone, email, role, joined_at, status, permissions, updated_at, is_dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
      [s.id, s.name, s.phone, s.email ?? null, s.role, s.joinedAt, s.status,
       JSON.stringify(s.permissions || []), ts]
    );
  },

  async delete(id: string): Promise<void> {
    await execRun('DELETE FROM staff WHERE id = ?;', [id]);
  },

  async getDirty(): Promise<Staff[]> {
    const rows = await execQuery<any>(
      `SELECT id, name, phone, email, role, joined_at as joinedAt, status, permissions,
              updated_at as updatedAt
       FROM staff WHERE is_dirty = 1;`
    );
    return rows.map((r: any) => ({
      ...r,
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
    }));
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE staff SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(s: Staff, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM staff WHERE id = ?;',
      [s.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO staff (id, name, phone, email, role, joined_at, status, permissions, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
        [s.id, s.name, s.phone, s.email ?? null, s.role, s.joinedAt, s.status,
         JSON.stringify(s.permissions || []), remoteUpdatedAt]
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].isDirty) {
      await execRun(
        `UPDATE staff SET name = ?, phone = ?, email = ?, role = ?, status = ?, permissions = ?,
                updated_at = ?, is_dirty = 0 WHERE id = ?;`,
        [s.name, s.phone, s.email ?? null, s.role, s.status,
         JSON.stringify(s.permissions || []), remoteUpdatedAt, s.id]
      );
    }
  },
};

// ─── STAFF PRIVATE REPO ─────────────────────────────────────

export const staffPrivateRepo = {
  async getAll(): Promise<StaffPrivate[]> {
    return execQuery<StaffPrivate>(
      `SELECT id, salary, pin FROM staff_private;`
    );
  },

  async upsert(sp: StaffPrivate): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO staff_private (id, salary, pin, updated_at, is_dirty)
       VALUES (?, ?, ?, ?, 1);`,
      [sp.id, sp.salary ?? 0, sp.pin ?? null, ts]
    );
  },

  async getDirty(): Promise<Array<StaffPrivate & { updatedAt: string }>> {
    return execQuery(
      `SELECT id, salary, pin, updated_at as updatedAt FROM staff_private WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE staff_private SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(sp: StaffPrivate, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM staff_private WHERE id = ?;',
      [sp.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO staff_private (id, salary, pin, updated_at, is_dirty) VALUES (?, ?, ?, ?, 0);`,
        [sp.id, sp.salary ?? 0, sp.pin ?? null, remoteUpdatedAt]
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].isDirty) {
      await execRun(
        `UPDATE staff_private SET salary = ?, pin = ?, updated_at = ?, is_dirty = 0 WHERE id = ?;`,
        [sp.salary ?? 0, sp.pin ?? null, remoteUpdatedAt, sp.id]
      );
    }
  },
};

// ─── ATTENDANCE REPO ────────────────────────────────────────

export const attendanceRepo = {
  async getAll(sinceDate?: string): Promise<Attendance[]> {
    if (sinceDate) {
      return execQuery<Attendance>(
        `SELECT id, staff_id as staffId, date, clock_in as clockIn, clock_out as clockOut,
                status, total_hours as totalHours, overtime, bonus, note
         FROM attendance WHERE date >= ? ORDER BY date DESC;`,
        [sinceDate]
      );
    }
    return execQuery<Attendance>(
      `SELECT id, staff_id as staffId, date, clock_in as clockIn, clock_out as clockOut,
              status, total_hours as totalHours, overtime, bonus, note
       FROM attendance ORDER BY date DESC;`
    );
  },

  async upsert(entry: Attendance): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO attendance (id, staff_id, date, clock_in, clock_out, status,
       total_hours, overtime, bonus, note, updated_at, is_dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
      [entry.id, entry.staffId, entry.date, entry.clockIn ?? null, entry.clockOut ?? null,
       entry.status, entry.totalHours ?? null, entry.overtime ?? null, entry.bonus ?? null,
       entry.note ?? null, ts]
    );
  },

  async getDirty(): Promise<Array<Attendance & { updatedAt: string }>> {
    return execQuery(
      `SELECT id, staff_id as staffId, date, clock_in as clockIn, clock_out as clockOut,
              status, total_hours as totalHours, overtime, bonus, note, updated_at as updatedAt
       FROM attendance WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE attendance SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(entry: Attendance, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM attendance WHERE id = ?;',
      [entry.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO attendance (id, staff_id, date, clock_in, clock_out, status,
         total_hours, overtime, bonus, note, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
        [entry.id, entry.staffId, entry.date, entry.clockIn ?? null, entry.clockOut ?? null,
         entry.status, entry.totalHours ?? null, entry.overtime ?? null, entry.bonus ?? null,
         entry.note ?? null, remoteUpdatedAt]
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].isDirty) {
      await execRun(
        `UPDATE attendance SET staff_id = ?, date = ?, clock_in = ?, clock_out = ?, status = ?,
                total_hours = ?, overtime = ?, bonus = ?, note = ?, updated_at = ?, is_dirty = 0
         WHERE id = ?;`,
        [entry.staffId, entry.date, entry.clockIn ?? null, entry.clockOut ?? null,
         entry.status, entry.totalHours ?? null, entry.overtime ?? null, entry.bonus ?? null,
         entry.note ?? null, remoteUpdatedAt, entry.id]
      );
    }
  },
};
