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
    id: user.id || null,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    username: user.username || "",
  };
}

export function initTelegramApp() {
  if (typeof window === "undefined") {
    return;
  }

  const tg = window.Telegram?.WebApp;

  if (!tg) {
    return;
  }

  tg.ready();

  if (tg.expand) {
    tg.expand();
  }
}
