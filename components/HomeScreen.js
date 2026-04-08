"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

  const dateInputRef = useRef(null);
  const timeFromInputRef = useRef(null);
  const timeToInputRef = useRef(null);
  const routeSelectRef = useRef(null);

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

      const matchTimeFrom = !appliedTimeFrom || tripTime >= appliedTimeFrom;
      const matchTimeTo = !appliedTimeTo || tripTime <= appliedTimeTo;

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

      const matchTimeFrom = !appliedTimeFrom || tripTime >= appliedTimeFrom;
      const matchTimeTo = !appliedTimeTo || tripTime <= appliedTimeTo;

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

  const topFilterTitle = useMemo(() => {
    return `${getShortRouteLabel(appliedRoute)} · ${getFilterDateLabel(
      appliedDate,
      today
    )}`;
  }, [appliedRoute, appliedDate, today]);

  const draftDateTimeLabel = useMemo(() => {
    return `${formatFilterDateText(draftDate)} · ${draftTimeFrom || "00:00"} — ${
      draftTimeTo || "23:00"
    }`;
  }, [draftDate, draftTimeFrom, draftTimeTo]);

  const draftPassengersLabel = useMemo(() => {
    if (!draftMinSeats) return "2 пассажира";
    return `${draftMinSeats} ${getPassengerWord(draftMinSeats)}`;
  }, [draftMinSeats]);

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

  const handleToggleFilters = () => {
    if (!showFilters) {
      setDraftRoute(appliedRoute);
      setDraftDate(appliedDate);
      setDraftTimeFrom(appliedTimeFrom);
      setDraftTimeTo(appliedTimeTo);
      setDraftMinSeats(appliedMinSeats);
    }

    setShowFilters((prev) => !prev);
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
            }}
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
                gap: "10px",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: "0",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                backgroundColor: "#f5f7fb",
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
                const timeLeft = getTimeLeftLabel(
                  trip.trip_date,
                  trip.departure_time,
                  trip.travel_duration
                );
                const isCompletedCard = statusMeta.kind === "completed";
                const backgroundImage = getBookingBackgroundByArrivalCity(
                  trip.to_city
                );

                return (
                  <div
                    key={booking.id}
                    onClick={() => handleOpenBooking(booking.id)}
                    style={{
                      minWidth: "322px",
                      maxWidth: "322px",
                      height: "170px",
                      flex: "0 0 auto",
                      borderRadius: "22px",
                      padding: "14px 16px 12px",
                      textDecoration: "none",
                      boxShadow: "0 14px 28px rgba(28, 44, 122, 0.16)",
                      scrollSnapAlign: "start",
                      position: "relative",
                      overflow: "hidden",
                      cursor: "pointer",
                      backgroundColor: "#11246F",
                      backgroundImage: backgroundImage
                        ? `linear-gradient(180deg, rgba(8,20,88,0.70) 0%, rgba(8,20,88,0.80) 48%, rgba(8,20,88,0.88) 100%), url(${backgroundImage})`
                        : `linear-gradient(135deg, #10206C 0%, #17339A 55%, #10206C 100%)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(circle at top right, rgba(255,255,255,0.08), transparent 28%)",
                        pointerEvents: "none",
                      }}
                    />

                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          marginBottom: "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: "500",
                            color: "rgba(236,240,255,0.92)",
                            lineHeight: 1,
                          }}
                        >
                          {formatDateCard(trip.trip_date)}
                        </div>

                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "7px 14px",
                            borderRadius: "999px",
                            backgroundColor: "rgba(255,255,255,0.12)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            flexShrink: 0,
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
                              boxShadow: `0 0 0 4px ${statusMeta.dotGlow}`,
                              animation:
                                statusMeta.kind === "in_progress"
                                  ? "statusPulse 1.6s ease-in-out infinite"
                                  : "none",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: "800",
                              color: "#FFFFFF",
                              whiteSpace: "nowrap",
                              lineHeight: 1,
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "20px",
                          fontWeight: "800",
                          lineHeight: "1.14",
                          color: "#FFFFFF",
                          textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                          marginBottom: "10px",
                          letterSpacing: "-0.2px",
                        }}
                      >
                        {trip.from_city} → {trip.to_city}
                      </div>

                      <div
                        style={{
                          height: "1px",
                          backgroundColor: "rgba(255,255,255,0.18)",
                          marginBottom: "10px",
                        }}
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 96px 1fr",
                          gap: "8px",
                          alignItems: "center",
                          marginBottom: "10px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "rgba(228,235,255,0.88)",
                              marginBottom: "2px",
                              fontWeight: "500",
                              lineHeight: 1.1,
                            }}
                          >
                            Отправление
                          </div>
                          <div
                            style={{
                              fontSize: "20px",
                              fontWeight: "800",
                              lineHeight: 1,
                              color: "#FFFFFF",
                            }}
                          >
                            {departureTime}
                          </div>
                        </div>

                        <div
                          style={{
                            position: "relative",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: "50%",
                              transform: "translateY(-50%)",
                              borderTop: "2px dotted rgba(255,255,255,0.78)",
                            }}
                          />
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "999px",
                              backgroundColor: "rgba(255,255,255,0.92)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 6px 16px rgba(0,0,0,0.16)",
                              zIndex: 1,
                            }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: "#2457F5",
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "rgba(228,235,255,0.88)",
                              marginBottom: "2px",
                              fontWeight: "500",
                              lineHeight: 1.1,
                            }}
                          >
                            Прибытие
                          </div>
                          <div
                            style={{
                              fontSize: "20px",
                              fontWeight: "800",
                              lineHeight: 1,
                              color: "#FFFFFF",
                            }}
                          >
                            {arrivalTime}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: "auto" }}>
                        {isCompletedCard ? (
                          <button
                            type="button"
                            onClick={(event) => handleCallDriver(event, booking)}
                            style={{
                              width: "100%",
                              height: "38px",
                              border: "none",
                              borderRadius: "12px",
                              backgroundColor: "rgba(255,255,255,0.92)",
                              color: "#10206C",
                              fontSize: "13px",
                              fontWeight: "800",
                              cursor: "pointer",
                              boxShadow: "0 8px 16px rgba(0,0,0,0.10)",
                            }}
                          >
                            Связаться с водителем
                          </button>
                        ) : (
                          <>
                            <div
                              style={{
                                position: "relative",
                                height: "5px",
                                borderRadius: "999px",
                                backgroundColor: "rgba(255,255,255,0.18)",
                                overflow: "visible",
                                marginBottom: "8px",
                              }}
                            >
                              <div
                                style={{
                                  width: `${progress}%`,
                                  height: "100%",
                                  borderRadius: "999px",
                                  background:
                                    "linear-gradient(90deg, #2CF2E6 0%, #3BE8FF 50%, #6CF0FF 100%)",
                                  transition: "width 0.8s ease",
                                  boxShadow: "0 0 14px rgba(44,242,230,0.35)",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: `calc(${progress}% - 7px)`,
                                  transform: "translateY(-50%)",
                                  width: "14px",
                                  height: "14px",
                                  borderRadius: "50%",
                                  backgroundColor: "#FFFFFF",
                                  border: "2px solid #2CF2E6",
                                  boxShadow:
                                    "0 0 0 0 rgba(217,255,254,0.45), 0 0 12px rgba(44,242,230,0.45)",
                                  transition: "left 0.8s ease",
                                  animation: "bookingPulse 1.8s ease-in-out infinite",
                                }}
                              />
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  color: "#FFFFFF",
                                  textAlign: "right",
                                  lineHeight: 1,
                                }}
                              >
                                Осталось {timeLeft}
                              </div>
                            </div>
                          </>
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
            backgroundColor: "#ffffff",
            borderRadius: "26px",
            boxShadow: "0 10px 28px rgba(16,24,40,0.05)",
            marginBottom: "18px",
            border: "1px solid #edf1f6",
            padding: "10px",
          }}
        >
          <button
            type="button"
            onClick={handleToggleFilters}
            style={{
              width: "100%",
              minHeight: "64px",
              border: "1px solid #dde4ef",
              backgroundColor: "#ffffff",
              borderRadius: "22px",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.25s ease",
            }}
          >
            <div
              style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flex: 1,
              }}
            >
              <PinIcon />

              <div
                style={{
                  minWidth: 0,
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#1f2a44",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {topFilterTitle}
              </div>
            </div>

            <ListIcon />
          </button>

          <div
            style={{
              maxHeight: showFilters ? "520px" : "0px",
              opacity: showFilters ? 1 : 0,
              overflow: "hidden",
              transition:
                "max-height 0.32s ease, opacity 0.22s ease, transform 0.28s ease",
              transform: showFilters ? "translateY(0)" : "translateY(-6px)",
            }}
          >
            <div
              style={{
                paddingTop: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => routeSelectRef.current?.click()}
                style={filterCardButtonStyle}
              >
                <select
                  ref={routeSelectRef}
                  value={draftRoute}
                  onChange={(e) => setDraftRoute(e.target.value)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    pointerEvents: "none",
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

                <div style={routeRowStyle}>
                  <PinIcon small />
                  <div style={dividerVerticalStyle} />
                  <div style={routeTextStyle}>{getRouteFromLabel(draftRoute)}</div>
                  <ChevronRightIcon />
                </div>

                <div style={routeSwapLineStyle}>
                  <div style={routeSwapDividerStyle} />
                  <div style={routeSwapIconWrapStyle}>
                    <SwapIcon />
                  </div>
                  <div style={routeSwapDividerStyle} />
                </div>

                <div style={routeRowStyle}>
                  <PinIcon small />
                  <div style={dividerVerticalStyle} />
                  <div style={routeTextStyle}>{getRouteToLabel(draftRoute)}</div>
                  <ChevronRightIcon />
                </div>
              </button>

              <div style={filterCardStyle}>
                <CalendarIcon />
                <div style={dividerTallStyle} />

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "500",
                      color: "#1f2a44",
                      lineHeight: 1.2,
                      marginBottom: "8px",
                    }}
                  >
                    {draftDateTimeLabel}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        dateInputRef.current?.showPicker?.() ||
                        dateInputRef.current?.click()
                      }
                      style={miniPillButtonStyle}
                    >
                      {formatDateButtonText(draftDate)}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        timeFromInputRef.current?.showPicker?.() ||
                        timeFromInputRef.current?.click()
                      }
                      style={miniTimeButtonStyle}
                    >
                      {draftTimeFrom || "00:00"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        timeToInputRef.current?.showPicker?.() ||
                        timeToInputRef.current?.click()
                      }
                      style={miniTimeButtonStyle}
                    >
                      {draftTimeTo || "23:00"}
                    </button>
                  </div>

                  <input
                    ref={dateInputRef}
                    type="date"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    style={hiddenNativeInputStyle}
                  />

                  <input
                    ref={timeFromInputRef}
                    type="time"
                    value={draftTimeFrom}
                    onChange={(e) => setDraftTimeFrom(e.target.value)}
                    style={hiddenNativeInputStyle}
                  />

                  <input
                    ref={timeToInputRef}
                    type="time"
                    value={draftTimeTo}
                    onChange={(e) => setDraftTimeTo(e.target.value)}
                    style={hiddenNativeInputStyle}
                  />
                </div>

                <ChevronRightIcon />
              </div>

              <div style={filterCardStyle}>
                <PassengerIcon />
                <div style={dividerVerticalStyle} />

                <input
                  type="number"
                  min="1"
                  placeholder="2 пассажира"
                  value={draftMinSeats}
                  onChange={(e) => setDraftMinSeats(e.target.value)}
                  style={{
                    flex: 1,
                    height: "40px",
                    border: "none",
                    background: "transparent",
                    fontSize: "16px",
                    color: "#1f2a44",
                    outline: "none",
                    padding: 0,
                  }}
                />

                <ChevronRightIcon />
              </div>

              <button
                type="button"
                onClick={handleSaveFilters}
                style={{
                  marginTop: "2px",
                  height: "54px",
                  border: "none",
                  borderRadius: "24px",
                  background:
                    "linear-gradient(135deg, #2f6bff 0%, #4a84ff 50%, #2f6bff 100%)",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "800",
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(47,107,255,0.22)",
                  transition: "transform 0.18s ease, box-shadow 0.18s ease",
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.99)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                Сохранить фильтры
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  height: "54px",
                  border: "1px solid #dde4ef",
                  borderRadius: "24px",
                  backgroundColor: "#ffffff",
                  color: "#4b556b",
                  fontSize: "16px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "background-color 0.18s ease, border-color 0.18s ease",
                }}
              >
                Удалить фильтры
              </button>
            </div>
          </div>
        </div>

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
            gap: "14px",
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
              const arrivalTime = getArrivalTime(
                trip.trip_date,
                trip.departure_time,
                trip.travel_duration
              );
              const duration = formatTravelDurationCompact(
                trip.travel_duration || "~9 ч"
              );
              const freeSeats = Number(
                freeSeatsMap[trip.id] ?? trip.seats_total ?? 15
              );
              const shortFrom = getCityCode(trip.from_city);
              const shortTo = getCityCode(trip.to_city);

              return (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #2457F5 0%, #2F6BFF 45%, #2155EA 100%)",
                      borderRadius: "22px",
                      padding: "18px 16px 16px",
                      boxShadow: "0 14px 30px rgba(37,99,235,0.24)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 32%)",
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
                          marginBottom: "6px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "18px",
                            lineHeight: "1.25",
                            fontWeight: "800",
                            color: "#FFFFFF",
                            flex: 1,
                            textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                          }}
                        >
                          {trip.from_city} → {trip.to_city}
                        </div>

                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: "800",
                            color: "#FFFFFF",
                            whiteSpace: "nowrap",
                            textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                          }}
                        >
                          {departureTime}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "14px",
                          color: "rgba(255,255,255,0.94)",
                          marginBottom: "16px",
                          textShadow: "0 1px 2px rgba(0,0,0,0.14)",
                        }}
                      >
                        {formatDateLabel(trip.trip_date)}
                      </div>

                      <div
                        style={{
                          marginBottom: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "72px 1fr 72px",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "6px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: "900",
                              color: "#FFFFFF",
                              textAlign: "left",
                              textShadow: "0 1px 2px rgba(0,0,0,0.16)",
                            }}
                          >
                            {shortFrom}
                          </div>

                          <div
                            style={{
                              position: "relative",
                              height: "28px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: "50%",
                                transform: "translateY(-50%)",
                                borderTop: "2px dotted rgba(255,255,255,0.88)",
                              }}
                            />
                            <div
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "999px",
                                backgroundColor: "#F4F7FF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.16)",
                                zIndex: 1,
                                color: "#2457F5",
                                fontSize: "16px",
                                fontWeight: "900",
                              }}
                            >
                              •
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: "900",
                              color: "#FFFFFF",
                              textAlign: "right",
                              textShadow: "0 1px 2px rgba(0,0,0,0.16)",
                            }}
                          >
                            {shortTo}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "72px 1fr 72px",
                            gap: "8px",
                            alignItems: "start",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.92)",
                            }}
                          >
                            {departureTime}
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.92)",
                              textAlign: "center",
                            }}
                          >
                            {duration} в пути
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.92)",
                              textAlign: "right",
                            }}
                          >
                            {arrivalTime}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          height: "1px",
                          backgroundColor: "rgba(255,255,255,0.22)",
                          marginBottom: "12px",
                        }}
                      />

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
                            fontSize: "22px",
                            fontWeight: "900",
                            color: "#FFFFFF",
                            lineHeight: 1,
                            textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                          }}
                        >
                          {formatPrice(trip.price)} ₽
                        </div>

                        <div
                          style={{
                            minHeight: "36px",
                            padding: "0 14px",
                            borderRadius: "999px",
                            backgroundColor: "rgba(255,255,255,0.16)",
                            border: "1px solid rgba(255,255,255,0.14)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: "700",
                            color: "#FFFFFF",
                            backdropFilter: "blur(6px)",
                            WebkitBackdropFilter: "blur(6px)",
                            textShadow: "0 1px 2px rgba(0,0,0,0.16)",
                          }}
                        >
                          Свободно мест: {freeSeats}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes bookingPulse {
          0% {
            transform: translateY(-50%) scale(1);
            box-shadow: 0 0 0 0 rgba(217, 255, 254, 0.45);
          }
          70% {
            transform: translateY(-50%) scale(1.08);
            box-shadow: 0 0 0 8px rgba(217, 255, 254, 0);
          }
          100% {
            transform: translateY(-50%) scale(1);
            box-shadow: 0 0 0 0 rgba(217, 255, 254, 0);
          }
        }

        @keyframes statusPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(103, 240, 142, 0.4);
          }
          70% {
            transform: scale(1.12);
            box-shadow: 0 0 0 10px rgba(103, 240, 142, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(103, 240, 142, 0);
          }
        }

        .bookingsCarousel::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
          background: transparent;
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
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU");
}

function formatDateCard(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateLabel(dateString) {
  if (!dateString) return "";

  const inputDate = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay =
    inputDate.getFullYear() === today.getFullYear() &&
    inputDate.getMonth() === today.getMonth() &&
    inputDate.getDate() === today.getDate();

  const sameTomorrow =
    inputDate.getFullYear() === tomorrow.getFullYear() &&
    inputDate.getMonth() === tomorrow.getMonth() &&
    inputDate.getDate() === tomorrow.getDate();

  const formatted = inputDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  if (sameDay) return `Сегодня, ${formatted}`;
  if (sameTomorrow) return `Завтра, ${formatted}`;

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getFilterDateLabel(dateString, todayString) {
  if (!dateString) return "Сегодня";

  if (dateString === todayString) return "Сегодня";
  if (dateString === getNextDayString(todayString)) return "Завтра";

  return formatDateRu(dateString);
}

function formatFilterDateText(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function formatDateButtonText(dateString) {
  if (!dateString) return "Выбрать дату";

  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getShortRouteLabel(route) {
  if (route === "all") return "Все маршруты";
  return route;
}

function getRouteFromLabel(route) {
  if (route === "Москва → Санкт-Петербург") return "Москва MSK";
  if (route === "Санкт-Петербург → Москва") return "Санкт-Петербург SPB";
  return "Все маршруты";
}

function getRouteToLabel(route) {
  if (route === "Москва → Санкт-Петербург") return "Санкт-Петербург SPB";
  if (route === "Санкт-Петербург → Москва") return "Москва MSK";
  return "Все направления";
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

function formatTravelDurationCompact(value) {
  const minutes = parseTravelDurationMinutes(value);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${mins} м`;
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
  if (!start) return "0ч 00м";

  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  if (now >= end) {
    return "0ч 00м";
  }

  const target = now < start ? start : end;
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}ч ${String(minutes).padStart(2, "0")}м`;
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
      dotColor: "#D0E3FF",
      dotGlow: "rgba(208,227,255,0.22)",
    };
  }

  if (booking.status === "confirmed" && start && now < start) {
    return {
      kind: "upcoming",
      label: "Ожидает",
      dotColor: "#F59E0B",
      dotGlow: "rgba(245,158,11,0.28)",
    };
  }

  if (start && end && now >= start && now < end) {
    return {
      kind: "in_progress",
      label: "В пути",
      dotColor: "#67F08E",
      dotGlow: "rgba(103,240,142,0.34)",
    };
  }

  return {
    kind: "created",
    label: booking.status === "confirmed" ? "Ожидает" : "Создана",
    dotColor: "#F59E0B",
    dotGlow: "rgba(245,158,11,0.28)",
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

function getCityCode(city) {
  const value = String(city || "").toLowerCase().trim();

  if (value.includes("моск")) return "MSK";
  if (value.includes("санкт") || value.includes("петер")) return "SPB";

  return String(city || "").slice(0, 3).toUpperCase();
}

function formatPrice(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("ru-RU").format(number);
}

function getBookingBackgroundByArrivalCity(toCity) {
  const city = String(toCity || "").toLowerCase().trim();

  if (city.includes("моск")) {
    return "/images/cities/moscow.jpg";
  }

  if (city.includes("санкт") || city.includes("петер")) {
    return "/images/cities/spb.jpg";
  }

  return "";
}

const filterInlineInputStyle = {
  height: "34px",
  borderRadius: "10px",
  border: "1px solid #dfe6f5",
  padding: "0 10px",
  fontSize: "13px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
};

const filterInlineTimeStyle = {
  height: "34px",
  width: "92px",
  borderRadius: "10px",
  border: "1px solid #dfe6f5",
  padding: "0 10px",
  fontSize: "13px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
};

const filterCardStyle = {
  border: "1px solid #dde4ef",
  borderRadius: "22px",
  backgroundColor: "#ffffff",
  minHeight: "66px",
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  transition: "all 0.22s ease",
};

const filterCardButtonStyle = {
  position: "relative",
  border: "1px solid #dde4ef",
  borderRadius: "22px",
  backgroundColor: "#ffffff",
  overflow: "hidden",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.22s ease",
};

const routeRowStyle = {
  minHeight: "60px",
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const routeTextStyle = {
  flex: 1,
  fontSize: "16px",
  fontWeight: "500",
  color: "#1f2a44",
  lineHeight: 1.2,
};

const dividerVerticalStyle = {
  width: "1px",
  height: "28px",
  backgroundColor: "#dde4ef",
  flexShrink: 0,
};

const dividerTallStyle = {
  width: "1px",
  alignSelf: "stretch",
  backgroundColor: "#dde4ef",
  flexShrink: 0,
  margin: "12px 0",
};

const routeSwapLineStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 16px",
};

const routeSwapDividerStyle = {
  flex: 1,
  height: "1px",
  backgroundColor: "#e8edf5",
};

const routeSwapIconWrapStyle = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const miniPillButtonStyle = {
  height: "38px",
  borderRadius: "12px",
  border: "1px solid #dde4ef",
  backgroundColor: "#ffffff",
  padding: "0 12px",
  fontSize: "12px",
  color: "#1f2a44",
  cursor: "pointer",
};

const miniTimeButtonStyle = {
  height: "38px",
  minWidth: "82px",
  borderRadius: "12px",
  border: "1px solid #dde4ef",
  backgroundColor: "#ffffff",
  padding: "0 12px",
  fontSize: "12px",
  color: "#1f2a44",
  cursor: "pointer",
};

const hiddenNativeInputStyle = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 0,
  height: 0,
};

function PinIcon({ small = false }) {
  const size = small ? 20 : 22;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21C12 21 17.5 14.9 17.5 10.2C17.5 7.06 14.97 4.5 11.85 4.5C8.73 4.5 6.2 7.06 6.2 10.2C6.2 14.9 12 21 12 21Z"
        stroke="#1F2A44"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10.2" r="2.2" fill="#1F2A44" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="5" height="3" rx="1" fill="#1F2A44" />
      <rect x="13" y="5" width="7" height="3" rx="1" fill="#1F2A44" />
      <rect x="4" y="10.5" width="5" height="3" rx="1" fill="#1F2A44" />
      <rect x="13" y="10.5" width="7" height="3" rx="1" fill="#1F2A44" />
      <rect x="4" y="16" width="5" height="3" rx="1" fill="#1F2A44" />
      <rect x="13" y="16" width="7" height="3" rx="1" fill="#1F2A44" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 6L15 12L9 18"
        stroke="#1F2A44"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 7H18M18 7L15.5 4.5M18 7L15.5 9.5"
        stroke="#1F2A44"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17H6M6 17L8.5 14.5M6 17L8.5 19.5"
        stroke="#1F2A44"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="6"
        width="16"
        height="14"
        rx="2.5"
        stroke="#1F2A44"
        strokeWidth="1.8"
      />
      <path d="M8 4V8" stroke="#1F2A44" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 4V8" stroke="#1F2A44" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 10H20" stroke="#1F2A44" strokeWidth="1.8" />
    </svg>
  );
}

function PassengerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="#1F2A44" strokeWidth="1.8" />
      <path
        d="M5 19C6.2 15.9 8.7 14.5 12 14.5C15.3 14.5 17.8 15.9 19 19"
        stroke="#1F2A44"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}