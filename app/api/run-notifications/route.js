import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONFIRM_BEFORE_MINUTES = 60;

export async function GET() {
  try {
    const now = new Date();

    // =========================================
    // 1. Напоминание за 1 час
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
      .eq("status", "new")
      .eq("confirm_request_sent", false);

    if (reminderError) {
      console.error("Ошибка загрузки reminder:", reminderError);
    }

    for (const booking of bookingsForReminder || []) {
      const trip = booking.trips;
      if (!trip) continue;

      const departureDateTime = new Date(
        `${trip.trip_date}T${String(trip.departure_time).slice(0,5)}:00`
      );

      const diffMinutes =
        (departureDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes <= CONFIRM_BEFORE_MINUTES && diffMinutes > 0) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-booking-confirm-reminder`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              telegramId: booking.telegram_id,
              bookingId: booking.id,
              routeName: `${trip.from_city} → ${trip.to_city}`,
              tripDate: trip.trip_date,
              departureTime: String(trip.departure_time).slice(0,5),
            }),
          });

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
    // 2. Завершение поездки
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

      const departureDateTime = new Date(
        `${trip.trip_date}T${String(trip.departure_time).slice(0,5)}:00`
      );

      const endTime = new Date(
        departureDateTime.getTime() + 9 * 60 * 60 * 1000
      );

      if (now >= endTime) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-trip-completed-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              telegramId: booking.telegram_id,
              bookingId: booking.id,
              routeName: `${trip.from_city} → ${trip.to_city}`,
            }),
          });

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRON ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
