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

function buildBookingMessage({
  routeName,
  tripDate,
  departureTime,
  travelDuration,
  passengersCount,
  pickupPoint,
  dropoffPoint,
  contactName,
}) {
  return (
    `🧾 <b>Информация о бронировании</b>\n\n` +
    `Имя: <b>${escapeHtml(contactName || "Не указано")}</b>\n` +
    `Маршрут: <b>${escapeHtml(routeName)}</b>\n` +
    `Дата: <b>${escapeHtml(formatDateRu(tripDate))}</b>\n` +
    `Время отправления: <b>${escapeHtml(departureTime)}</b>\n` +
    `Время в пути: <b>${escapeHtml(travelDuration || "Уточняется")}</b>\n\n` +
    `Пассажиров: <b>${escapeHtml(passengersCount)}</b>\n` +
    `Посадка: <b>${escapeHtml(pickupPoint)}</b>\n` +
    `Высадка: <b>${escapeHtml(dropoffPoint)}</b>\n\n` +
    `⏰ Пожалуйста, прибудьте за <b>5 минут</b> до окончания посадки.`
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
    const travelDuration = body.travelDuration;
    const passengersCount = body.passengersCount;
    const pickupPoint = body.pickupPoint;
    const dropoffPoint = body.dropoffPoint;
    const contactName = body.contactName;

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

    const messageText =
      customText ||
      buildBookingMessage({
        routeName,
        tripDate,
        departureTime,
        travelDuration,
        passengersCount,
        pickupPoint,
        dropoffPoint,
        contactName,
      });

    const editUrl = `${appUrl}/booking/${bookingId}?action=edit`;
    const cancelUrl = `${appUrl}/booking/${bookingId}?action=cancel`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: telegramId,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🟢 Изменить",
                  url: editUrl,
                },
                {
                  text: "🔴 Отменить",
                  url: cancelUrl,
                },
              ],
            ],
          },
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    console.log("Telegram API response:", telegramData);

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
    console.error("Ошибка send-booking-notification:", error);

    return Response.json(
      {
        error: "Ошибка при отправке уведомления",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
