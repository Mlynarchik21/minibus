"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_BOOKING_STATUSES = ["new", "confirmed"];
const COMPLETED_CARD_VISIBLE_HOURS = 2;

const COLORS = {
  bg: "#172F47",
  card: "#274569",
  cardAlt: "#585858",
  border: "rgba(212, 212, 212, 0.14)",
  title: "#D4D4D4",
  text: "#D4D4D4",
  textSecondary: "rgba(212, 212, 212, 0.72)",
  primary: "#D4B785",
  primaryHover: "#C7A770",
  success: "#D4B785",
  warning: "#D4B785",
  danger: "#B86A6A",
};

export default function HomeScreen({ user, onOpenProfile }) {
  const router = useRouter();
  const today = getTodayString();
  const tomorrow = getNextDayString(today);
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

      const datesToLoad =
        appliedDate === today ? [appliedDate, tomorrow] : [appliedDate];

      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "active")
        .in("trip_date", datesToLoad)
        .order("trip_date", { ascending: true })
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
        .in("status", ACTIVE_BOOKING_STATUSES);

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
        .in("status", ACTIVE_BOOKING_STATUSES)
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

      const now = new Date();

      const merged = bookingsData
        .map((booking) => {
          const trip = tripsMap[booking.trip_id];
          if (!trip) return null;

          const departureDateTime = buildTripDateTime(
            trip.trip_date,
            trip.departure_time
          );

          if (!departureDateTime) return null;

          const durationMinutes = parseTravelDurationMinutes(
            trip.travel_duration
          );
          const arrivalDateTime = new Date(
            departureDateTime.getTime() + durationMinutes * 60 * 1000
          );
          const visibleUntil = new Date(
            arrivalDateTime.getTime() +
              COMPLETED_CARD_VISIBLE_HOURS * 60 * 60 * 1000
          );

          const isCompleted = now >= arrivalDateTime;
          const shouldShowOnHome = now < visibleUntil;

          if (!shouldShowOnHome) return null;

          return {
            ...booking,
            trip,
            departureDateTime,
            arrivalDateTime,
            visibleUntil,
            isCompleted,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aPriority = getHomeBookingPriority(a);
          const bPriority = getHomeBookingPriority(b);

          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }

          if (a.isCompleted && b.isCompleted) {
            return b.arrivalDateTime - a.arrivalDateTime;
          }

          return a.departureDateTime - b.departureDateTime;
        });

      setMyBookings(merged);
    } catch (error) {
      console.error("Ошибка загрузки моих бронирований:", error);
      setMyBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }

  function handleRouteChange(value) {
    setDraftRoute(value);
    setAppliedRoute(value);
  }

  function handleOpenBooking(bookingId) {
    router.push(`/booking/${bookingId}`);
  }

  function handleCallDriver(event, booking) {
    event.stopPropagation();

    const rawPhone = booking?.trip?.driver_phone || "";
    const phone = String(rawPhone).trim();

    if (!phone) {
      alert("Номер водителя пока не добавлен.");
      return;
    }

    const confirmed = window.confirm(
      `Номер водителя:\n${phone}\n\nНажмите OK, чтобы сразу позвонить.`
    );

    if (!confirmed) return;

    const telPhone = formatPhoneForTel(phone);
    window.location.href = `tel:${telPhone}`;
  }

  const todayTripsFiltered = useMemo(() => {
    return trips.filter((trip) => {
      if (trip.trip_date !== appliedDate) return false;

      const routeName = `${trip.from_city} → ${trip.to_city}`;
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
        appliedDate !== today || tripTime >= nowTime;

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

  const tomorrowTripsFiltered = useMemo(() => {
    if (appliedDate !== today) return [];

    return trips.filter((trip) => {
      if (trip.trip_date !== tomorrow) return false;

      const routeName = `${trip.from_city} → ${trip.to_city}`;
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

      return (
        matchRoute &&
        matchSeats &&
        matchTimeFrom &&
        matchTimeTo &&
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
    tomorrow,
  ]);

  const shouldAutoShowTomorrow =
    appliedDate === today &&
    todayTripsFiltered.length === 0 &&
    tomorrowTripsFiltered.length > 0;

  const filteredTrips = shouldAutoShowTomorrow
    ? tomorrowTripsFiltered
    : todayTripsFiltered;

  const displayedTripsDate = shouldAutoShowTomorrow ? tomorrow : appliedDate;

  const bookingCards = useMemo(() => {
    return myBookings.slice(0, 3);
  }, [myBookings]);

  const shouldShowAllBookingsCard = myBookings.length >= 4;

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

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        padding: "16px",
        boxSizing: "border-box",
        color: COLORS.text,
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
                color: COLORS.textSecondary,
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
                color: COLORS.title,
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
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.cardAlt,
              color: COLORS.title,
              fontSize: "20px",
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
            }}
          >
            👤
          </button>
        </div>

        {!bookingsLoading && bookingCards.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "6px",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {bookingCards.map((booking) => {
                const trip = booking.trip;
                const statusMeta = getBookingStatusMeta(booking, trip);
                const progress = getTripProgressPercent(
                  trip.trip_date,
                  trip.departure_time,
                  trip.travel_duration
                );
                const departureTime = normalizeTime(trip.departure_time);
                const arrivalTime = getArrivalTime(
                  trip.trip_date,
                  trip.departure_time,
                  trip.travel_duration
                );
                const isCompletedCard = statusMeta.kind === "completed";

                return (
                  <div
                    key={booking.id}
                    onClick={() => handleOpenBooking(booking.id)}
                    style={{
                      minWidth: "320px",
                      maxWidth: "320px",
                      flex: "0 0 auto",
                      background:
                        "linear-gradient(145deg, #274569 0%, #1F3A59 58%, #172F47 100%)",
                      color: COLORS.title,
                      borderRadius: "28px",
                      padding: "18px",
                      textDecoration: "none",
                      boxShadow: "0 16px 36px rgba(0,0,0,0.28)",
                      scrollSnapAlign: "start",
                      position: "relative",
                      overflow: "hidden",
                      border: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(circle at top right, rgba(212,183,133,0.22), transparent 34%)",
                        pointerEvents: "none",
                      }}
                    />

                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "18px",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 12px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "800",
                            color: COLORS.bg,
                            background: COLORS.primary,
                            boxShadow: "0 8px 24px rgba(212,183,133,0.20)",
                          }}
                        >
                          Моя бронь
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: statusMeta.dotColor,
                              flexShrink: 0,
                              boxShadow: `0 0 0 4px ${statusMeta.dotGlow}`,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "700",
                              color: COLORS.text,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "12px",
                          alignItems: "start",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: "800",
                            lineHeight: "1.3",
                            color: COLORS.title,
                          }}
                        >
                          {trip.from_city} → {trip.to_city}
                        </div>

                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: "800",
                            color: COLORS.title,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDateShort(trip.trip_date)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          marginBottom: "22px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: "800",
                            color: COLORS.title,
                          }}
                        >
                          {booking.passengers_count}{" "}
                          {getPassengerWord(booking.passengers_count)}
                        </div>

                        <div
                          style={{
                            fontSize: "14px",
                            color: COLORS.textSecondary,
                            lineHeight: "1.4",
                          }}
                        >
                          {trip.vehicle_plate
                            ? trip.vehicle_plate
                            : "Данные по транспорту появятся позже"}
                        </div>
                      </div>

                      <div style={{ marginTop: "8px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            marginBottom: "10px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                color: COLORS.textSecondary,
                                marginBottom: "4px",
                              }}
                            >
                              Отправка
                            </div>
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: "900",
                                color: COLORS.title,
                                lineHeight: "1",
                              }}
                            >
                              {departureTime}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                color: COLORS.textSecondary,
                                marginBottom: "4px",
                              }}
                            >
                              Прибытие
                            </div>
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: "900",
                                color: COLORS.title,
                                lineHeight: "1",
                              }}
                            >
                              {arrivalTime}
                            </div>
                          </div>
                        </div>

                        {isCompletedCard ? (
                          <button
                            type="button"
                            onClick={(event) => handleCallDriver(event, booking)}
                            style={{
                              width: "100%",
                              height: "46px",
                              border: "none",
                              borderRadius: "14px",
                              backgroundColor: COLORS.primary,
                              color: COLORS.bg,
                              fontSize: "15px",
                              fontWeight: "700",
                              cursor: "pointer",
                              boxShadow: "0 10px 22px rgba(212,183,133,0.20)",
                            }}
                          >
                            Связаться с водителем
                          </button>
                        ) : (
                          <div
                            style={{
                              position: "relative",
                              height: "6px",
                              borderRadius: "999px",
                              backgroundColor: "rgba(212,212,212,0.14)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${progress}%`,
                                height: "100%",
                                borderRadius: "999px",
                                background: `linear-gradient(90deg, ${COLORS.primary} 0%, ${COLORS.primaryHover} 100%)`,
                                transition: "width 0.8s ease",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: `calc(${progress}% - 9px)`,
                                transform: "translateY(-50%)",
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                backgroundColor: COLORS.primary,
                                border: `3px solid ${COLORS.title}`,
                                boxShadow: "0 6px 18px rgba(212,183,133,0.30)",
                                transition: "left 0.8s ease",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {shouldShowAllBookingsCard && (
                <Link
                  href="/bookings"
                  style={{
                    minWidth: "240px",
                    maxWidth: "240px",
                    flex: "0 0 auto",
                    backgroundColor: COLORS.card,
                    color: COLORS.title,
                    borderRadius: "28px",
                    padding: "18px",
                    textDecoration: "none",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.20)",
                    border: `1px solid ${COLORS.border}`,
                    scrollSnapAlign: "start",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "18px",
                        backgroundColor: COLORS.cardAlt,
                        border: `1px solid ${COLORS.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
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
                        color: COLORS.title,
                      }}
                    >
                      Посмотреть все бронирования
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: COLORS.textSecondary,
                        lineHeight: "1.5",
                      }}
                    >
                      Откройте полный список поездок и деталей по каждой броне
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "18px",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: COLORS.primary,
                    }}
                  >
                    Открыть →
                  </div>
                </Link>
              )}
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
            value={appliedRoute}
            onChange={(e) => handleRouteChange(e.target.value)}
            style={selectStyle}
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
              backgroundColor: COLORS.primary,
              color: COLORS.bg,
              fontSize: "18px",
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(212,183,133,0.22)",
            }}
          >
            ☰
          </button>
        </div>

        {showFilters && (
          <div
            style={{
              backgroundColor: COLORS.card,
              borderRadius: "20px",
              padding: "16px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.20)",
              marginBottom: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              border: `1px solid ${COLORS.border}`,
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
                backgroundColor: COLORS.primary,
                color: COLORS.bg,
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(212,183,133,0.20)",
              }}
            >
              Сохранить фильтры
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                height: "44px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "14px",
                backgroundColor: COLORS.cardAlt,
                color: COLORS.text,
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {shouldAutoShowTomorrow && (
          <div
            style={{
              backgroundColor: "rgba(212,183,133,0.14)",
              border: `1px solid rgba(212,183,133,0.30)`,
              color: COLORS.primary,
              borderRadius: "16px",
              padding: "12px 14px",
              marginBottom: "16px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            На сегодня доступных поездок больше нет. Показаны рейсы на завтра —{" "}
            {formatDateRu(displayedTripsDate)}.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            paddingBottom: "30px",
          }}
        >
          {loading ? (
            <div style={emptyCardStyle}>Загрузка поездок...</div>
          ) : filteredTrips.length === 0 ? (
            <div style={emptyCardStyle}>Нет поездок по выбранным параметрам</div>
          ) : (
            filteredTrips.map((trip) => {
              const departureTime = normalizeTime(trip.departure_time);
              const duration = trip.travel_duration || "~9 ч";
              const freeSeats = Number(
                freeSeatsMap[trip.id] ?? trip.seats_total ?? 15
              );

              return (
                <div
                  key={trip.id}
                  style={{
                    backgroundColor: COLORS.card,
                    borderRadius: "22px",
                    padding: "18px",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
                    border: `1px solid ${COLORS.border}`,
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
                          color: COLORS.title,
                          lineHeight: "1.3",
                          marginBottom: "6px",
                        }}
                      >
                        {trip.from_city} → {trip.to_city}
                      </div>

                      <div
                        style={{
                          fontSize: "14px",
                          color: COLORS.textSecondary,
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
                        color: COLORS.primary,
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
                        backgroundColor: COLORS.cardAlt,
                        borderRadius: "14px",
                        padding: "12px",
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: COLORS.textSecondary,
                          marginBottom: "4px",
                        }}
                      >
                        Время в дороге
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color: COLORS.title,
                        }}
                      >
                        {duration}
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: COLORS.cardAlt,
                        borderRadius: "14px",
                        padding: "12px",
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: COLORS.textSecondary,
                          marginBottom: "4px",
                        }}
                      >
                        Свободных мест
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color:
                            freeSeats <= 2 ? COLORS.primary : COLORS.title,
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
                          color: COLORS.textSecondary,
                          marginBottom: "4px",
                        }}
                      >
                        Стоимость
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: "800",
                          color: COLORS.title,
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
                        backgroundColor: COLORS.primary,
                        color: COLORS.bg,
                        fontSize: "15px",
                        fontWeight: "700",
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(212,183,133,0.20)",
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

function getHomeBookingPriority(booking) {
  const start = booking.departureDateTime;
  const end = booking.arrivalDateTime;
  const now = new Date();

  if (start && now < start) return 1;
  if (start && end && now >= start && now < end) return 0;
  if (end && now >= end) return 2;

  return 3;
}

function buildTripDateTime(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const normalizedTime = normalizeTime(timeString);
  return new Date(`${dateString}T${normalizedTime}:00`);
}

function normalizeTime(timeString) {
  return String(timeString || "").slice(0, 5);
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDayString(dateString) {
  const baseDate = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  baseDate.setDate(baseDate.getDate() + 1);

  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  const day = String(baseDate.getDate()).padStart(2, "0");

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

function formatDateShort(dateString) {
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

function getTripProgressPercent(dateString, timeString, travelDuration) {
  const start = buildTripDateTime(dateString, timeString);
  if (!start) return 0;

  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  if (now <= start) return 0;
  if (now >= end) return 100;

  const totalMs = end.getTime() - start.getTime();
  const passedMs = now.getTime() - start.getTime();

  const percent = (passedMs / totalMs) * 100;
  return Math.max(0, Math.min(100, percent));
}

function getBookingStatusMeta(booking, trip) {
  const start =
    booking?.departureDateTime ||
    buildTripDateTime(trip.trip_date, trip.departure_time);

  const durationMinutes = parseTravelDurationMinutes(trip.travel_duration);
  const end =
    booking?.arrivalDateTime ||
    (start
      ? new Date(start.getTime() + durationMinutes * 60 * 1000)
      : null);

  const now = new Date();

  if (start && end && now >= end) {
    return {
      kind: "completed",
      label: "Завершено",
      dotColor: COLORS.textSecondary,
      dotGlow: "rgba(212,212,212,0.18)",
    };
  }

  if (booking.status === "confirmed" && start && now < start) {
    return {
      kind: "upcoming",
      label: "Ожидает отправления",
      dotColor: COLORS.primary,
      dotGlow: "rgba(212,183,133,0.24)",
    };
  }

  if (start && end && now >= start && now < end) {
    return {
      kind: "in_progress",
      label: "В пути",
      dotColor: COLORS.primary,
      dotGlow: "rgba(212,183,133,0.24)",
    };
  }

  return {
    kind: "created",
    label:
      booking.status === "confirmed" ? "Ожидает отправления" : "Бронь создана",
    dotColor: COLORS.primary,
    dotGlow: "rgba(212,183,133,0.20)",
  };
}

function getPassengerWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "пассажир";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "пассажира";
  }

  return "пассажиров";
}

function formatPhoneForTel(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

const labelStyle = {
  fontSize: "14px",
  color: COLORS.textSecondary,
};

const inputStyle = {
  width: "100%",
  height: "44px",
  borderRadius: "12px",
  border: `1px solid ${COLORS.border}`,
  padding: "0 12px",
  fontSize: "14px",
  color: COLORS.text,
  backgroundColor: COLORS.cardAlt,
  boxSizing: "border-box",
  outline: "none",
  marginTop: "6px",
};

const selectStyle = {
  flex: 1,
  height: "48px",
  borderRadius: "14px",
  border: `1px solid ${COLORS.border}`,
  padding: "0 14px",
  fontSize: "15px",
  color: COLORS.text,
  backgroundColor: COLORS.card,
  boxSizing: "border-box",
  outline: "none",
};

const emptyCardStyle = {
  backgroundColor: COLORS.card,
  borderRadius: "20px",
  padding: "20px",
  boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
  color: COLORS.textSecondary,
  textAlign: "center",
  border: `1px solid ${COLORS.border}`,
};
