export async function POST(request) {
  try {
    const body = await request.json();

    const {
      telegram_id,
      booking_id,
      from_city,
      to_city,
      trip_date,
      departure_time,
    } = body || {};

    if (!telegram_id || !booking_id || !from_city || !to_city) {
      return Response.json(
        {
          ok: false,
          error:
            "Не хватает обязательных полей: telegram_id, booking_id, from_city, to_city",
        },
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
        {
          ok: false,
          error: "Не задан TELEGRAM_BOT_TOKEN",
        },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return Response.json(
        {
          ok: false,
          error: "Не задан APP_URL или NEXT_PUBLIC_APP_URL",
        },
        { status: 500 }
      );
    }

    const bookingUrl = `${appUrl.replace(/\/$/, "")}/booking/${booking_id}`;

    const routeLine = `${escapeMarkdown(from_city)} → ${escapeMarkdown(to_city)}`;
    const dateLine =
      trip_date && departure_time
        ? `\nДата поездки: ${escapeMarkdown(formatDateRu(trip_date))} в ${escapeMarkdown(
            normalizeTime(departure_time)
          )}`
        : "";

    const text =
      `*Поездка завершена*\n\n` +
      `Спасибо, что выбрали нас.\n` +
      `Ваш рейс по маршруту *${routeLine}* завершён.` +
      `${dateLine}\n\n` +
      `Перед выходом, пожалуйста, ещё раз проверьте салон и убедитесь, что вы не забыли:\n` +
      `— телефон\n` +
      `— документы\n` +
      `— кошелёк\n` +
      `— сумки и личные вещи\n\n` +
      `Если вам нужно уточнить информацию или связаться с водителем, нажмите кнопку ниже.`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: telegram_id,
          text,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Связаться с водителем",
                  url: bookingUrl,
                },
              ],
            ],
          },
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      return Response.json(
        {
          ok: false,
          error: telegramData?.description || "Ошибка отправки в Telegram",
          telegram: telegramData,
        },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      result: telegramData.result,
    });
  } catch (error) {
    console.error("send-trip-completed-notification error:", error);

    return Response.json(
      {
        ok: false,
        error: error.message || "Внутренняя ошибка сервера",
      },
      { status: 500 }
    );
  }
}

function normalizeTime(timeString) {
  return String(timeString || "").slice(0, 5);
}

function formatDateRu(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU");
}

function escapeMarkdown(value) {
  return String(value || "").replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
