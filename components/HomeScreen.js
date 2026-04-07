"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_BOOKING_STATUSES = ["new", "confirmed"];
const COMPLETED_CARD_VISIBLE_HOURS = 2;

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
              transition: "transform 0.16s ease, box-shadow 0.22s ease",
            }}
            className="pressableButton"
          >
            👤
          </button>
        </div>

        {!bookingsLoading && bookingCards.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div
              className="bookingsCarousel"
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: "2px",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                backgroundColor: "#f5f7fb",
              }}
            >
              {bookingCards.map((booking, index) => {
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
                const timeLeft = getTimeLeftLabel(
                  trip.trip_date,
                  trip.departure_time,
                  trip.travel_duration
                );
                const durationLabel = formatDurationLabel(trip.travel_duration);
                const isCompletedCard = statusMeta.kind === "completed";
                const passengerCount = Number(booking.passengers_count || 1);
                const vehicleLine = getVehicleLine(trip);
                const driverLine = getDriverLine(trip);
                const centerLabel =
                  statusMeta.kind === "in_progress" ? timeLeft : durationLabel;

                return (
                  <div
                    key={booking.id}
                    onClick={() => handleOpenBooking(booking.id)}
                    className="bookingStatusCard"
                    style={{
                      width: "100%",
                      minWidth: "100%",
                      maxWidth: "100%",
                      flex: "0 0 100%",
                      background: "#08246F",
                      color: "#F9FCFF",
                      borderRadius: "28px",
                      padding: "18px 18px 16px",
                      textDecoration: "none",
                      boxShadow: "0 14px 34px rgba(8,31,92,0.18)",
                      scrollSnapAlign: "start",
                      position: "relative",
                      overflow: "hidden",
                      cursor: "pointer",
                      boxSizing: "border-box",
                      animationDelay: `${index * 90}ms`,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(circle at top right, rgba(255,255,255,0.08), transparent 34%)",
                        pointerEvents: "none",
                      }}
                    />

                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                          marginBottom: "4px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "19px",
                              fontWeight: "900",
                              lineHeight: "1.18",
                              color: "#F9FCFF",
                              letterSpacing: "-0.02em",
                              marginBottom: "4px",
                            }}
                          >
                            {trip.from_city} → {trip.to_city}
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(249,252,255,0.92)",
                              lineHeight: "1.2",
                            }}
                          >
                            {formatDateShort(trip.trip_date)} · {passengerCount}{" "}
                            {getPassengerWord(passengerCount)}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: 0,
                            flexShrink: 0,
                            paddingTop: "2px",
                          }}
                        >
                          <span
                            style={{
                              width:
                                statusMeta.kind === "in_progress" ? "11px" : "10px",
                              height:
                                statusMeta.kind === "in_progress" ? "11px" : "10px",
                              borderRadius: "50%",
                              backgroundColor: statusMeta.dotColor,
                              flexShrink: 0,
                              boxShadow: `0 0 0 5px ${statusMeta.dotGlow}`,
                              animation: statusMeta.animation,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: "800",
                              color: statusMeta.textColor,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "18px",
                          marginBottom: isCompletedCard ? "16px" : "18px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#D5E2FF",
                            lineHeight: "1.15",
                            marginBottom: "4px",
                            minHeight: "16px",
                          }}
                        >
                          {vehicleLine}
                        </div>

                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: "500",
                            color: "#F9FCFF",
                            lineHeight: "1.2",
                            letterSpacing: "-0.01em",
                            minHeight: "22px",
                          }}
                        >
                          {driverLine}
                        </div>
                      </div>

                      {isCompletedCard ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              className="completedAlertIcon"
                              style={{
                                width: "42px",
                                height: "42px",
                                minWidth: "42px",
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(180deg, #F6C96B 0%, #E9AF42 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#593C07",
                                fontSize: "26px",
                                fontWeight: "900",
                                boxShadow: "0 8px 18px rgba(233,175,66,0.24)",
                              }}
                            >
                              !
                            </div>

                            <div
                              style={{
                                fontSize: "13px",
                                lineHeight: "1.2",
                                color: "#F9FCFF",
                                opacity: 0.96,
                              }}
                            >
                              Забыли личные вещи в автобусе? <br />
                              свяжитесь с водителем
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => handleCallDriver(event, booking)}
                            className="driverContactButton"
                            style={{
                              minWidth: "190px",
                              height: "54px",
                              border: "none",
                              borderRadius: "19px",
                              background:
                                "linear-gradient(180deg, #4864DC 0%, #3753CA 100%)",
                              color: "#F4F8FF",
                              fontSize: "15px",
                              fontWeight: "900",
                              cursor: "pointer",
                              padding: "0 18px",
                              boxShadow: "0 12px 24px rgba(55,83,202,0.26)",
                              transition:
                                "transform 0.16s ease, box-shadow 0.22s ease, filter 0.22s ease",
                            }}
                          >
                            Связаться с водителем
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto 1fr",
                              gap: "10px",
                              alignItems: "end",
                              marginBottom: "10px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  color: "#D0E3FF",
                                  marginBottom: "4px",
                                }}
                              >
                                Отправка
                              </div>
                              <div
                                style={{
                                  fontSize: "17px",
                                  fontWeight: "900",
                                  color: "#F9FCFF",
                                  lineHeight: "1",
                                }}
                              >
                                {departureTime}
                              </div>
                            </div>

                            <div
                              style={{
                                textAlign: "center",
                                alignSelf: "end",
                                minWidth: "88px",
                                paddingBottom: "10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "15px",
                                  fontWeight: "900",
                                  color: "#F9FCFF",
                                  lineHeight: "1",
                                  fontVariantNumeric: "tabular-nums",
                                  letterSpacing: "0.01em",
                                }}
                              >
                                {centerLabel}
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  color: "#D0E3FF",
                                  marginBottom: "4px",
                                }}
                              >
                                Прибытие
                              </div>
                              <div
                                style={{
                                  fontSize: "17px",
                                  fontWeight: "900",
                                  color: "#F9FCFF",
                                  lineHeight: "1",
                                }}
                              >
                                {arrivalTime}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              position: "relative",
                              height: "4px",
                              borderRadius: "999px",
                              backgroundColor: "rgba(255,255,255,0.82)",
                              overflow: "visible",
                            }}
                          >
                            <div
                              style={{
                                width: `${progress}%`,
                                height: "100%",
                                borderRadius: "999px",
                                background:
                                  statusMeta.kind === "in_progress"
                                    ? "linear-gradient(90deg, #4A66E8 0%, #6B8CFF 100%)"
                                    : "rgba(255,255,255,0.28)",
                                transition:
                                  "width 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
                              }}
                            />
                            <div
                              className={
                                statusMeta.kind === "in_progress"
                                  ? "bookingProgressDot inProgress"
                                  : "bookingProgressDot static"
                              }
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: `calc(${progress}% - 8px)`,
                                transform: "translateY(-50%)",
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                backgroundColor: "#DCEAFF",
                                border: "2px solid #F9FCFF",
                                boxShadow: "0 0 0 0 rgba(220,234,255,0.42)",
                                transition:
                                  "left 0.85s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s ease",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {shouldShowAllBookingsCard && (
                <Link
                  href="/bookings"
                  className="pressableCard"
                  style={{
                    minWidth: "240px",
                    maxWidth: "240px",
                    flex: "0 0 auto",
                    backgroundColor: "#ffffff",
                    color: "#111827",
                    borderRadius: "28px",
                    padding: "18px",
                    textDecoration: "none",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
                    border: "1px solid #eef2f7",
                    scrollSnapAlign: "start",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition:
                      "transform 0.18s ease, box-shadow 0.25s ease, border-color 0.25s ease",
                  }}
                >
                  <div>
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "18px",
                        backgroundColor: "#eff6ff",
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
                      }}
                    >
                      Посмотреть все бронирования
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
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
                      color: "#2563eb",
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
              transition: "transform 0.16s ease, box-shadow 0.22s ease",
            }}
            className="pressableButton"
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
                transition: "transform 0.16s ease, box-shadow 0.22s ease",
              }}
              className="pressableButton"
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
                transition: "transform 0.16s ease, box-shadow 0.22s ease",
              }}
              className="pressableButton"
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {shouldAutoShowTomorrow && (
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
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
              const departureTime = normalizeTime(trip.departure_time);
              const freeSeats = Number(
                freeSeatsMap[trip.id] ?? trip.seats_total ?? 15
              );

              const boardingPoint =
                trip.boarding_point ||
                trip.pickup_point ||
                trip.pickup_address ||
                trip.from_address ||
                trip.from_stop ||
                "Уточняется";

              const arrivalPoint =
                trip.arrival_point ||
                trip.dropoff_point ||
                trip.to_address ||
                trip.to_stop ||
                trip.destination_point ||
                "Уточняется";

              const vehicleLabel =
                trip.vehicle_name ||
                trip.vehicle_model ||
                trip.vehicle_title ||
                trip.vehicle ||
                trip.car_model ||
                trip.car_name ||
                "Транспорт уточняется";

              const plate =
                trip.vehicle_plate || trip.plate_number || trip.car_plate || "";

              const driver =
                trip.driver_name || trip.driver || trip.driver_full_name || "";

              const priceValue = formatPrice(trip.price);

              return (
                <div
                  key={trip.id}
                  className="availableTripCard"
                  style={{
                    backgroundColor: "#F2F4F7",
                    borderRadius: "24px",
                    padding: "16px 16px 14px",
                    border: "1px solid rgba(15,23,42,0.06)",
                    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
                    transition:
                      "transform 0.18s ease, box-shadow 0.22s ease, border-color 0.22s ease",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "12px",
                      alignItems: "start",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "900",
                          color: "#111827",
                          lineHeight: "1.15",
                          letterSpacing: "-0.02em",
                          marginBottom: "4px",
                        }}
                      >
                        {trip.from_city} → {trip.to_city}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#31437D",
                          lineHeight: "1.3",
                          fontWeight: "700",
                        }}
                      >
                        Дата отправления · {formatDateRu(trip.trip_date)} в{" "}
                        {departureTime}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "900",
                        color: "#3952B3",
                        lineHeight: "1",
                        whiteSpace: "nowrap",
                        paddingTop: "2px",
                      }}
                    >
                      {departureTime}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#223B7A",
                        lineHeight: "1.2",
                        fontWeight: "700",
                      }}
                    >
                      Место посадки · {boardingPoint}
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        color: "#223B7A",
                        lineHeight: "1.2",
                        fontWeight: "700",
                      }}
                    >
                      Конечная · {arrivalPoint}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#3F3F46",
                        lineHeight: "1.2",
                      }}
                    >
                      {vehicleLabel}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "17px",
                          fontWeight: "900",
                          color: "#111827",
                          lineHeight: "1.15",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {plate && driver
                          ? `${plate} · ${driver}`
                          : plate || driver || "Данные водителя уточняются"}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#223B7A",
                          lineHeight: "1.2",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontWeight: "700" }}>
                          Свободных мест
                        </span>{" "}
                        <span style={{ color: "#3952B3", fontWeight: "900" }}>
                          · {freeSeats} {getSeatWord(freeSeats)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "end",
                      justifyContent: "space-between",
                      gap: "14px",
                      marginTop: "8px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#223B7A",
                          lineHeight: "1.2",
                          fontWeight: "700",
                          marginBottom: "2px",
                        }}
                      >
                        Стоимость · {priceValue} ₽
                      </div>
                    </div>

                    <Link
                      href={`/trip/${trip.id}`}
                      className="availableTripButton"
                      style={{
                        minWidth: "178px",
                        height: "42px",
                        padding: "0 20px",
                        borderRadius: "999px",
                        backgroundColor: "#000000",
                        color: "#ffffff",
                        fontSize: "14px",
                        fontWeight: "900",
                        cursor: "pointer",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 18px rgba(0,0,0,0.16)",
                        transition:
                          "transform 0.16s ease, box-shadow 0.22s ease, filter 0.22s ease",
                        flexShrink: 0,
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

      <style jsx>{`
        @keyframes bookingCardEnter {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes tripCardEnter {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.992);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bookingPulse {
          0% {
            transform: translateY(-50%) scale(1);
            box-shadow: 0 0 0 0 rgba(220, 234, 255, 0.45);
          }
          70% {
            transform: translateY(-50%) scale(1.08);
            box-shadow: 0 0 0 10px rgba(220, 234, 255, 0);
          }
          100% {
            transform: translateY(-50%) scale(1);
            box-shadow: 0 0 0 0 rgba(220, 234, 255, 0);
          }
        }

        @keyframes statusPulseGreen {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.35);
          }
          70% {
            transform: scale(1.18);
            box-shadow: 0 0 0 8px rgba(52, 211, 153, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
          }
        }

        @keyframes statusPulseOrange {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35);
          }
          70% {
            transform: scale(1.14);
            box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
          }
        }

        @keyframes statusPulseStone {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(198, 178, 146, 0.28);
          }
          70% {
            transform: scale(1.08);
            box-shadow: 0 0 0 8px rgba(198, 178, 146, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(198, 178, 146, 0);
          }
        }

        @keyframes iconFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-1px);
          }
        }

        .bookingsCarousel::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
          background: #f5f7fb;
        }

        .bookingStatusCard {
          animation: bookingCardEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
          transition:
            transform 0.18s ease,
            box-shadow 0.24s ease,
            filter 0.24s ease;
          will-change: transform;
        }

        .bookingStatusCard:active {
          transform: scale(0.985);
          box-shadow: 0 9px 22px rgba(8, 31, 92, 0.16);
        }

        .bookingProgressDot.inProgress {
          animation: bookingPulse 1.9s ease-in-out infinite;
        }

        .bookingProgressDot.static {
          animation: none;
        }

        .completedAlertIcon {
          animation: iconFloat 1.8s ease-in-out infinite;
        }

        .driverContactButton:hover {
          filter: brightness(1.04);
          box-shadow: 0 16px 28px rgba(55, 83, 202, 0.32);
        }

        .driverContactButton:active {
          transform: scale(0.975);
          box-shadow: 0 8px 18px rgba(55, 83, 202, 0.24);
        }

        .availableTripCard {
          animation: tripCardEnter 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .availableTripCard:active {
          transform: scale(0.992);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1);
        }

        .availableTripButton:hover {
          filter: brightness(1.04);
          box-shadow: 0 14px 24px rgba(0, 0, 0, 0.22);
        }

        .availableTripButton:active {
          transform: scale(0.97);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.16);
        }

        .pressableButton:active {
          transform: scale(0.97);
        }

        .pressableCard:active {
          transform: scale(0.99);
        }

        @media (prefers-reduced-motion: reduce) {
          .bookingStatusCard,
          .bookingProgressDot.inProgress,
          .completedAlertIcon,
          .availableTripCard {
            animation: none !important;
          }

          .bookingStatusCard,
          .driverContactButton,
          .pressableButton,
          .pressableCard,
          .availableTripButton,
          .availableTripCard {
            transition: none !important;
          }
        }
      `}</style>
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

function formatDurationLabel(travelDuration) {
  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  }

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:00`;
  }

  return `00:${minutes.toString().padStart(2, "0")}`;
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

function getTimeLeftLabel(dateString, timeString, travelDuration) {
  const start = buildTripDateTime(dateString, timeString);
  if (!start) return "--:--";

  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  if (now < start) {
    return formatDurationLabel(travelDuration);
  }

  if (now >= end) {
    return "00:00";
  }

  const diffMs = Math.max(0, end.getTime() - now.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getTripProgressPercent(dateString, timeString, travelDuration) {
  const start = buildTripDateTime(dateString, timeString);
  if (!start) return 0;

  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  if (now <= start) return 2;
  if (now >= end) return 100;

  const totalMs = end.getTime() - start.getTime();
  const passedMs = now.getTime() - start.getTime();

  const percent = (passedMs / totalMs) * 100;
  return Math.max(2, Math.min(100, percent));
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
      label: "завершено",
      dotColor: "#E4B65E",
      dotGlow: "rgba(228,182,94,0.24)",
      textColor: "#F3C46F",
      animation: "statusPulseStone 1.9s ease-in-out infinite",
    };
  }

  if (start && end && now >= start && now < end) {
    return {
      kind: "in_progress",
      label: "в пути",
      dotColor: "#26C281",
      dotGlow: "rgba(38,194,129,0.26)",
      textColor: "#30D48D",
      animation: "statusPulseGreen 1.5s ease-in-out infinite",
    };
  }

  if (booking.status === "confirmed" && start && now < start) {
    return {
      kind: "upcoming",
      label: "бронь подтверждена",
      dotColor: "#FF6B3D",
      dotGlow: "rgba(255,107,61,0.24)",
      textColor: "#FF835E",
      animation: "statusPulseOrange 1.8s ease-in-out infinite",
    };
  }

  return {
    kind: "created",
    label: "бронь создана",
    dotColor: "#FF6B3D",
    dotGlow: "rgba(255,107,61,0.24)",
    textColor: "#FF835E",
    animation: "statusPulseOrange 1.8s ease-in-out infinite",
  };
}

function getPassengerWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "место";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "места";
  }

  return "мест";
}

function getSeatWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "место";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "места";
  }

  return "мест";
}

function formatPhoneForTel(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function getVehicleLine(trip) {
  return (
    trip.vehicle_name ||
    trip.vehicle_model ||
    trip.vehicle_title ||
    trip.vehicle ||
    trip.car_model ||
    trip.car_name ||
    "Транспорт появится позже"
  );
}

function getDriverLine(trip) {
  const plate =
    trip.vehicle_plate || trip.plate_number || trip.car_plate || "";
  const driver =
    trip.driver_name || trip.driver || trip.driver_full_name || "";

  if (plate && driver) {
    return `${plate} • ${driver}`;
  }

  if (plate) return plate;
  if (driver) return driver;

  return "Данные водителя появятся позже";
}

function formatPrice(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("ru-RU").format(amount);
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
