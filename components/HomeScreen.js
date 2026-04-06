"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function HomeScreen({ user, onOpenProfile }) {
  const today = getTodayString();
  const nowTime = getCurrentTimeString();

  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [freeSeatsMap, setFreeSeatsMap] = useState({});
  const [myBookings, setMyBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const [draftRoute, setDraftRoute] = useState("all");
  const [draftDate, setDraftDate] = useState(today);
  const [draftTimeFrom, setDraftTimeFrom] = useState("");
  const [draftTimeTo, setDraftTimeTo] = useState("");
  const [draftMinSeats, setDraftMinSeats] = useState("");

  const [appliedRoute, setAppliedRoute] = useState("all");
  const [appliedDate, setAppliedDate] = useState(today);
  const [appliedTimeFrom, setAppliedTimeFrom] = useState("");
  const [appliedTimeTo, setAppliedTimeTo] = useState("");
  const [appliedMinSeats, setAppliedMinSeats] = useState("");

  useEffect(() => {
    loadTripsAndFreeSeats();
  }, [appliedDate]);

  useEffect(() => {
    loadMyBookings();
  }, [user?.telegram_id, user?.id]);

  async function loadTripsAndFreeSeats() {
    try {
      setLoading(true);

      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "active")
        .eq("trip_date", appliedDate)
        .order("departure_time", { ascending: true });

      if (tripsError) {
        console.error("Ошибка загрузки trips:", tripsError);
        alert("Ошибка загрузки маршрутов: " + tripsError.message);
        setTrips([]);
        setFreeSeatsMap({});
        return;
      }

      const tripsList = tripsData || [];
      setTrips(tripsList);

      if (tripsList.length === 0) {
        setFreeSeatsMap({});
        return;
      }

      const tripIds = tripsList.map((trip) => trip.id);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("trip_id, passengers_count, status")
        .in("trip_id", tripIds)
        .in("status", ["new", "confirmed"]);

      if (bookingsError) {
        console.error("Ошибка загрузки bookings:", bookingsError);
        alert("Ошибка загрузки бронирований: " + bookingsError.message);
        setFreeSeatsMap({});
        return;
      }

      const bookedByTrip = {};

      for (const booking of bookingsData || []) {
        const current = bookedByTrip[booking.trip_id] || 0;
        bookedByTrip[booking.trip_id] =
          current + Number(booking.passengers_count || 0);
      }

      const calculatedFreeSeats = {};

      for (const trip of tripsList) {
        const totalSeats = Number(trip.seats_total || 15);
        const bookedSeats = Number(bookedByTrip[trip.id] || 0);
        calculatedFreeSeats[trip.id] = Math.max(totalSeats - bookedSeats, 0);
      }

      setFreeSeatsMap(calculatedFreeSeats);
    } catch (err) {
      console.error("Ошибка:", err);
      alert("Ошибка загрузки маршрутов");
      setTrips([]);
      setFreeSeatsMap({});
    } finally {
      setLoading(false);
    }
  }

  async function loadMyBookings() {
    try {
      setBookingsLoading(true);

      const telegramId =
        user?.telegram_id ||
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
        null;

      if (!telegramId) {
        setMyBookings([]);
        return;
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("telegram_id", telegramId)
        .in("status", ["new", "confirmed"])
        .order("created_at", { ascending: false });

      if (bookingsError) {
        console.error("Ошибка загрузки моих бронирований:", bookingsError);
        setMyBookings([]);
        return;
      }

      if (!bookingsData || bookingsData.length === 0) {
        setMyBookings([]);
        return;
      }

      const tripIds = [...new Set(bookingsData.map((item) => item.trip_id))];

      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .in("id", tripIds);

      if (tripsError) {
        console.error("Ошибка загрузки trips для бронирований:", tripsError);
        setMyBookings([]);
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

          const departureDateTime = buildTripDateTime(
            trip.trip_date,
            trip.departure_time
          );

          return {
            ...booking,
            trip,
            departureDateTime,
          };
        })
        .filter(Boolean)
        .filter((item) => item.departureDateTime)
        .sort((a, b) => a.departureDateTime - b.departureDateTime);

      setMyBookings(merged);
    } catch (error) {
      console.error("Ошибка загрузки моих бронирований:", error);
      setMyBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const routeName = `${trip.from_city} → ${trip.to_city}`;
      const isToday = appliedDate === today;
      const tripTime = trip.departure_time?.slice(0, 5) || "";
      const freeSeats = Number(freeSeatsMap[trip.id] ?? trip.seats_total ?? 15);

      const matchRoute =
        appliedRoute === "all" || routeName === appliedRoute;

      const matchSeats =
        !appliedMinSeats || freeSeats >= Number(appliedMinSeats);

      const matchTimeFrom =
        !appliedTimeFrom || tripTime >= appliedTimeFrom;

      const matchTimeTo =
        !appliedTimeTo || tripTime <= appliedTimeTo;

      const matchCurrentTime =
        !isToday || tripTime >= nowTime;

      return (
        matchRoute &&
        matchSeats &&
        matchTimeFrom &&
        matchTimeTo &&
        matchCurrentTime &&
        freeSeats > 0
      );
    });
  }, [
    trips,
    freeSeatsMap,
    appliedRoute,
    appliedDate,
    appliedMinSeats,
    appliedTimeFrom,
    appliedTimeTo,
    today,
    nowTime,
  ]);

  const bookingCards = useMemo(() => {
    return myBookings.slice(0, 3);
  }, [myBookings]);

  const handleSaveFilters = () => {
    setAppliedRoute(draftRoute);
    setAppliedDate(draftDate);
    setAppliedTimeFrom(draftTimeFrom);
    setAppliedTimeTo(draftTimeTo);
    setAppliedMinSeats(draftMinSeats);
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    const currentToday = getTodayString();

    setDraftRoute("all");
    setDraftDate(currentToday);
    setDraftTimeFrom("");
    setDraftTimeTo("");
    setDraftMinSeats("");

    setAppliedRoute("all");
    setAppliedDate(currentToday);
    setAppliedTimeFrom("");
    setAppliedTimeTo("");
    setAppliedMinSeats("");

    setShowFilters(false);
  };

  const titleDateText = appliedDate
    ? formatDateRu(appliedDate)
    : formatDateRu(today);

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
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "14px",
                color: "#6b7280",
                marginBottom: "4px",
              }}
            >
              Добро пожаловать
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              {user?.name || "Пользователь"}
            </h1>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "#ffffff",
              fontSize: "20px",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            }}
          >
            👤
          </button>
        </div>

        {/* МОИ БРОНИРОВАНИЯ */}
        {!bookingsLoading && bookingCards.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "800",
                  color: "#111827",
                }}
              >
                Мои бронирования
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: "600",
                }}
              >
                {myBookings.length} активных
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "6px",
                scrollSnapType: "x mandatory",
              }}
            >
              {bookingCards.map((booking, index) => {
                const trip = booking.trip;
                const departureText = getDepartureBadgeText(
                  trip.trip_date,
                  trip.departure_time
                );

                return (
                  <Link
                    key={booking.id}
                    href={`/trip/${trip.id}`}
                    style={{
                      minWidth: "290px",
                      maxWidth: "290px",
                      flex: "0 0 auto",
                      backgroundColor: "#111827",
                      color: "#ffffff",
                      borderRadius: "24px",
                      padding: "18px",
                      textDecoration: "none",
                      boxShadow: "0 14px 30px rgba(17,24,39,0.18)",
                      scrollSnapAlign: "start",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "-30px",
                        right: "-30px",
                        width: "110px",
                        height: "110px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.06)",
                      }}
                    />

                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#93c5fd",
                            backgroundColor: "rgba(37,99,235,0.18)",
                            padding: "6px 10px",
                            borderRadius: "999px",
                          }}
                        >
                          {index === 0 ? "Ближайшая поездка" : "Следующая поездка"}
                        </div>

                        <div
                          style={{
                            fontSize: "12px",
                            color: "#d1d5db",
                            fontWeight: "600",
                          }}
                        >
                          {booking.status === "confirmed" ? "Подтверждено" : "Бронь создана"}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "21px",
                          fontWeight: "800",
                          lineHeight: "1.3",
                          marginBottom: "10px",
                        }}
                      >
                        {trip.from_city} → {trip.to_city}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          marginBottom: "18px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#d1d5db",
                          }}
                        >
                          {formatDateRu(trip.trip_date)} • {trip.departure_time?.slice(0, 5) || ""}
                        </div>

                        <div
                          style={{
                            fontSize: "14px",
                            color: "#d1d5db",
                          }}
                        >
                          {booking.passengers_count} {getPassengerWord(booking.passengers_count)}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "auto",
                          paddingTop: "14px",
                          borderTop: "1px solid rgba(255,255,255,0.10)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: "700",
                            color: "#ffffff",
                          }}
                        >
                          {departureText}
                        </div>

                        <div
                          style={{
                            fontSize: "18px",
                            color: "#ffffff",
                          }}
                        >
                          →
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              <Link
                href="/bookings"
                style={{
                  minWidth: "240px",
                  maxWidth: "240px",
                  flex: "0 0 auto",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  borderRadius: "24px",
                  padding: "18px",
                  textDecoration: "none",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
                  border: "1px solid #eef2f7",
                  scrollSnapAlign: "start",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "16px",
                      backgroundColor: "#eff6ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "22px",
                      marginBottom: "18px",
                    }}
                  >
                    📋
                  </div>

                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "800",
                      lineHeight: "1.3",
                      marginBottom: "10px",
                    }}
                  >
                    Посмотреть все брони
                  </div>

                  <div
                    style={{
                      fontSize: "14px",
                      color: "#6b7280",
                      lineHeight: "1.5",
                    }}
                  >
                    Откройте полный список ваших поездок и будущих бронирований
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#2563eb",
                  }}
                >
                  Открыть →
                </div>
              </Link>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <select
            value={draftRoute}
            onChange={(e) => setDraftRoute(e.target.value)}
            style={{
              flex: 1,
              height: "48px",
              borderRadius: "14px",
              border: "1px solid #d1d5db",
              padding: "0 14px",
              fontSize: "15px",
              backgroundColor: "#ffffff",
              boxSizing: "border-box",
              outline: "none",
            }}
          >
            <option value="all">Все маршруты</option>
            <option value="Москва → Санкт-Петербург">
              Москва → Санкт-Петербург
            </option>
            <option value="Санкт-Петербург → Москва">
              Санкт-Петербург → Москва
            </option>
          </select>

          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            style={{
              minWidth: "48px",
              height: "48px",
              borderRadius: "14px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ☰
          </button>
        </div>

        {showFilters && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              padding: "16px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              marginBottom: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              border: "1px solid #eef2f7",
            }}
          >
            <div>
              <label style={labelStyle}>Дата</label>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>С</label>
                <input
                  type="time"
                  value={draftTimeFrom}
                  onChange={(e) => setDraftTimeFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>До</label>
                <input
                  type="time"
                  value={draftTimeTo}
                  onChange={(e) => setDraftTimeTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Свободных мест от</label>
              <input
                type="number"
                min="1"
                placeholder="Например: 2"
                value={draftMinSeats}
                onChange={(e) => setDraftMinSeats(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="button"
              onClick={handleSaveFilters}
              style={{
                marginTop: "6px",
                height: "44px",
                border: "none",
                borderRadius: "14px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(37,99,235,0.22)",
              }}
            >
              Сохранить фильтры
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                height: "44px",
                border: "none",
                borderRadius: "14px",
                backgroundColor: "#111827",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: "800",
              color: "#111827",
              lineHeight: "1.2",
            }}
          >
            Доступные поездки на {titleDateText}
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            paddingBottom: "30px",
          }}
        >
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
              Загрузка поездок...
            </div>
          ) : filteredTrips.length === 0 ? (
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
              Нет поездок по выбранным параметрам
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const departureTime = trip.departure_time?.slice(0, 5) || "";
              const duration = trip.travel_duration || "~9 ч";
              const freeSeats = Number(
                freeSeatsMap[trip.id] ?? trip.seats_total ?? 15
              );

              return (
                <div
                  key={trip.id}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "22px",
                    padding: "18px",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
                    border: "1px solid #eef2f7",
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
                          fontSize: "19px",
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
                          lineHeight: "1.4",
                        }}
                      >
                        Отправление: {formatDateRu(trip.trip_date)} в{" "}
                        {departureTime}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: "68px",
                        textAlign: "right",
                        fontSize: "20px",
                        fontWeight: "800",
                        color: "#2563eb",
                        lineHeight: "1.2",
                      }}
                    >
                      {departureTime}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "16px",
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
                        Время в дороге
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        {duration}
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
                        Свободных мест
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        {freeSeats}
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
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          marginBottom: "4px",
                        }}
                      >
                        Стоимость
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: "800",
                          color: "#111827",
                          lineHeight: "1",
                        }}
                      >
                        {trip.price} ₽
                      </div>
                    </div>

                    <Link
                      href={`/trip/${trip.id}`}
                      style={{
                        minWidth: "150px",
                        height: "46px",
                        padding: "0 18px",
                        borderRadius: "14px",
                        backgroundColor: "#111827",
                        color: "#ffffff",
                        fontSize: "15px",
                        fontWeight: "700",
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(17,24,39,0.18)",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      Забронировать
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function buildTripDateTime(dateString, timeString) {
  if (!dateString || !timeString) return null;

  const normalizedTime = String(timeString).slice(0, 5);
  return new Date(`${dateString}T${normalizedTime}:00`);
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeString() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateRu(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU");
}

function getDepartureBadgeText(dateString, timeString) {
  const tripDate = buildTripDateTime(dateString, timeString);
  if (!tripDate) return "Поездка";

  const now = new Date();
  const diffMs = tripDate - now;

  if (diffMs <= 0) {
    return "Сегодня";
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Сегодня в ${String(timeString).slice(0, 5)}`;
  }

  if (diffDays === 1) {
    return "Отправление через 1 день";
  }

  if (diffDays >= 2 && diffDays <= 4) {
    return `Отправление через ${diffDays} ${getDayWord(diffDays)}`;
  }

  if (diffHours < 48) {
    return `Через ${diffHours} ${getHourWord(diffHours)}`;
  }

  return `Через ${diffDays} ${getDayWord(diffDays)}`;
}

function getPassengerWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "пассажир";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "пассажира";
  }

  return "пассажиров";
}

function getDayWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "дня";
  }

  return "дней";
}

function getHourWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "час";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "часа";
  }

  return "часов";
}

const labelStyle = {
  fontSize: "14px",
  color: "#374151",
};

const inputStyle = {
  width: "100%",
  height: "44px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
  marginTop: "6px",
};
