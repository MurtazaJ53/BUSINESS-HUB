import { FieldPath } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE";

interface StaffSummarySeed {
  id: string;
  name: string;
  role?: string;
  salary: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  totalHours: number;
  overtimeHours: number;
  bonusTotal: number;
  paidAmount: number;
}

const db = admin.firestore();

const toDateKey = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
};

const toMonthKey = (dateKey: string) => dateKey.slice(0, 7).replace("-", "");

const monthRangeFromKey = (monthKey?: string) => {
  const normalized = monthKey && /^\d{6}$/.test(monthKey)
    ? `${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}`
    : new Date().toISOString().slice(0, 7);
  const start = `${normalized}-01`;
  const monthStart = new Date(`${start}T00:00:00.000Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  return {
    monthKey: normalized.replace("-", ""),
    start,
    end: nextMonth.toISOString().slice(0, 10),
  };
};

const parseNumber = (value: unknown) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundOne = (value: number) => Number(value.toFixed(1));

const applyDailyMetricDelta = async (
  shopId: string,
  dateKey: string | null,
  field: "expenseTotal" | "customerPaymentTotal",
  delta: number,
) => {
  if (!dateKey || delta === 0) return;
  await db.doc(`shops/${shopId}/aggregates_daily/${dateKey}`).set({
    [field]: admin.firestore.FieldValue.increment(delta),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
};

const buildPaidAmountMap = (
  expenses: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[],
  staffByName: Map<string, StaffSummarySeed>,
) => {
  expenses.forEach((docSnap) => {
    const data = docSnap.data();
    const description = String(data.description || "");
    for (const staff of staffByName.values()) {
      if (description.includes(staff.name)) {
        staff.paidAmount += parseNumber(data.amount);
      }
    }
  });
};

export async function rebuildDashboardSnapshot(shopId: string): Promise<void> {
  const todayKey = new Date().toISOString().slice(0, 10);
  const trailingStart = new Date();
  trailingStart.setUTCDate(trailingStart.getUTCDate() - 29);
  const trailingStartKey = trailingStart.toISOString().slice(0, 10);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;

  const [dailyAggs, monthExpenses] = await Promise.all([
    db.collection(`shops/${shopId}/aggregates_daily`)
      .where(FieldPath.documentId(), ">=", trailingStartKey)
      .where(FieldPath.documentId(), "<=", todayKey)
      .get(),
    db.collection(`shops/${shopId}/expenses`)
      .where("date", ">=", monthStartKey)
      .where("date", "<=", todayKey)
      .get(),
  ]);

  let trailingRevenue = 0;
  let trailingGrossProfit = 0;
  let trailingTxCount = 0;
  let todayRevenue = 0;
  let todayTxCount = 0;

  dailyAggs.forEach((docSnap) => {
    const data = docSnap.data();
    const revenue = parseNumber(data.revenue);
    const grossProfit = parseNumber(data.grossProfit);
    const txCount = parseNumber(data.txCount);
    trailingRevenue += revenue;
    trailingGrossProfit += grossProfit;
    trailingTxCount += txCount;
    if (docSnap.id === todayKey) {
      todayRevenue = revenue;
      todayTxCount = txCount;
    }
  });

  const monthExpenseTotal = monthExpenses.docs.reduce((sum, docSnap) => sum + parseNumber(docSnap.data().amount), 0);

  await db.doc(`shops/${shopId}/dashboard_snapshot/current`).set({
    trailing30dRevenue: Math.round(trailingRevenue),
    trailing30dGrossProfit: Math.round(trailingGrossProfit),
    trailing30dNetProfit: Math.round(trailingGrossProfit - monthExpenseTotal),
    trailing30dTxCount: trailingTxCount,
    todayRevenue: Math.round(todayRevenue),
    todayTxCount,
    monthExpenseTotal: Math.round(monthExpenseTotal),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function rebuildCustomerCreditSummaries(shopId: string, customerId?: string): Promise<void> {
  const customersQuery = customerId
    ? db.collection(`shops/${shopId}/customers`).where(FieldPath.documentId(), "==", customerId)
    : db.collection(`shops/${shopId}/customers`);
  const snapshot = await customersQuery.get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    batch.set(db.doc(`shops/${shopId}/customer_credit_summary/${docSnap.id}`), {
      customerId: docSnap.id,
      name: data.name || "",
      phone: data.phone || "",
      balance: parseNumber(data.balance),
      totalSpent: parseNumber(data.totalSpent),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

export async function rebuildPayrollSummaries(
  shopId: string,
  options: { monthKey?: string; staffIds?: string[] } = {},
): Promise<void> {
  const { monthKey, staffIds } = options;
  const range = monthRangeFromKey(monthKey);

  const [staffDocs, privateDocs, attendanceDocs, expenseDocs] = await Promise.all([
    db.collection(`shops/${shopId}/staff`).get(),
    db.collection(`shops/${shopId}/staff_private`).get(),
    db.collection(`shops/${shopId}/attendance`)
      .where("date", ">=", range.start)
      .where("date", "<=", range.end)
      .get(),
    db.collection(`shops/${shopId}/expenses`)
      .where("date", ">=", range.start)
      .where("date", "<=", range.end)
      .get(),
  ]);

  const filterIds = staffIds?.length ? new Set(staffIds) : null;
  const privateById = new Map<string, number>();
  privateDocs.forEach((docSnap) => {
    privateById.set(docSnap.id, parseNumber(docSnap.data().salary));
  });

  const staffById = new Map<string, StaffSummarySeed>();
  const staffByName = new Map<string, StaffSummarySeed>();
  staffDocs.forEach((docSnap) => {
    if (filterIds && !filterIds.has(docSnap.id)) return;
    const data = docSnap.data();
    const seed: StaffSummarySeed = {
      id: docSnap.id,
      name: String(data.name || docSnap.id),
      role: data.role,
      salary: privateById.get(docSnap.id) || 0,
      fullDays: 0,
      halfDays: 0,
      absentDays: 0,
      leaveDays: 0,
      totalHours: 0,
      overtimeHours: 0,
      bonusTotal: 0,
      paidAmount: 0,
    };
    staffById.set(docSnap.id, seed);
    staffByName.set(seed.name, seed);
  });

  attendanceDocs.forEach((docSnap) => {
    const data = docSnap.data();
    const seed = staffById.get(String(data.staffId || ""));
    if (!seed) return;
    const status = String(data.status || "ABSENT") as AttendanceStatus;
    if (status === "PRESENT") seed.fullDays += 1;
    else if (status === "HALF_DAY") seed.halfDays += 1;
    else if (status === "LEAVE") seed.leaveDays += 1;
    else seed.absentDays += 1;
    seed.totalHours += parseNumber(data.totalHours);
    seed.overtimeHours += parseNumber(data.overtime);
    seed.bonusTotal += parseNumber(data.bonus);
  });

  buildPaidAmountMap(
    expenseDocs.docs.filter((docSnap) => {
      const category = String(docSnap.data().category || "");
      return category === "Staff Salary" || category === "Advance Salary";
    }),
    staffByName,
  );

  const batch = db.batch();
  staffById.forEach((seed) => {
    const effectiveDays = seed.fullDays + seed.halfDays * 0.5;
    const dailyRate = seed.salary / 30;
    const hourlyRate = dailyRate / 9;
    const overtimePay = seed.overtimeHours * hourlyRate;
    const earned = Math.round((effectiveDays * dailyRate) + overtimePay + seed.bonusTotal);
    batch.set(db.doc(`shops/${shopId}/staff_payroll_summary/${seed.id}_${range.monthKey}`), {
      staffId: seed.id,
      monthKey: range.monthKey,
      staffName: seed.name,
      role: seed.role || "staff",
      baseSalary: seed.salary,
      effectiveDays,
      fullDays: seed.fullDays,
      halfDays: seed.halfDays,
      absentDays: seed.absentDays,
      leaveDays: seed.leaveDays,
      totalHours: roundOne(seed.totalHours),
      overtimeHours: roundOne(seed.overtimeHours),
      bonusTotal: Math.round(seed.bonusTotal),
      overtimePay: Math.round(overtimePay),
      earned,
      paidAmount: Math.round(seed.paidAmount),
      outstanding: Math.max(0, earned - Math.round(seed.paidAmount)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

export const onCustomerWriteSummary = onDocumentWritten({
  document: "shops/{shopId}/customers/{customerId}",
  maxInstances: 2,
}, async (event) => {
  await rebuildCustomerCreditSummaries(event.params.shopId, event.params.customerId);
});

export const onCustomerPaymentWriteSummary = onDocumentWritten({
  document: "shops/{shopId}/customer_payments/{paymentId}",
  maxInstances: 2,
}, async (event) => {
  const shopId = event.params.shopId;
  const afterData = event.data?.after.exists ? event.data.after.data() : null;
  const beforeData = event.data?.before.exists ? event.data.before.data() : null;
  const beforeDate = toDateKey(beforeData?.date);
  const afterDate = toDateKey(afterData?.date);

  if (beforeDate && beforeDate === afterDate) {
    const delta = parseNumber(afterData?.amount) - parseNumber(beforeData?.amount);
    await applyDailyMetricDelta(shopId, afterDate, "customerPaymentTotal", delta);
  } else {
    await applyDailyMetricDelta(shopId, beforeDate, "customerPaymentTotal", -parseNumber(beforeData?.amount));
    await applyDailyMetricDelta(shopId, afterDate, "customerPaymentTotal", parseNumber(afterData?.amount));
  }
  await rebuildDashboardSnapshot(event.params.shopId);
});

export const onExpenseWriteSummary = onDocumentWritten({
  document: "shops/{shopId}/expenses/{expenseId}",
  maxInstances: 2,
}, async (event) => {
  const shopId = event.params.shopId;
  const afterData = event.data?.after.exists ? event.data.after.data() : null;
  const beforeData = event.data?.before.exists ? event.data.before.data() : null;
  const beforeDate = toDateKey(beforeData?.date);
  const afterDate = toDateKey(afterData?.date);

  if (beforeDate && beforeDate === afterDate) {
    const delta = parseNumber(afterData?.amount) - parseNumber(beforeData?.amount);
    await applyDailyMetricDelta(shopId, afterDate, "expenseTotal", delta);
  } else {
    await applyDailyMetricDelta(shopId, beforeDate, "expenseTotal", -parseNumber(beforeData?.amount));
    await applyDailyMetricDelta(shopId, afterDate, "expenseTotal", parseNumber(afterData?.amount));
  }

  await rebuildDashboardSnapshot(shopId);

  const category = String(afterData?.category || beforeData?.category || "");
  const payrollDates = new Set([beforeDate, afterDate].filter(Boolean) as string[]);
  if (category === "Staff Salary" || category === "Advance Salary") {
    for (const payrollDate of payrollDates) {
      await rebuildPayrollSummaries(shopId, { monthKey: toMonthKey(payrollDate) });
    }
  }
});

export const onAttendanceWriteSummary = onDocumentWritten({
  document: "shops/{shopId}/attendance/{attendanceId}",
  maxInstances: 2,
}, async (event) => {
  const shopId = event.params.shopId;
  const afterData = event.data?.after.exists ? event.data.after.data() : null;
  const beforeData = event.data?.before.exists ? event.data.before.data() : null;
  const dateKey = toDateKey(afterData?.date || beforeData?.date);
  const staffId = String(afterData?.staffId || beforeData?.staffId || "");
  if (!dateKey || !staffId) return;
  await rebuildPayrollSummaries(shopId, {
    monthKey: toMonthKey(dateKey),
    staffIds: [staffId],
  });
});
