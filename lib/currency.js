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

  const safeCurrency = currency || "RUB";
  const symbol = getCurrencySymbol(safeCurrency);

  // формат числа (разделители)
  const formattedValue = Number(value).toLocaleString("ru-RU");

  return `${formattedValue} ${symbol}`;
}
