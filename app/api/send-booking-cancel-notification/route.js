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
  if (!year || !month || !day) return String(dateString);
  return `${day}.${month}.${year}`;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const telegramId = body.telegramId;
    const routeName = body.routeName;
    const tripDate = body.tripDate;
    const departureTime = body.departureTime;
    const passengersCount = body.passengersCount;

    if (!telegramId) {
      return Response.json(
        { error: "Не передан telegramId" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return Response.json(
        { error: "Не найден TELEGRAM_BOT_TOKEN в переменных окружения" },
        { status: 500 }
      );
    }

    const text =
      `❌ <b>Бронирование отменено</b>\n\n` +
      `Маршрут: <b>${escapeHtml(routeName)}</b>\n` +
      `Дата: <b>${escapeHtml(formatDateRu(tripDate))}</b>\n` +
      `Время отправления: <b>${escapeHtml(departureTime)}</b>\n` +
      `Пассажиров: <b>${escapeHtml(passengersCount)}</b>\n\n` +
      `Ваше бронирование было успешно отменено.`;

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
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      return Response.json(
        {
          error: "Telegram API вернул ошибку",
          details: telegramData,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      result: telegramData.result,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Ошибка при отправке уведомления об отмене",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
