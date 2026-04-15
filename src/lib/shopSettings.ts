// ── Shop settings persisted in localStorage ─────────────────────────────────
const LS_KEY = 'biz_shop_settings';

export interface ShopSettings {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  gst: string;
  footer: string;
  currency: string;
}

const DEFAULTS: ShopSettings = {
  name: 'My Shop',
  tagline: '',
  address: '',
  phone: '',
  gst: '',
  footer: 'Thank you! Visit again 😊',
  currency: 'INR',
};

export function loadShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveShopSettings(settings: ShopSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}
