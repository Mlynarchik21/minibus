export async function POST(request) {
  try {
    const body = await request.json();
    const telegramId = body.telegramId;
    const text = body.text || "Тестовое уведомление из MiniBus";

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
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramData.ok) {
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
        error: "Ошибка при отправке уведомления",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
