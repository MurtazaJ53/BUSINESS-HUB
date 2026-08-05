/**
 * Port of `apps/mobile_flutter/lib/core/khata/khata_reminder.dart` and the UPI
 * link builder it uses.
 *
 * The wording has to match the phone exactly. A customer who gets one message
 * from the counter and a differently-worded one from the office reads it as two
 * separate demands for the same money.
 */

// Deliberately identical to `_vpaPattern` in upi_qr.dart. If the two ever
// disagree, a UPI id that works at the counter silently drops the pay link
// from the office's reminder (or the reverse).
const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{1,256}@[a-zA-Z]{2,64}$/;

export class UpiRequestError extends Error {}

/** UPI wants a plain two-decimal string — no grouping separators, no symbol. */
export function formatUpiAmount(amount: number): string {
  return amount.toFixed(2);
}

export function buildUpiUri({
  payeeVpa,
  payeeName,
  amount,
  note = "",
  transactionRef,
  currency = "INR",
}: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef?: string;
  currency?: string;
}): string {
  const vpa = payeeVpa.trim();
  if (!VPA_PATTERN.test(vpa)) {
    throw new UpiRequestError("Enter a valid UPI ID (e.g. name@bank).");
  }
  if (!(amount > 0)) {
    throw new UpiRequestError("Amount must be greater than zero.");
  }

  const params: [string, string][] = [
    ["pa", vpa],
    ["pn", payeeName.trim() || "Merchant"],
    ["am", formatUpiAmount(amount)],
    ["cu", currency],
  ];
  if (note.trim()) params.push(["tn", note.trim()]);
  if (transactionRef && transactionRef.trim()) {
    params.push(["tr", transactionRef.trim()]);
  }

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `upi://pay?${query}`;
}

/**
 * A friendly khata (credit) reminder. When a merchant UPI id is configured it
 * appends a tappable pay link pre-filled with the exact balance, so the
 * customer can clear the due from the message itself.
 */
export function buildKhataReminder({
  shopName,
  customerName,
  balance,
  upiVpa = "",
  note = "Khata payment",
}: {
  shopName: string;
  customerName: string;
  balance: number;
  upiVpa?: string;
  note?: string;
}): string {
  const shop = shopName.trim() || "our shop";
  const name = customerName.trim() || "there";

  if (!(balance > 0)) {
    return `Hello ${name}, thank you for shopping with ${shop}!`;
  }

  let message =
    `Hello ${name}, this is a friendly reminder from ${shop}. ` +
    `Your pending balance is ₹${balance.toFixed(2)}.`;

  const vpa = upiVpa.trim();
  if (vpa) {
    try {
      const uri = buildUpiUri({
        payeeVpa: vpa,
        payeeName: shop,
        amount: balance,
        note,
      });
      message += `\n\nPay instantly on any UPI app:\n${uri}`;
    } catch {
      // Misconfigured VPA — send the reminder without a pay link rather than
      // failing to chase the money at all.
    }
  }

  return `${message}\n\nThank you!`;
}

/** Mirrors `normalizeWhatsAppNumber` in the mobile app. */
export function normalizeWhatsAppNumber(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

/**
 * A wa.me link with the reminder ready to send, or null when the number is
 * unusable — the same 11-digit floor the mobile app applies before opening
 * WhatsApp.
 */
export function whatsAppLink(phone: string, message: string): string | null {
  const number = normalizeWhatsAppNumber(phone);
  if (number.length < 11) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
