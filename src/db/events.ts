/**
 * Table Event Bus — Simple pub/sub for SQLite table changes
 */

type Listener = () => void;

class TableEventBus {
  private listeners: Map<string, Set<Listener>> = new Map();
  private pendingListeners: Set<Listener> = new Set();
  private flushQueued = false;

  private scheduleFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;

    queueMicrotask(() => {
      this.flushQueued = false;
      const listeners = Array.from(this.pendingListeners);
      this.pendingListeners.clear();
      listeners.forEach((listener) => listener());
    });
  }

  /** Emit a change event for one or more tables. */
  emit(tables: string | string[]): void {
    const tableList = Array.isArray(tables) ? tables : [tables];

    for (const table of tableList) {
      const set = this.listeners.get(table);
      if (set) {
        set.forEach((listener) => this.pendingListeners.add(listener));
      }
    }

    this.scheduleFlush();
  }

  /** Subscribe to changes on specific tables. */
  on(tables: string | string[], cb: Listener): () => void {
    const tableList = Array.isArray(tables) ? tables : [tables];
    
    for (const table of tableList) {
      if (!this.listeners.has(table)) {
        this.listeners.set(table, new Set());
      }
      this.listeners.get(table)!.add(cb);
    }

    return () => {
      for (const table of tableList) {
        this.listeners.get(table)?.delete(cb);
      }
    };
  }
}

export const tableEvents = new TableEventBus();
