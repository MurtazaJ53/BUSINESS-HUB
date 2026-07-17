import { Sale, InventoryItem } from './types';

/**
 * Calculates how many units of an item are sold per day on average.
 * @param itemId The product ID (InventoryItem.id)
 * @param sales The list of all sales
 * @param days The window to look back (default 30)
 */
export function calculateSalesVelocity(itemId: string, sales: Sale[], days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const recentSales = sales.filter(s => s.date >= cutoffStr);
  let totalSold = 0;

  for (const sale of recentSales) {
    for (const item of sale.items) {
      if (item.itemId === itemId && !item.isReturn) {
        totalSold += item.quantity;
      }
    }
  }

  return totalSold / days;
}

/**
 * Predicts how many days of stock are remaining.
 */
export function calculateDaysRemaining(stock: number, velocity: number): number | 'Infinity' {
  if (velocity <= 0) return 'Infinity';
  return Math.floor(stock / velocity);
}

/**
 * Identifies products that haven't sold in the last X days.
 */
export function getDeadStock(inventory: InventoryItem[], sales: Sale[], days: number = 30): InventoryItem[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const soldItemIds = new Set<string>();
  sales.filter(s => s.date >= cutoffStr).forEach(s => {
    s.items.forEach(i => soldItemIds.add(i.itemId));
  });

  return inventory.filter(item => !soldItemIds.has(item.id) && (item.stock ?? 0) > 0);
}
