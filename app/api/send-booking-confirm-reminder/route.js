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

function buildConfirmReminderMessage({
  routeName,
  tripDate,
  departureTime,
  passengersCount,
  pickupPoint,
}) {
  return (
    `⏰ <b>Поездка скоро начнётся</b>\n\n` +
    `Маршрут: <b>${escapeHtml(routeName)}</b>\n` +
    `Дата: <b>${escapeHtml(formatDateRu(tripDate))}</b>\n` +
    `Время отправления: <b>${escapeHtml(departureTime)}</b>\n` +
    `Пассажиров: <b>${escapeHtml(passengersCount)}</b>\n` +
    `Посадка: <b>${escapeHtml(pickupPoint || "Уточняется")}</b>\n\n` +
    `Пожалуйста, подтвердите, что поездка актуальна.`
  );
}

export async function POST(request) {
  try {
    const body = await request.json();

    const telegramId = body.telegramId;
    const bookingId = body.bookingId;
    const routeName = body.routeName;
    const tripDate = body.tripDate;
    const departureTime = body.departureTime;
    const passengersCount = body.passengersCount;
    const pickupPoint = body.pickupPoint;
    const customText = body.text;

    if (!telegramId) {
      return Response.json(
        { error: "Не передан telegramId" },
        { status: 400 }
      );
    }

    if (!bookingId) {
      return Response.json(
        { error: "Не передан bookingId" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl =
      process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

    if (!botToken) {
      return Response.json(
        { error: "Не найден TELEGRAM_BOT_TOKEN в переменных окружения" },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return Response.json(
        {
          error:
            "Не найден APP_URL или NEXT_PUBLIC_APP_URL в переменных окружения",
        },
        { status: 500 }
      );
    }

    const text =
      customText ||
      buildConfirmReminderMessage({
        routeName,
        tripDate,
        departureTime,
        passengersCount,
        pickupPoint,
      });

    const confirmUrl = `${appUrl}/booking/${bookingId}?action=confirm`;

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
                  text: "Подтвердить бронирование",
                  url: confirmUrl,
                },
              ],
            ],
          },
        }),
      }
    );

    const telegramData = await telegramResponse.json();
    console.log("Telegram confirm reminder response:", telegramData);

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
    console.error("Ошибка при отправке напоминания о подтверждении:", error);

    return Response.json(
      {
        error: "Ошибка при отправке напоминания о подтверждении",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
