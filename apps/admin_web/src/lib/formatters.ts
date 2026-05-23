const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number, currencyCode = "INR") {
  if (currencyCode === "INR") {
    return currencyFormatter.format(amount);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRole(role: string) {
  switch (role.trim().toLowerCase()) {
    case "owner":
      return "Owner";
    case "admin":
      return "Store admin";
    case "staff":
      return "Staff operator";
    case "viewer":
      return "Read-only viewer";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}
