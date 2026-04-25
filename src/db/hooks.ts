/**
 * DB Hooks — Reactive React hooks for SQLite
 */

import { useState, useEffect, useRef } from 'react';
import { tableEvents } from './events';
import { Database } from './sqlite';
import { salesRepo } from './repositories/salesRepo';
import type { Sale } from '../lib/types';

/**
 * useLiveQuery — Automatically re-runs a query when dependent tables change.
 *
 * @param queryFn A function that returns a Promise of the query results.
 * @param tables Array of table names to listen for changes on.
 * @param deps Dependency array for the queryFn (standard React hook pattern).
 */
export function useLiveQuery<T>(
  queryFn: () => Promise<T[]>,
  tables: string[],
  deps: any[] = []
): T[] {
  const [data, setData] = useState<T[]>([]);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  useEffect(() => {
    let active = true;

    const runQuery = async () => {
      try {
        const results = await queryFnRef.current();
        if (active) setData(results);
      } catch (err) {
        console.error('[useLiveQuery] Error:', err);
      }
    };

    // Initial run
    runQuery();

    // Subscribe to changes
    const unsubscribe = tableEvents.on(tables, () => {
      runQuery();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [...deps, ...tables]); // Re-subscribe if tables list changes

  return data;
}

/**
 * Convenience hook for simple SELECT queries
 */
export function useSqlQuery<T>(sql: string, params: any[], tables: string[]): T[] {
  return useLiveQuery(
    () => Database.query<T>(sql, params),
    tables,
    [sql, ...params]
  );
}

export function useSalesQuery(limitCount?: number): Sale[] {
  return useLiveQuery(
    () => salesRepo.getAll(limitCount),
    ['sales', 'sale_items', 'sale_payments'],
    [limitCount],
  );
}
