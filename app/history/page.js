"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);

      const telegramId =
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;

      if (!telegramId) {
        setHistoryItems([]);
        return;
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("telegram_id", telegramId)
        .order("created_at", { ascending: false });

      if (bookingsError) {
        console.error("Ошибка загрузки истории бронирований:", bookingsError);
        setHistoryItems([]);
        return;
      }

      if (!bookingsData || bookingsData.length === 0) {
        setHistoryItems([]);
        return;
      }

      const tripIds = [...new Set(bookingsData.map((item) => item.trip_id))];

      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .in("id", tripIds);

      if (tripsError) {
        console.error("Ошибка загрузки trips для истории:", tripsError);
        setHistoryItems([]);
        return;
      }

      const tripsMap = {};
      for (const trip of tripsData || []) {
        tripsMap[trip.id] = trip;
      }

      const merged = bookingsData
        .map((booking) => {
          const trip = tripsMap[booking.trip_id];
          if (!trip) return null;

          const start = buildTripDateTime(trip.trip_date, trip.departure_time);
          if (!start) return null;

          const durationMinutes = parseTravelDurationMinutes(
            trip.travel_duration
          );
          const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

          return {
            ...booking,
            trip,
            departureDateTime: start,
            arrivalDateTime: end,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.departureDateTime - a.departureDateTime);

      setHistoryItems(merged);
    } catch (error) {
      console.error("Ошибка загрузки истории:", error);
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  }

  const completedBookings = useMemo(() => {
    const now = new Date();

    return historyItems
      .filter((item) => {
        if (item.status === "cancelled") return false;
        return item.arrivalDateTime <= now;
      })
      .sort((a, b) => b.departureDateTime - a.departureDateTime);
  }, [historyItems]);

  const cancelledBookings = useMemo(() => {
    return historyItems
      .filter((item) => item.status === "cancelled")
      .sort((a, b) => {
        const aDate = new Date(a.created_at || 0);
        const bDate = new Date(b.created_at || 0);
        return bDate - aDate;
      });
  }, [historyItems]);

  const isEmpty =
    !loading &&
    completedBookings.length === 0 &&
    cancelledBookings.length === 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fb",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <Link
            href="/"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#ffffff",
              fontSize: "18px",
              textDecoration: "none",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            }}
          >
            ←
          </Link>

          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            История поездок
          </h1>
        </div>

        {loading ? (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              padding: "20px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              color: "#6b7280",
              textAlign: "center",
              border: "1px solid #eef2f7",
            }}
          >
            Загрузка истории...
          </div>
        ) : isEmpty ? (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              color: "#6b7280",
              textAlign: "center",
              border: "1px solid #eef2f7",
              lineHeight: "1.6",
            }}
          >
            История поездок пока пуста.
            <br />
            Здесь будут отображаться завершённые и отменённые бронирования.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {completedBookings.length > 0 && (
              <section>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "800",
                    color: "#111827",
                    marginBottom: "12px",
                  }}
                >
                  Завершённые
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {completedBookings.map((booking) => (
                    <HistoryCard
                      key={booking.id}
                      booking={booking}
                      statusLabel="Завершена"
                      statusColor="#16a34a"
                      statusBg="#ecfdf3"
                    />
                  ))}
                </div>
              </section>
            )}

            {cancelledBookings.length > 0 && (
              <section>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "800",
                    color: "#111827",
                    marginBottom: "12px",
                  }}
                >
                  Отменённые
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {cancelledBookings.map((booking) => (
                    <HistoryCard
                      key={booking.id}
                      booking={booking}
                      statusLabel="Отменена"
                      statusColor="#b91c1c"
                      statusBg="#fef2f2"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryCard({ booking, statusLabel, statusColor, statusBg }) {
  const trip = booking.trip;
  const departureTime = normalizeTime(trip.departure_time);
  const arrivalTime = getArrivalTime(
    trip.trip_date,
    trip.departure_time,
    trip.travel_duration
  );

  return (
    <Link
      href={`/booking/${booking.id}`}
      style={{
        display: "block",
        backgroundColor: "#ffffff",
        borderRadius: "20px",
        padding: "18px",
        boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
        border: "1px solid #eef2f7",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
              lineHeight: "1.3",
              marginBottom: "6px",
            }}
          >
            {trip.from_city} → {trip.to_city}
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: "1.5",
            }}
          >
            {formatDateRu(trip.trip_date)} • {departureTime} — {arrivalTime}
          </div>
        </div>

        <div
          style={{
            padding: "8px 12px",
            borderRadius: "999px",
            backgroundColor: statusBg,
            color: statusColor,
            fontSize: "12px",
            fontWeight: "800",
            whiteSpace: "nowrap",
          }}
        >
          {statusLabel}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "14px",
            padding: "12px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginBottom: "4px",
            }}
          >
            Пассажиры
          </div>
          <div
            style={{
              fontSize: "15px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            {booking.passengers_count} {getPassengerWord(booking.passengers_count)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "14px",
            padding: "12px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginBottom: "4px",
            }}
          >
            Транспорт
          </div>
          <div
            style={{
              fontSize: "15px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            {trip.vehicle_plate || "Будет позже"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          Нажмите, чтобы открыть детали брони
        </div>

        <div
          style={{
            fontSize: "14px",
            fontWeight: "700",
            color: "#2563eb",
          }}
        >
          Открыть →
        </div>
      </div>
    </Link>
  );
}

function buildTripDateTime(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const normalizedTime = normalizeTime(timeString);
  return new Date(`${dateString}T${normalizedTime}:00`);
}

function normalizeTime(timeString) {
  return String(timeString || "").slice(0, 5);
}

function formatDateRu(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU");
}

function parseTravelDurationMinutes(value) {
  if (!value) return 9 * 60;

  if (typeof value === "number") {
    return value > 0 ? value : 9 * 60;
  }

  const text = String(value).toLowerCase().trim();

  const hourMatch = text.match(/(\d+)\s*ч/);
  const minuteMatch = text.match(/(\d+)\s*м/);

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  const total = hours * 60 + minutes;
  return total > 0 ? total : 9 * 60;
}

function getArrivalTime(dateString, timeString, travelDuration) {
  const start = buildTripDateTime(dateString, timeString);
  if (!start) return "--:--";

  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const hours = String(end.getHours()).padStart(2, "0");
  const minutes = String(end.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getPassengerWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "пассажир";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "пассажира";
  }

  return "пассажиров";
}
