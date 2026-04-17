import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isValidIndianPhone(phone: string): boolean {
  // Regex for standard 10-digit Indian mobile starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(phone);
}

export function sanitizePhone(input: string): string {
  // Only allow digits 0-9
  return input.replace(/\D/g, '').slice(0, 10);
}
