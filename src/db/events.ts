/**
 * Table Event Bus — Simple pub/sub for SQLite table changes
 */

type Listener = () => void;

class TableEventBus {
  private listeners: Map<string, Set<Listener>> = new Map();

  /** Emit a change event for one or more tables. */
  emit(tables: string | string[]): void {
    const tableList = Array.isArray(tables) ? tables : [tables];
    const uniqueListeners = new Set<Listener>();

    for (const table of tableList) {
      const set = this.listeners.get(table);
      if (set) {
        set.forEach(l => uniqueListeners.add(l));
      }
    }

    // Call all unique listeners once
    uniqueListeners.forEach(l => l());
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
