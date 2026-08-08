import fs from "node:fs/promises";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const args = new Map();

for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];
  if (!arg.startsWith("--")) continue;

  const normalized = arg.replace(/^--/, "");
  const [key, inlineValue] = normalized.split("=");
  if (inlineValue !== undefined) {
    args.set(key, inlineValue);
    continue;
  }

  const nextValue = rawArgs[index + 1];
  if (nextValue && !nextValue.startsWith("--")) {
    args.set(key, nextValue);
    index += 1;
    continue;
  }

  args.set(key, "true");
}

const inventoryCount = Number(args.get("inventory") || 5000);
const customerCount = Number(args.get("customers") || 5000);
const salesCount = Number(args.get("sales") || 20000);
const itemsPerSale = Number(args.get("itemsPerSale") || 3);
const outDir = path.resolve(process.cwd(), args.get("outDir") || ".artifacts/load-fixtures");

const currencyModes = ["CASH", "UPI", "CARD", "CREDIT", "ONLINE"];

const toDateKey = (offsetDays) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
};

const inventory = Array.from({ length: inventoryCount }, (_, index) => ({
  id: `fixture-item-${index + 1}`,
  name: `Fixture Item ${index + 1}`,
  sku: `SKU-${String(index + 1).padStart(6, "0")}`,
  category: `Category ${(index % 25) + 1}`,
  price: 50 + (index % 500),
  stock: 10 + (index % 1000),
  createdAt: new Date().toISOString(),
}));

const customers = Array.from({ length: customerCount }, (_, index) => ({
  id: `fixture-customer-${index + 1}`,
  name: `Fixture Customer ${index + 1}`,
  phone: `9000${String(index + 1).padStart(6, "0")}`,
  totalSpent: 0,
  balance: 0,
  createdAt: new Date().toISOString(),
}));

const sales = Array.from({ length: salesCount }, (_, index) => {
  const date = toDateKey(index % 90);
  const customerId = customers[index % customers.length]?.id;
  const mode = currencyModes[index % currencyModes.length];
  const items = Array.from({ length: itemsPerSale }, (_, itemOffset) => {
    const item = inventory[(index + itemOffset) % inventory.length];
    const quantity = (itemOffset % 4) + 1;
    return {
      itemId: item.id,
      name: item.name,
      quantity,
      price: item.price,
      costPrice: Math.max(1, Math.round(item.price * 0.65)),
    };
  });
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return {
    id: `fixture-sale-${index + 1}`,
    date,
    createdAt: `${date}T10:00:00.000Z`,
    total,
    discount: 0,
    discountValue: 0,
    discountType: "fixed",
    paymentMode: mode,
    payments: [{ mode, amount: total }],
    customerId,
    customerName: customers[index % customers.length]?.name,
    customerPhone: customers[index % customers.length]?.phone,
    items,
  };
});

await fs.mkdir(outDir, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(outDir, "inventory.json"), JSON.stringify(inventory, null, 2)),
  fs.writeFile(path.join(outDir, "customers.json"), JSON.stringify(customers, null, 2)),
  fs.writeFile(path.join(outDir, "sales.json"), JSON.stringify(sales, null, 2)),
]);

console.log(`Scale fixture written to ${outDir}`);
console.log(`Inventory: ${inventoryCount}`);
console.log(`Customers: ${customerCount}`);
console.log(`Sales: ${salesCount}`);
