"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];
const ACTIVE_TRIP_STATUSES = ["scheduled", "in_progress", "active"];
const COMPLETED_CARD_VISIBLE_HOURS = 2;

export default function HomeScreen({ user, onOpenProfile }) {
  const router = useRouter();
  const filtersRef = useRef(null);

  const today = getTodayString();
  const tomorrow = getNextDayString(today);
  const nowTime = getCurrentTimeString();

  const [showFilters, setShowFilters] = useState(false);
  const [showPassengerPicker, setShowPassengerPicker] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedDate]);

  useEffect(() => {
    loadMyBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.telegram_id, user?.id]);

  useEffect(() => {
    if (!showPassengerPicker) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPassengerPicker]);

  async function enrichTripsWithRelations(rawTrips) {
    const tripsList = rawTrips || [];
    if (!tripsList.length) return [];

    const driverIds = [
      ...new Set(tripsList.map((trip) => trip.driver_id).filter(Boolean)),
    ];
    const vehicleIds = [
      ...new Set(tripsList.map((trip) => trip.vehicle_id).filter(Boolean)),
    ];

    let driversMap = {};
    let vehiclesMap = {};

    if (driverIds.length > 0) {
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select("id, full_name, phone, email, status")
        .in("id", driverIds);

      if (driversError) {
        console.error("Ошибка загрузки drivers:", driversError);
      } else {
        driversMap = Object.fromEntries(
          (driversData || []).map((driver) => [driver.id, driver])
        );
      }
    }

    if (vehicleIds.length > 0) {
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select(
          "id, plate_number, brand, model, color, year, seats_total, seats_count, status, class"
        )
        .in("id", vehicleIds);

      if (vehiclesError) {
        console.error("Ошибка загрузки vehicles:", vehiclesError);
      } else {
        vehiclesMap = Object.fromEntries(
          (vehiclesData || []).map((vehicle) => [vehicle.id, vehicle])
        );
      }
    }

    return tripsList.map((trip) => {
      const driver = trip.driver_id ? driversMap[trip.driver_id] || null : null;
      const vehicle = trip.vehicle_id
        ? vehiclesMap[trip.vehicle_id] || null
        : null;

      return {
        ...trip,
        driver,
        vehicle,
        driver_name: driver?.full_name || "",
        driver_phone: driver?.phone || "",
        vehicle_model: buildVehicleModel(vehicle),
        vehicle_plate: vehicle?.plate_number || "",
      };
    });
  }

  async function loadTripsAndFreeSeats() {
    try {
      setLoading(true);

      const datesToLoad =
        appliedDate === today ? [appliedDate, tomorrow] : [appliedDate];

      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .in("status", ACTIVE_TRIP_STATUSES)
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

      const enrichedTrips = await enrichTripsWithRelations(tripsData || []);
      setTrips(enrichedTrips);

      if (enrichedTrips.length === 0) {
        setFreeSeatsMap({});
        return;
      }

      const tripIds = enrichedTrips.map((trip) => trip.id);

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

      for (const trip of enrichedTrips) {
        const totalSeats = Number(trip.seats_total || trip.seats_count || 15);
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

      const enrichedTrips = await enrichTripsWithRelations(tripsData || []);

      const tripsMap = {};
      for (const trip of enrichedTrips) {
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

          const durationMinutes = parseTravelDurationMinutes(trip);
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

    const rawPhone = booking?.trip?.driver_phone || booking?.trip?.driver?.phone || "";
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

  function handleOpenFiltersFromBottom() {
    if (!showFilters) {
      setDraftRoute(appliedRoute);
      setDraftDate(appliedDate);
      setDraftTimeFrom(appliedTimeFrom);
      setDraftTimeTo(appliedTimeTo);
      setDraftMinSeats(appliedMinSeats);
    }

    setShowFilters(true);
    setShowPassengerPicker(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        filtersRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }

  const availableRoutes = useMemo(() => {
    const uniqueRoutes = new Set();

    for (const trip of trips) {
      if (!trip?.from_city || !trip?.to_city) continue;
      uniqueRoutes.add(`${trip.from_city} → ${trip.to_city}`);
    }

    return Array.from(uniqueRoutes).sort((a, b) => a.localeCompare(b, "ru"));
  }, [trips]);

  const todayTripsFiltered = useMemo(() => {
    return trips.filter((trip) => {
      if (trip.trip_date !== appliedDate) return false;

      const routeName = `${trip.from_city} → ${trip.to_city}`;
      const tripTime = trip.departure_time?.slice(0, 5) || "";
      const freeSeats = Number(
        freeSeatsMap[trip.id] ?? trip.seats_total ?? trip.seats_count ?? 15
      );

      const matchRoute = appliedRoute === "all" || routeName === appliedRoute;
      const matchSeats = !appliedMinSeats || freeSeats >= Number(appliedMinSeats);
      const matchTimeFrom = !appliedTimeFrom || tripTime >= appliedTimeFrom;
      const matchTimeTo = !appliedTimeTo || tripTime <= appliedTimeTo;
      const matchCurrentTime = appliedDate !== today || tripTime >= nowTime;

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
      const freeSeats = Number(
        freeSeatsMap[trip.id] ?? trip.seats_total ?? trip.seats_count ?? 15
      );

      const matchRoute = appliedRoute === "all" || routeName === appliedRoute;
      const matchSeats = !appliedMinSeats || freeSeats >= Number(appliedMinSeats);
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

  const appliedFilterSummary = useMemo(() => {
    const parts = [];

    parts.push(appliedRoute === "all" ? "Все маршруты" : appliedRoute);
    parts.push(getFilterDateLabel(appliedDate, today));

    if (appliedTimeFrom || appliedTimeTo) {
      parts.push(
        `${appliedTimeFrom || "00:00"} — ${appliedTimeTo || "23:59"}`
      );
    }

    if (appliedMinSeats) {
      parts.push(`${appliedMinSeats} ${getPassengerWord(appliedMinSeats)}`);
    }

    return parts.join(" · ");
  }, [
    appliedRoute,
    appliedDate,
    appliedTimeFrom,
    appliedTimeTo,
    appliedMinSeats,
    today,
  ]);

  const draftMatchingTripsForPassenger = useMemo(() => {
    return trips.filter((trip) => {
      if (trip.trip_date !== draftDate) return false;

      const routeName = `${trip.from_city} → ${trip.to_city}`;
      const tripTime = trip.departure_time?.slice(0, 5) || "";
      const freeSeats = Number(
        freeSeatsMap[trip.id] ?? trip.seats_total ?? trip.seats_count ?? 15
      );

      const matchRoute = draftRoute === "all" || routeName === draftRoute;
      const matchTimeFrom = !draftTimeFrom || tripTime >= draftTimeFrom;
      const matchTimeTo = !draftTimeTo || tripTime <= draftTimeTo;
      const matchCurrentTime = draftDate !== today || tripTime >= nowTime;

      return (
        matchRoute &&
        matchTimeFrom &&
        matchTimeTo &&
        matchCurrentTime &&
        freeSeats > 0
      );
    });
  }, [
    trips,
    freeSeatsMap,
    draftRoute,
    draftDate,
    draftTimeFrom,
    draftTimeTo,
    today,
    nowTime,
  ]);

  const draftPassengerMax = useMemo(() => {
    if (!draftMatchingTripsForPassenger.length) return 0;

    return draftMatchingTripsForPassenger.reduce((max, trip) => {
      const freeSeats = Number(
        freeSeatsMap[trip.id] ?? trip.seats_total ?? trip.seats_count ?? 15
      );
      return Math.max(max, freeSeats);
    }, 0);
  }, [draftMatchingTripsForPassenger, freeSeatsMap]);

  const draftPassengerOptions = useMemo(() => {
    return Array.from(
      { length: Math.max(draftPassengerMax, 0) },
      (_, index) => String(index + 1)
    );
  }, [draftPassengerMax]);

  useEffect(() => {
    if (!draftMinSeats) return;

    if (draftPassengerMax === 0) {
      setDraftMinSeats("");
      return;
    }

    if (Number(draftMinSeats) > draftPassengerMax) {
      setDraftMinSeats(String(draftPassengerMax));
    }
  }, [draftPassengerMax, draftMinSeats]);

  const draftPassengerLabel = draftMinSeats
    ? `${draftMinSeats} ${getPassengerWord(draftMinSeats)}`
    : "1 пассажир";

  const handleSaveFilters = () => {
    const safeDraftMinSeats =
      draftMinSeats && draftPassengerMax > 0
        ? String(Math.min(Number(draftMinSeats), draftPassengerMax))
        : "";

    setAppliedRoute(draftRoute);
    setAppliedDate(draftDate);
    setAppliedTimeFrom(draftTimeFrom);
    setAppliedTimeTo(draftTimeTo);
    setAppliedMinSeats(safeDraftMinSeats);
    setShowPassengerPicker(false);
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

    setShowPassengerPicker(false);
    setShowFilters(false);
  };

  const handleToggleFilters = () => {
    if (!showFilters) {
      setDraftRoute(appliedRoute);
      setDraftDate(appliedDate);
      setDraftTimeFrom(appliedTimeFrom);
      setDraftTimeTo(appliedTimeTo);
      setDraftMinSeats(appliedMinSeats);
      setShowPassengerPicker(false);
    } else {
      setShowPassengerPicker(false);
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
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#111111",
            }}
          >
            <ProfileIcon />
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
                  trip
                );
                const departureTime = normalizeTime(trip.departure_time);
                const arrivalTime = getArrivalTime(
                  trip.trip_date,
                  trip.departure_time,
                  trip
                );
                const timeLeft = getTimeLeftLabel(
                  trip.trip_date,
                  trip.departure_time,
                  trip
                );
                const isCompletedCard = statusMeta.kind === "completed";
                const isBeforeDeparture =
                  statusMeta.kind === "created" || statusMeta.kind === "upcoming";
                const timePrefix = isBeforeDeparture ? "До отправления" : "Осталось";
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
                                height: "3px",
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
                                  left: `calc(${progress}% - 2.5px)`,
                                  transform: "translateY(-50%)",
                                  width: "5px",
                                  height: "5px",
                                  borderRadius: "50%",
                                  backgroundColor: "#FFFFFF",
                                  border: "1px solid #2CF2E6",
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
                                {timePrefix} {timeLeft}
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
                  href="/history"
                  style={{
                    minWidth: "322px",
                    maxWidth: "322px",
                    height: "170px",
                    flex: "0 0 auto",
                    borderRadius: "22px",
                    padding: "16px",
                    textDecoration: "none",
                    scrollSnapAlign: "start",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxSizing: "border-box",
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                    border: "1px solid #e8edf6",
                    boxShadow: "0 12px 28px rgba(17,24,39,0.07)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        backgroundColor: "#eef4ff",
                        color: "#2457F5",
                        fontSize: "12px",
                        fontWeight: "800",
                        marginBottom: "12px",
                      }}
                    >
                      Все поездки
                    </div>

                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "800",
                        lineHeight: "1.2",
                        color: "#111827",
                        marginBottom: "10px",
                      }}
                    >
                      Посмотреть все бронирования
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        lineHeight: "1.45",
                      }}
                    >
                      Откройте полный список поездок и деталей по каждой броне
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#94a3b8",
                        fontWeight: "700",
                      }}
                    >
                      История и активные поездки
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "800",
                        color: "#2563eb",
                      }}
                    >
                      Открыть →
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        <div
          ref={filtersRef}
          style={{
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: showFilters ? "24px 24px 20px 20px" : "24px",
              border: "1px solid #e8edf5",
              boxShadow: "0 12px 28px rgba(17,24,39,0.06)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={handleToggleFilters}
              style={{
                width: "100%",
                minHeight: "60px",
                border: "none",
                backgroundColor: "#ffffff",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                textAlign: "left",
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
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    flexShrink: 0,
                    borderRadius: "12px",
                    backgroundColor: "#f4f7fc",
                    color: "#667085",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PinIcon />
                </div>

                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#94a3b8",
                      marginBottom: "2px",
                      lineHeight: 1.1,
                    }}
                  >
                    Поиск маршрута
                  </div>

                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "#1f2937",
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {appliedFilterSummary}
                  </div>
                </div>
              </div>

              <div
                style={{
                  width: "32px",
                  height: "32px",
                  flexShrink: 0,
                  borderRadius: "12px",
                  backgroundColor: "#f4f7fc",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: showFilters ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.22s ease",
                }}
              >
                {showFilters ? <ChevronUpIcon /> : <FilterGridIcon />}
              </div>
            </button>

            <div
              style={{
                maxHeight: showFilters ? "760px" : "0px",
                opacity: showFilters ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 0.28s ease, opacity 0.2s ease",
                borderTop: showFilters ? "1px solid #edf2f8" : "none",
              }}
            >
              <div
                style={{
                  padding: "12px 12px 14px",
                  background:
                    "linear-gradient(180deg, #ffffff 0%, #fbfcff 100%)",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f7f9fd",
                    borderRadius: "20px",
                    padding: "10px",
                    border: "1px solid #eef2f8",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <FilterField icon={<PinIcon />}>
                      <select
                        value={draftRoute}
                        onChange={(e) => {
                          setDraftRoute(e.target.value);
                          setShowPassengerPicker(false);
                        }}
                        style={fieldNativeSelectStyle}
                      >
                        <option value="all">Все маршруты</option>
                        {availableRoutes.map((route) => (
                          <option key={route} value={route}>
                            {route}
                          </option>
                        ))}
                      </select>
                    </FilterField>

                    <FilterField icon={<CalendarIcon />}>
                      <input
                        type="date"
                        value={draftDate}
                        onChange={(e) => {
                          setDraftDate(e.target.value);
                          setShowPassengerPicker(false);
                        }}
                        style={fieldNativeInputStyle}
                      />
                    </FilterField>

                    <FilterField icon={<ClockIcon />}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                        }}
                      >
                        <input
                          type="time"
                          value={draftTimeFrom}
                          onChange={(e) => {
                            setDraftTimeFrom(e.target.value);
                            setShowPassengerPicker(false);
                          }}
                          style={{
                            ...fieldNativeInputStyle,
                            width: "100%",
                            minWidth: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#8a93a6",
                            fontWeight: "600",
                            flexShrink: 0,
                          }}
                        >
                          —
                        </span>
                        <input
                          type="time"
                          value={draftTimeTo}
                          onChange={(e) => {
                            setDraftTimeTo(e.target.value);
                            setShowPassengerPicker(false);
                          }}
                          style={{
                            ...fieldNativeInputStyle,
                            width: "100%",
                            minWidth: 0,
                          }}
                        />
                      </div>
                    </FilterField>

                    <button
                      type="button"
                      onClick={() => {
                        if (draftPassengerMax > 0) {
                          setShowPassengerPicker(true);
                        }
                      }}
                      style={{
                        width: "100%",
                        minHeight: "54px",
                        borderRadius: "16px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e8edf5",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "0 14px",
                        boxSizing: "border-box",
                        cursor: draftPassengerMax > 0 ? "pointer" : "default",
                        textAlign: "left",
                        boxShadow: "0 2px 6px rgba(15,23,42,0.02)",
                      }}
                    >
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          color: "#798396",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <UserIcon />
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: "14px",
                          fontWeight: "600",
                          color:
                            draftPassengerMax > 0 ? "#394150" : "#9ca3af",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {draftPassengerMax > 0
                          ? draftPassengerLabel
                          : "Нет доступных мест"}
                      </div>

                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          color: draftPassengerMax > 0 ? "#94a3b8" : "#cbd5e1",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ChevronDownIcon />
                      </div>
                    </button>

                    {showPassengerPicker && draftPassengerMax > 0 && (
                      <PassengerSelectModal
                        options={draftPassengerOptions}
                        selectedValue={
                          draftMinSeats && draftPassengerOptions.includes(draftMinSeats)
                            ? draftMinSeats
                            : draftPassengerOptions[0] || ""
                        }
                        onSelect={(value) => {
                          setDraftMinSeats(value);
                          setShowPassengerPicker(false);
                        }}
                        onClose={() => setShowPassengerPicker(false)}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveFilters}
                    style={{
                      marginTop: "12px",
                      width: "100%",
                      height: "46px",
                      border: "none",
                      borderRadius: "16px",
                      background:
                        "linear-gradient(135deg, #2457F5 0%, #2F6BFF 45%, #2155EA 100%)",
                      color: "#ffffff",
                      fontSize: "15px",
                      fontWeight: "800",
                      cursor: "pointer",
                      boxShadow: "0 10px 20px rgba(37,99,235,0.22)",
                    }}
                  >
                    Показать маршруты
                  </button>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      marginTop: "8px",
                      width: "100%",
                      height: "44px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      backgroundColor: "#ffffff",
                      color: "#111827",
                      fontSize: "14px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Сбросить фильтры
                  </button>
                </div>
              </div>
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
            paddingBottom: "16px",
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
                trip
              );
              const duration = formatTravelDurationCompact(trip);
              const freeSeats = Number(
                freeSeatsMap[trip.id] ?? trip.seats_total ?? trip.seats_count ?? 15
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

        <button
          type="button"
          onClick={handleOpenFiltersFromBottom}
          style={{
            width: "100%",
            height: "54px",
            border: "none",
            borderRadius: "18px",
            marginTop: "4px",
            marginBottom: "30px",
            background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: "800",
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
          }}
        >
          Подобрать маршрут
        </button>
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

        @keyframes sheetSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .bookingsCarousel::-webkit-scrollbar,
        .passengerOptionsList::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
          background: transparent;
        }

        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          opacity: 0.75;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function FilterField({ icon, children }) {
  return (
    <div
      style={{
        minHeight: "54px",
        borderRadius: "16px",
        backgroundColor: "#ffffff",
        border: "1px solid #e8edf5",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "0 14px",
        boxSizing: "border-box",
        boxShadow: "0 2px 6px rgba(15,23,42,0.02)",
      }}
    >
      <div
        style={{
          width: "18px",
          height: "18px",
          color: "#798396",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PassengerSelectModal({
  options,
  selectedValue,
  onSelect,
  onClose,
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(15,23,42,0.26)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "74vh",
          overflow: "hidden",
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
          background: "#ffffff",
          boxShadow: "0 -16px 40px rgba(15,23,42,0.20)",
          borderTop: "1px solid rgba(226,232,240,0.9)",
          animation: "sheetSlideUp 0.22s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "10px",
            paddingBottom: "6px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "5px",
              borderRadius: "999px",
              backgroundColor: "#d6dce7",
            }}
          />
        </div>

        <div
          style={{
            padding: "2px 18px 10px",
            borderBottom: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "4px",
            }}
          >
            Количество пассажиров
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              lineHeight: "1.4",
            }}
          >
            Выберите нужное количество мест из доступных
          </div>
        </div>

        <div
          className="passengerOptionsList"
          style={{
            maxHeight: "52vh",
            overflowY: "auto",
            padding: "8px 12px 18px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {options.map((option) => {
            const isSelected = option === selectedValue;
            const label = `${option} ${getPassengerWord(option)}`;

            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  width: "100%",
                  minHeight: "56px",
                  border: "1px solid " + (isSelected ? "#cfe0ff" : "#edf2f7"),
                  background: isSelected ? "#f3f7ff" : "#ffffff",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                  padding: "0 16px",
                  color: "#111827",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    lineHeight: 1.2,
                    fontWeight: isSelected ? "800" : "700",
                    letterSpacing: "-0.1px",
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    minWidth: "22px",
                    borderRadius: "50%",
                    backgroundColor: isSelected ? "#2457F5" : "transparent",
                    border: isSelected ? "none" : "2px solid #d1d9e6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    transition: "all 0.18s ease",
                  }}
                >
                  {isSelected ? <CheckIconSmall /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <path
        d="M5 12.5l4.1 4.1L19 6.7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIconSmall() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path
        d="M6 12.2l3.2 3.2L18 6.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M5 19c1.7-3.2 4.4-4.8 7-4.8s5.3 1.6 7 4.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M8 3v4M16 3v4M3 9h18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 7.8v4.6l3.1 1.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M5.5 19c1.6-3.1 4.1-4.7 6.5-4.7s4.9 1.6 6.5 4.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterGridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect x="5" y="5" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="10" y="5" width="4" height="4" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="15" y="5" width="4" height="4" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="5" y="10" width="4" height="4" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="15" y="10" width="4" height="4" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="5" y="15" width="4" height="4" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="10" y="15" width="4" height="4" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="15" y="15" width="4" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M7 14l5-5 5 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0 -3)"
      />
    </svg>
  );
}

function buildVehicleModel(vehicle) {
  if (!vehicle) return "";

  const brand = String(vehicle.brand || "").trim();
  const model = String(vehicle.model || "").trim();

  if (brand && model) return `${brand} ${model}`;
  return brand || model || "";
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

function parseTravelDurationMinutes(value) {
  if (!value) return 9 * 60;

  if (typeof value === "number") {
    return value > 0 ? value : 9 * 60;
  }

  if (typeof value === "object") {
    const durationMinutes = Number(value.duration_minutes || 0);
    if (durationMinutes > 0) return durationMinutes;

    if (value.trip_date && value.departure_time && value.arrival_time) {
      const start = buildTripDateTime(value.trip_date, value.departure_time);
      const end = buildTripDateTime(value.trip_date, value.arrival_time);

      if (start && end) {
        let diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        if (diffMinutes <= 0) diffMinutes += 24 * 60;
        if (diffMinutes > 0) return diffMinutes;
      }
    }

    return 9 * 60;
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
  if (travelDuration && typeof travelDuration === "object") {
    const rawArrival = normalizeTime(travelDuration.arrival_time);
    if (rawArrival) return rawArrival;
  }

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

  const durationMinutes = parseTravelDurationMinutes(trip);
  const end =
    booking?.arrivalDateTime ||
    (start
      ? new Date(start.getTime() + durationMinutes * 60 * 1000)
      : null);

  const now = new Date();

  if (booking?.status === "cancelled") {
    return {
      kind: "cancelled",
      label: "Отменена",
      dotColor: "#F87171",
      dotGlow: "rgba(248,113,113,0.30)",
    };
  }

  if (start && end && now >= end) {
    return {
      kind: "completed",
      label: "Завершено",
      dotColor: "#D0E3FF",
      dotGlow: "rgba(208,227,255,0.22)",
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

  if (booking?.status === "confirmed" && start && now < start) {
    return {
      kind: "upcoming",
      label: "Подтверждена",
      dotColor: "#F59E0B",
      dotGlow: "rgba(245,158,11,0.28)",
    };
  }

  return {
    kind: "created",
    label: booking?.status === "confirmed" ? "Подтверждена" : "Создана",
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
  if (value.includes("минск")) return "MSQ";
  if (value.includes("баранович")) return "BRV";

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

const fieldNativeInputStyle = {
  width: "100%",
  height: "100%",
  minHeight: "50px",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontSize: "14px",
  fontWeight: "600",
  color: "#394150",
  padding: "0",
  margin: "0",
  boxSizing: "border-box",
};

const fieldNativeSelectStyle = {
  width: "100%",
  height: "100%",
  minHeight: "50px",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontSize: "14px",
  fontWeight: "600",
  color: "#394150",
  padding: "0",
  margin: "0",
  boxSizing: "border-box",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};
