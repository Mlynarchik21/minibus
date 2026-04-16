export function getTelegramUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const tg = window.Telegram?.WebApp;
  if (!tg) {
    return null;
  }

  const user = tg.initDataUnsafe?.user;
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? null,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    username: user.username || "",
    language_code: user.language_code || "",
    is_premium: Boolean(user.is_premium),
  };
}

export function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp || null;
}

export function initTelegramApp() {
  if (typeof window === "undefined") {
    return null;
  }

  const tg = window.Telegram?.WebApp;

  if (!tg) {
    return null;
  }

  try {
    if (typeof tg.ready === "function") {
      tg.ready();
    }

    if (typeof tg.expand === "function") {
      tg.expand();
    }

    if (typeof tg.setHeaderColor === "function") {
      try {
        tg.setHeaderColor("#f5f7fb");
      } catch {}
    }

    if (typeof tg.setBackgroundColor === "function") {
      try {
        tg.setBackgroundColor("#f5f7fb");
      } catch {}
    }
  } catch (error) {
    console.error("Ошибка initTelegramApp:", error);
  }

  return tg;
}
