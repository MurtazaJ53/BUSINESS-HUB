import "server-only";

import { cache } from "react";

import type { InventoryItem, InventoryStats, SessionPayload, ShopMembership } from "@/lib/types";

type FetchOptions = {
  query?: Record<string, string | undefined>;
};

const API_BASE_URL =
  process.env.BUSINESS_HUB_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api/v1";

function buildHeaders() {
  const headers = new Headers({
    Accept: "application/json",
  });

  const devEmail = process.env.BUSINESS_HUB_DEV_USER_EMAIL?.trim();
  if (devEmail) {
    headers.set("X-Dev-User-Email", devEmail);
  }

  const devName = process.env.BUSINESS_HUB_DEV_USER_NAME?.trim();
  if (devName) {
    headers.set("X-Dev-User-Name", devName);
  }

  const devPlatformAdmin = process.env.BUSINESS_HUB_DEV_PLATFORM_ADMIN?.trim();
  if (devPlatformAdmin) {
    headers.set("X-Dev-Platform-Admin", devPlatformAdmin);
  }

  return headers;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Business Hub API request failed (${response.status}) for ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export const getSession = cache(async (): Promise<SessionPayload> => {
  return apiFetch<SessionPayload>("/session/");
});

export const getMemberships = cache(async (): Promise<ShopMembership[]> => {
  return apiFetch<ShopMembership[]>("/shops/");
});

export const getInventory = cache(async (shopId: string, query?: string): Promise<InventoryItem[]> => {
  return apiFetch<InventoryItem[]>(`/shops/${shopId}/inventory/`, {
    query: {
      q: query,
    },
  });
});

export function resolveActiveShop(session: SessionPayload): ShopMembership | null {
  if (!session.active_shop_id) {
    return session.memberships[0] ?? null;
  }

  return (
    session.memberships.find((membership) => membership.shop.id === session.active_shop_id) ??
    session.memberships[0] ??
    null
  );
}

export function buildInventoryStats(items: InventoryItem[]): InventoryStats {
  const categorySet = new Set(
    items
      .map((item) => item.category.trim())
      .filter(Boolean),
  );

  const projectedSellValue = items.reduce((total, item) => {
    const price = Number(item.sell_price);
    return total + (Number.isFinite(price) ? price : 0) * item.stock_on_hand;
  }, 0);

  return {
    totalItems: items.length,
    activeItems: items.filter((item) => item.status === "active" && !item.tombstone).length,
    lowStockItems: items.filter((item) => item.stock_on_hand > 0 && item.stock_on_hand <= 5).length,
    outOfStockItems: items.filter((item) => item.stock_on_hand <= 0).length,
    categories: categorySet.size,
    projectedSellValue,
  };
}
