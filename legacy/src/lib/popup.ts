import { create } from 'zustand';

export type AppPopupVariant = 'info' | 'success' | 'warning' | 'error';

export interface AppPopupOptions {
  title?: string;
  message: string;
  confirmText?: string;
  variant?: AppPopupVariant;
}

interface AppPopupState {
  current: Required<AppPopupOptions> | null;
  showPopup: (options: AppPopupOptions) => void;
  closePopup: () => void;
}

const defaults: Required<Omit<AppPopupOptions, 'message'>> = {
  title: 'Notice',
  confirmText: 'OK',
  variant: 'info',
};

export const normalizePopupMessage = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value === null || value === undefined) return 'Unknown system message.';

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const useAppPopupStore = create<AppPopupState>((set) => ({
  current: null,
  showPopup: (options) =>
    set({
      current: {
        ...defaults,
        ...options,
        message: normalizePopupMessage(options.message),
      },
    }),
  closePopup: () => set({ current: null }),
}));

export const showAppPopup = (
  messageOrOptions: string | AppPopupOptions,
  fallback?: Omit<AppPopupOptions, 'message'>
) => {
  const options =
    typeof messageOrOptions === 'string'
      ? {
          message: messageOrOptions,
          ...fallback,
        }
      : messageOrOptions;

  useAppPopupStore.getState().showPopup(options);
};
