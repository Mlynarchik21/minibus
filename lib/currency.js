export function getCurrencySymbol(currency) {
  const map = {
    RUB: "₽",
    BYN: "Br",
    USD: "$",
    EUR: "€",
  };

  return map[currency] || currency || "";
}

export function formatPrice(value, currency) {
  if (value === null || value === undefined) return "";

  const symbol = getCurrencySymbol(currency);

  return `${value} ${symbol}`;
}
