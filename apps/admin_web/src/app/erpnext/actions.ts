"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";

function getRequiredShopId(formData: FormData): string {
  const shopId = String(formData.get("shopId") || "").trim();
  if (!shopId) {
    throw new Error("Missing shop id.");
  }
  return shopId;
}

function getOptionalField(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function buildRedirectUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/erpnext?${searchParams.toString()}`;
}

async function runERPNextAction(
  formData: FormData,
  {
    action,
    pathBuilder,
    bodyBuilder,
  }: {
    action: string;
    pathBuilder: (shopId: string) => string;
    bodyBuilder?: (formData: FormData) => unknown;
  },
) {
  const shopId = getRequiredShopId(formData);
  const shopSlug = getOptionalField(formData, "shopSlug");

  let successResult: Record<string, unknown> | null = null;

  try {
    successResult = await apiMutation<Record<string, unknown>>(pathBuilder(shopId), {
      method: "POST",
      body: bodyBuilder ? bodyBuilder(formData) : {},
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown ERPNext action failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action,
        shop: shopSlug,
        message,
      }),
    );
  }

  revalidatePath("/erpnext");
  redirect(
    buildRedirectUrl({
      status: "success",
      action,
      shop: shopSlug,
      summary: JSON.stringify(successResult).slice(0, 180),
    }),
  );
}

function standardActionBody(formData: FormData) {
  const rawLimit = Number(String(formData.get("limit") || "100"));
  return { limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100 };
}

export async function verifyConnectionAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "verify-connection",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/verify-connection/`,
  });
}

export async function syncItemsAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "sync-items",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/sync-items/`,
    bodyBuilder: standardActionBody,
  });
}

export async function syncCustomersAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "sync-customers",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/sync-customers/`,
    bodyBuilder: standardActionBody,
  });
}

export async function syncStockAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "sync-stock",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/sync-stock/`,
    bodyBuilder: standardActionBody,
  });
}

export async function syncSuppliersAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "sync-suppliers",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/sync-suppliers/`,
    bodyBuilder: standardActionBody,
  });
}

export async function syncPurchasesAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "sync-purchases",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/sync-purchases/`,
    bodyBuilder: standardActionBody,
  });
}

export async function syncSupplierPaymentsAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "sync-supplier-payments",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/sync-supplier-payments/`,
    bodyBuilder: standardActionBody,
  });
}

export async function pushSalesAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "push-sales",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/push-sales/`,
    bodyBuilder: standardActionBody,
  });
}

export async function pushPaymentsAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "push-payments",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/push-payments/`,
    bodyBuilder: standardActionBody,
  });
}

export async function runCycleAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "run-cycle",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/run-cycle/`,
    bodyBuilder: () => ({
      limit: 100,
      verify_connection: true,
      sync_items: true,
      sync_customers: true,
      sync_stock: true,
      sync_suppliers: true,
      sync_purchases: true,
      sync_supplier_payments: true,
      push_sales: true,
      push_payments: true,
    }),
  });
}

export async function enqueueCycleAction(formData: FormData) {
  await runERPNextAction(formData, {
    action: "enqueue-cycle",
    pathBuilder: (shopId) => `/shops/${shopId}/erpnext/enqueue-cycle/`,
    bodyBuilder: () => ({
      limit: 100,
      verify_connection: true,
      sync_items: true,
      sync_customers: true,
      sync_stock: true,
      sync_suppliers: true,
      sync_purchases: true,
      sync_supplier_payments: true,
      push_sales: true,
      push_payments: true,
    }),
  });
}
