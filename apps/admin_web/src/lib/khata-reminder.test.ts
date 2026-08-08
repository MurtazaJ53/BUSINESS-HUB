import { describe, expect, it } from "vitest";

import {
  buildKhataReminder,
  buildUpiUri,
  normalizeWhatsAppNumber,
  UpiRequestError,
  whatsAppLink,
} from "@/lib/khata-reminder";

/**
 * This message goes to a real customer asking for real money, and the same
 * customer may receive it from the counter (Dart) or the office (this file).
 * Both must produce identical text.
 */

describe("buildUpiUri", () => {
  it("builds a pay link with the exact amount", () => {
    const uri = buildUpiUri({
      payeeVpa: "shop@okaxis",
      payeeName: "Sharma Store",
      amount: 1250.5,
      note: "Khata payment",
    });
    expect(uri).toContain("pa=shop%40okaxis");
    expect(uri).toContain("am=1250.50");
    expect(uri).toContain("cu=INR");
    expect(uri).toContain("tn=Khata%20payment");
  });

  it("always sends two decimals, because UPI apps reject loose amounts", () => {
    expect(buildUpiUri({ payeeVpa: "s@ok", payeeName: "S", amount: 100 })).toContain(
      "am=100.00"
    );
  });

  it("rejects a malformed UPI id rather than producing a dead link", () => {
    expect(() =>
      buildUpiUri({ payeeVpa: "not-a-vpa", payeeName: "S", amount: 10 })
    ).toThrow(UpiRequestError);
  });

  it("rejects a zero amount", () => {
    expect(() => buildUpiUri({ payeeVpa: "s@ok", payeeName: "S", amount: 0 })).toThrow(
      UpiRequestError
    );
  });

  it("falls back to a placeholder payee name rather than sending an empty one", () => {
    expect(buildUpiUri({ payeeVpa: "s@ok", payeeName: "  ", amount: 5 })).toContain(
      "pn=Merchant"
    );
  });
});

describe("buildKhataReminder", () => {
  it("names the customer, the shop and the exact balance", () => {
    const text = buildKhataReminder({
      shopName: "Sharma Store",
      customerName: "Anil",
      balance: 450,
    });
    expect(text).toBe(
      "Hello Anil, this is a friendly reminder from Sharma Store. " +
        "Your pending balance is ₹450.00.\n\nThank you!"
    );
  });

  it("appends a tappable pay link when a UPI id is configured", () => {
    const text = buildKhataReminder({
      shopName: "Sharma Store",
      customerName: "Anil",
      balance: 450,
      upiVpa: "sharma@okaxis",
    });
    expect(text).toContain("Pay instantly on any UPI app:");
    expect(text).toContain("upi://pay?pa=sharma%40okaxis");
    expect(text).toContain("am=450.00");
  });

  it("still sends the reminder when the UPI id is misconfigured", () => {
    // Losing the pay link is a nuisance; failing to chase the money is worse.
    const text = buildKhataReminder({
      shopName: "Shop",
      customerName: "Anil",
      balance: 450,
      upiVpa: "garbage",
    });
    expect(text).toContain("Your pending balance is ₹450.00.");
    expect(text).not.toContain("upi://");
  });

  it("thanks a customer who owes nothing instead of demanding ₹0", () => {
    expect(
      buildKhataReminder({ shopName: "Shop", customerName: "Anil", balance: 0 })
    ).toBe("Hello Anil, thank you for shopping with Shop!");
  });

  it("never demands money on a credit balance", () => {
    expect(
      buildKhataReminder({ shopName: "Shop", customerName: "Anil", balance: -50 })
    ).toContain("thank you for shopping");
  });

  it("falls back to friendly placeholders for missing names", () => {
    const text = buildKhataReminder({ shopName: "  ", customerName: "", balance: 10 });
    expect(text).toContain("Hello there,");
    expect(text).toContain("from our shop.");
  });
});

describe("normalizeWhatsAppNumber", () => {
  it("adds India's country code to a bare 10-digit mobile", () => {
    expect(normalizeWhatsAppNumber("9876543210")).toBe("919876543210");
  });

  it("strips a leading zero before adding the country code", () => {
    expect(normalizeWhatsAppNumber("09876543210")).toBe("919876543210");
  });

  it("leaves an already-prefixed number alone", () => {
    expect(normalizeWhatsAppNumber("+91 98765 43210")).toBe("919876543210");
  });

  it("returns null for a number too short to message", () => {
    expect(whatsAppLink("98765", "hi")).toBeNull();
  });

  it("encodes the message into the link", () => {
    const link = whatsAppLink("9876543210", "Hello Anil, ₹450.00 due");
    expect(link).toContain("https://wa.me/919876543210?text=");
    expect(link).toContain(encodeURIComponent("₹450.00"));
  });
});

describe("statement link in the reminder", () => {
  it("is included when one was minted", () => {
    const message = buildKhataReminder({
      shopName: "Kirana Corner",
      customerName: "Ramesh",
      balance: 4200,
      statementUrl: "https://shop.example.com/khata/abc123",
    });
    expect(message).toContain("https://shop.example.com/khata/abc123");
    expect(message).toContain("See your full khata");
  });

  it("is omitted when minting failed, so the chase still goes out", () => {
    const message = buildKhataReminder({
      shopName: "Kirana Corner",
      customerName: "Ramesh",
      balance: 4200,
    });
    expect(message).not.toContain("See your full khata");
    expect(message).toContain("4200.00");
  });

  it("is left out of a nothing-owed message", () => {
    const message = buildKhataReminder({
      shopName: "Kirana Corner",
      customerName: "Ramesh",
      balance: 0,
      statementUrl: "https://shop.example.com/khata/abc123",
    });
    expect(message).not.toContain("khata/abc123");
  });
});
