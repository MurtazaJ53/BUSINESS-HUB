/**
 * Staff + StaffPrivate + Attendance — epoch timestamps, tombstone, Database singleton
 */

import { Database } from '../sqlite';
import type { Staff, StaffPrivate, Attendance } from '../../lib/types';

const now = () => Date.now();

// ─── STAFF ──────────────────────────────────────────────────

export const staffRepo = {
  async getAll(): Promise<Staff[]> {
    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, role, joined_at as joinedAt, status, permissions
       FROM staff WHERE tombstone = 0 ORDER BY name ASC;`,
    );
    return rows.map((r: any) => ({
      ...r, permissions: r.permissions ? JSON.parse(r.permissions) : {},
    }));
  },

  async getById(id: string): Promise<Staff | null> {
    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, role, joined_at as joinedAt, status, permissions
       FROM staff WHERE id = ? AND tombstone = 0;`, [id],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { ...r, permissions: r.permissions ? JSON.parse(r.permissions) : {} };
  },

  async upsert(s: Staff): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO staff (id, name, phone, email, role, joined_at, status, permissions, updated_at, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [s.id, s.name, s.phone, s.email ?? null, s.role, s.joinedAt, s.status,
       JSON.stringify(s.permissions || {}), now()],
    );
  },

  async remove(id: string): Promise<void> {
    await Database.run(
      `UPDATE staff SET tombstone = 1, dirty = 1, updated_at = ? WHERE id = ?;`,
      [now(), id],
    );
  },

  async hardDelete(id: string): Promise<void> {
    await Database.run('DELETE FROM staff WHERE id = ?;', [id]);
  },

  async getDirty(): Promise<Staff[]> {
    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, role, joined_at as joinedAt, status, permissions,
              updated_at as updatedAt, tombstone
       FROM staff WHERE dirty = 1;`,
    );
    return rows.map((r: any) => ({
      ...r, permissions: r.permissions ? JSON.parse(r.permissions) : {},
    }));
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE staff SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(s: Staff, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM staff WHERE id = ?;', [s.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO staff (id, name, phone, email, role, joined_at, status, permissions, updated_at, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [s.id, s.name, s.phone, s.email ?? null, s.role, s.joinedAt, s.status,
         JSON.stringify(s.permissions || {}), remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE staff SET name=?, phone=?, email=?, role=?, status=?, permissions=?,
                updated_at=?, dirty=0, tombstone=0 WHERE id=?;`,
        [s.name, s.phone, s.email ?? null, s.role, s.status,
         JSON.stringify(s.permissions || {}), remoteUpdatedAt, s.id],
      );
    }
  },
};

// ─── STAFF PRIVATE ──────────────────────────────────────────

export const staffPrivateRepo = {
  async getAll(): Promise<StaffPrivate[]> {
    return Database.query<StaffPrivate>(
      `SELECT id, salary, pin FROM staff_private;`,
    );
  },

  async upsert(sp: StaffPrivate): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO staff_private (id, salary, pin, updated_at, dirty)
       VALUES (?, ?, ?, ?, 1);`,
      [sp.id, sp.salary ?? 0, sp.pin ?? null, now()],
    );
  },

  async getDirty(): Promise<Array<StaffPrivate & { updatedAt: number }>> {
    return Database.query(
      `SELECT id, salary, pin, updated_at as updatedAt FROM staff_private WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE staff_private SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(sp: StaffPrivate, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM staff_private WHERE id = ?;', [sp.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO staff_private (id, salary, pin, updated_at, dirty) VALUES (?, ?, ?, ?, 0);`,
        [sp.id, sp.salary ?? 0, sp.pin ?? null, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE staff_private SET salary=?, pin=?, updated_at=?, dirty=0 WHERE id=?;`,
        [sp.salary ?? 0, sp.pin ?? null, remoteUpdatedAt, sp.id],
      );
    }
  },
};

// ─── ATTENDANCE ─────────────────────────────────────────────

export const attendanceRepo = {
  async getAll(sinceDate?: string): Promise<Attendance[]> {
    if (sinceDate) {
      return Database.query<Attendance>(
        `SELECT id, staff_id as staffId, date, clock_in as clockIn, clock_out as clockOut,
                status, total_hours as totalHours, overtime, bonus, note
         FROM attendance WHERE tombstone = 0 AND date >= ? ORDER BY date DESC;`,
        [sinceDate],
      );
    }
    return Database.query<Attendance>(
      `SELECT id, staff_id as staffId, date, clock_in as clockIn, clock_out as clockOut,
              status, total_hours as totalHours, overtime, bonus, note
       FROM attendance WHERE tombstone = 0 ORDER BY date DESC;`,
    );
  },

  async upsert(entry: Attendance): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO attendance
         (id, staff_id, date, clock_in, clock_out, status, total_hours, overtime, bonus, note, updated_at, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [entry.id, entry.staffId, entry.date, entry.clockIn ?? null, entry.clockOut ?? null,
       entry.status, entry.totalHours ?? null, entry.overtime ?? null, entry.bonus ?? null,
       entry.note ?? null, now()],
    );
  },

  async getDirty(): Promise<Array<Attendance & { updatedAt: number }>> {
    return Database.query(
      `SELECT id, staff_id as staffId, date, clock_in as clockIn, clock_out as clockOut,
              status, total_hours as totalHours, overtime, bonus, note, updated_at as updatedAt
       FROM attendance WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE attendance SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(entry: Attendance, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM attendance WHERE id = ?;', [entry.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO attendance
           (id, staff_id, date, clock_in, clock_out, status, total_hours, overtime, bonus, note, updated_at, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [entry.id, entry.staffId, entry.date, entry.clockIn ?? null, entry.clockOut ?? null,
         entry.status, entry.totalHours ?? null, entry.overtime ?? null, entry.bonus ?? null,
         entry.note ?? null, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE attendance SET staff_id=?, date=?, clock_in=?, clock_out=?, status=?,
                total_hours=?, overtime=?, bonus=?, note=?, updated_at=?, dirty=0, tombstone=0
         WHERE id=?;`,
        [entry.staffId, entry.date, entry.clockIn ?? null, entry.clockOut ?? null,
         entry.status, entry.totalHours ?? null, entry.overtime ?? null, entry.bonus ?? null,
         entry.note ?? null, remoteUpdatedAt, entry.id],
      );
    }
  },
};
