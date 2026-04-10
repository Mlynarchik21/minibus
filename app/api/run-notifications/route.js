import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  try {
    const now = new Date();
    const appUrl = process.env.APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "APP_URL is not set" },
        {
          status: 500,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    // =========================================
    // 1. Напоминание за 1 час до отправления
    // Окно отправки: от 54 до 60 минут
    // =========================================

    const { data: bookingsForReminder, error: reminderError } = await supabase
      .from("bookings")
      .select(`
        *,
        trips (
          id,
          from_city,
          to_city,
          trip_date,
          departure_time
        )
      `)
      .in("status", ["new", "confirmed"])
      .eq("confirm_request_sent", false)
      .eq("departure_confirmed", false);

    if (reminderError) {
      console.error("Ошибка загрузки reminder:", reminderError);
    }

    for (const booking of bookingsForReminder || []) {
      const trip = booking.trips;
      if (!trip) continue;
      if (!booking.telegram_id) continue;

      const departureDateTime = new Date(
        `${trip.trip_date}T${String(trip.departure_time).slice(0, 5)}:00`
      );

      const diffMinutes =
        (departureDateTime.getTime() - now.getTime()) / (1000 * 60);

      const isInsideReminderWindow = diffMinutes <= 60 && diffMinutes > 54;

      if (isInsideReminderWindow) {
        try {
          const response = await fetch(
            `${appUrl}/api/send-booking-confirm-reminder`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                telegramId: booking.telegram_id,
                bookingId: booking.id,
                routeName: `${trip.from_city} → ${trip.to_city}`,
                tripDate: trip.trip_date,
                departureTime: String(trip.departure_time).slice(0, 5),
                passengersCount: booking.passengers_count,
                pickupPoint: booking.pickup_point,
              }),
              cache: "no-store",
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Ошибка HTTP reminder:", errorText);
            continue;
          }

          await supabase
            .from("bookings")
            .update({
              confirm_request_sent: true,
            })
            .eq("id", booking.id);
        } catch (err) {
          console.error("Ошибка отправки reminder:", err);
        }
      }
    }

    // =========================================
    // 2. Уведомление о завершении поездки
    // =========================================

    const { data: completedBookings, error: completedError } = await supabase
      .from("bookings")
      .select(`
        *,
        trips (
          id,
          from_city,
          to_city,
          trip_date,
          departure_time
        )
      `)
      .eq("status", "confirmed")
      .eq("trip_completed_notification_sent", false);

    if (completedError) {
      console.error("Ошибка загрузки completed:", completedError);
    }

    for (const booking of completedBookings || []) {
      const trip = booking.trips;
      if (!trip) continue;
      if (!booking.telegram_id) continue;

      const departureDateTime = new Date(
        `${trip.trip_date}T${String(trip.departure_time).slice(0, 5)}:00`
      );

      const endTime = new Date(
        departureDateTime.getTime() + 9 * 60 * 60 * 1000
      );

      if (now >= endTime) {
        try {
          const response = await fetch(
            `${appUrl}/api/send-trip-completed-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                telegramId: booking.telegram_id,
                bookingId: booking.id,
                routeName: `${trip.from_city} → ${trip.to_city}`,
              }),
              cache: "no-store",
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Ошибка HTTP completed:", errorText);
            continue;
          }

          await supabase
            .from("bookings")
            .update({
              trip_completed_notification_sent: true,
              trip_completed_notification_sent_at: new Date().toISOString(),
            })
            .eq("id", booking.id);
        } catch (err) {
          console.error("Ошибка отправки completed:", err);
        }
      }
    }

    return NextResponse.json(
      { success: true },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("CRON ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
