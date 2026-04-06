export const runtime = "nodejs";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDateRu(dateString) {
  if (!dateString) return "";
  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return dateString;
  return `${day}.${month}.${year}`;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      bookingId,
      telegramId,
      routeName,
      tripDate,
      departureTime,
      passengersCount,
      pickupPoint,
      dropoffPoint,
    } = body || {};

    if (!bookingId || !telegramId) {
      return Response.json(
        { ok: false, error: "bookingId и telegramId обязательны" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";

    if (!botToken) {
      return Response.json(
        { ok: false, error: "TELEGRAM_BOT_TOKEN не задан" },
        { status: 500 }
      );
    }

    const editUrl = appUrl
      ? `${appUrl}/booking/${bookingId}?action=edit`
      : `https://t.me/`;

    const cancelUrl = appUrl
      ? `${appUrl}/booking/${bookingId}?action=cancel`
      : `https://t.me/`;

    const text =
      `🚐 <b>Бронирование создано</b>\n\n` +
      `Маршрут: <b>${escapeHtml(routeName)}</b>\n` +
      `Дата: <b>${escapeHtml(formatDateRu(tripDate))}</b>\n` +
      `Время: <b>${escapeHtml(departureTime)}</b>\n` +
      `Пассажиров: <b>${escapeHtml(passengersCount)}</b>\n` +
      `Посадка: <b>${escapeHtml(pickupPoint)}</b>\n` +
      `Высадка: <b>${escapeHtml(dropoffPoint)}</b>`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Изменить",
                  url: editUrl,
                },
                {
                  text: "Отменить",
                  url: cancelUrl,
                },
              ],
            ],
          },
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      console.error("Ошибка Telegram API:", telegramData);

      return Response.json(
        {
          ok: false,
          error: "Не удалось отправить сообщение в Telegram",
          details: telegramData,
        },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      result: telegramData.result,
    });
  } catch (error) {
    console.error("Ошибка route send-booking-notification:", error);

    return Response.json(
      {
        ok: false,
        error: "Внутренняя ошибка сервера",
      },
      { status: 500 }
    );
  }
}
