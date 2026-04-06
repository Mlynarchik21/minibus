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
    <>
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #07111f;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        * {
          box-sizing: border-box;
        }

        a,
        button,
        input,
        select {
          -webkit-tap-highlight-color: transparent;
        }

        .page-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 24%),
            radial-gradient(circle at top right, rgba(168, 85, 247, 0.10), transparent 20%),
            linear-gradient(180deg, #0a1324 0%, #0d1728 40%, #eef3f9 40%, #f4f7fb 100%);
          padding: 18px 16px 34px;
        }

        .app-container {
          max-width: 520px;
          margin: 0 auto;
        }

        .glass-top {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          padding: 20px;
          margin-bottom: 18px;
          background: linear-gradient(
            145deg,
            rgba(10, 19, 36, 0.92) 0%,
            rgba(15, 23, 42, 0.96) 45%,
            rgba(17, 24, 39, 0.95) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow:
            0 18px 42px rgba(4, 10, 20, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .glass-top::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 12% 18%, rgba(96, 165, 250, 0.18), transparent 22%),
            radial-gradient(circle at 88% 12%, rgba(192, 132, 252, 0.14), transparent 18%);
          pointer-events: none;
        }

        .top-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .welcome-kicker {
          font-size: 13px;
          line-height: 1;
          color: rgba(226, 232, 240, 0.78);
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }

        .welcome-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          line-height: 1.1;
          color: #ffffff;
          letter-spacing: -0.03em;
        }

        .welcome-subline {
          margin-top: 10px;
          font-size: 13px;
          color: rgba(226, 232, 240, 0.72);
        }

        .profile-btn {
          position: relative;
          z-index: 1;
          width: 52px;
          height: 52px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08));
          color: #ffffff;
          font-size: 20px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          backdrop-filter: blur(12px);
        }

        .profile-btn:active {
          transform: scale(0.96);
        }

        .section-fade {
          animation: fadeUp 0.45s ease both;
        }

        .horizontal-scroll {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 6px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .horizontal-scroll::-webkit-scrollbar {
          display: none;
        }

        .booking-card {
          min-width: 320px;
          max-width: 320px;
          flex: 0 0 auto;
          border-radius: 30px;
          padding: 18px;
          text-decoration: none;
          scroll-snap-align: start;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          background:
            linear-gradient(145deg, #0b1220 0%, #0e172a 46%, #101b31 100%);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow:
            0 18px 38px rgba(15, 23, 42, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transform: translateY(0);
          transition: transform 0.24s ease, box-shadow 0.24s ease;
        }

        .booking-card:active {
          transform: scale(0.985);
        }

        .booking-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,0.24), transparent 32%),
            radial-gradient(circle at top left, rgba(244,114,182,0.18), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.02), transparent 50%);
          pointer-events: none;
        }

        .booking-card-light {
          min-width: 240px;
          max-width: 240px;
          flex: 0 0 auto;
          border-radius: 28px;
          padding: 18px;
          text-decoration: none;
          scroll-snap-align: start;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border: 1px solid rgba(15, 23, 42, 0.06);
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }

        .booking-card-light:active {
          transform: scale(0.985);
        }

        .booking-pill {
          display: inline-flex;
          align-items: center;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(90deg, #ec4899 0%, #2563eb 100%);
          box-shadow: 0 8px 22px rgba(37, 99, 235, 0.24);
        }

        .filters-row {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }

        .premium-select,
        .premium-input {
          width: 100%;
          height: 48px;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          padding: 0 14px;
          font-size: 15px;
          background: rgba(255, 255, 255, 0.9);
          color: #0f172a;
          outline: none;
          box-shadow:
            0 10px 24px rgba(15, 23, 42, 0.05),
            inset 0 1px 0 rgba(255,255,255,0.9);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease;
          backdrop-filter: blur(10px);
        }

        .premium-select:focus,
        .premium-input:focus {
          border-color: rgba(37, 99, 235, 0.4);
          box-shadow:
            0 0 0 4px rgba(37, 99, 235, 0.10),
            0 12px 26px rgba(15, 23, 42, 0.08);
        }

        .filter-toggle-btn {
          min-width: 48px;
          height: 48px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(180deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 14px 26px rgba(37, 99, 235, 0.24);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .filter-toggle-btn:active {
          transform: scale(0.96);
        }

        .filters-panel {
          background: rgba(255, 255, 255, 0.86);
          border-radius: 24px;
          padding: 16px;
          box-shadow:
            0 20px 34px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.7);
          margin-bottom: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          backdrop-filter: blur(14px);
          animation: fadeDown 0.25s ease;
        }

        .panel-label {
          font-size: 13px;
          color: #475569;
          font-weight: 700;
          margin-bottom: 6px;
          display: block;
        }

        .primary-btn,
        .secondary-btn,
        .trip-cta-btn {
          border: none;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }

        .primary-btn:active,
        .secondary-btn:active,
        .trip-cta-btn:active {
          transform: scale(0.985);
        }

        .primary-btn {
          margin-top: 6px;
          height: 46px;
          border-radius: 16px;
          background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
        }

        .secondary-btn {
          height: 46px;
          border-radius: 16px;
          background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.18);
        }

        .info-banner {
          background: linear-gradient(180deg, #eff6ff 0%, #e8f1ff 100%);
          border: 1px solid #c6dcff;
          color: #1d4ed8;
          border-radius: 18px;
          padding: 13px 14px;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.08);
        }

        .cards-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 34px;
        }

        .trip-card,
        .empty-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%);
          border-radius: 24px;
          padding: 18px;
          box-shadow:
            0 16px 30px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.88);
          border: 1px solid rgba(226, 232, 240, 0.95);
          backdrop-filter: blur(12px);
        }

        .empty-card {
          text-align: center;
          color: #64748b;
        }

        .trip-card {
          position: relative;
          overflow: hidden;
          animation: fadeUp 0.4s ease both;
        }

        .trip-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,0.08), transparent 22%),
            linear-gradient(180deg, rgba(255,255,255,0.02), transparent 70%);
          pointer-events: none;
        }

        .trip-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
          position: relative;
          z-index: 1;
        }

        .trip-route {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.25;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }

        .trip-subline {
          font-size: 14px;
          color: #64748b;
          line-height: 1.45;
        }

        .trip-time-badge {
          min-width: 78px;
          text-align: right;
          font-size: 22px;
          font-weight: 900;
          color: #1d4ed8;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .trip-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
        }

        .trip-stat {
          background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
          border-radius: 18px;
          padding: 13px 12px;
          border: 1px solid rgba(226, 232, 240, 0.85);
        }

        .trip-stat-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 5px;
        }

        .trip-stat-value {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }

        .trip-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .price-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .price-value {
          font-size: 26px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .trip-cta-btn {
          min-width: 158px;
          height: 48px;
          padding: 0 18px;
          border-radius: 16px;
          background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
        }

        .driver-btn {
          width: 100%;
          height: 48px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(180deg, #325f91 0%, #274b73 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(39, 75, 115, 0.26);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .driver-btn:active {
          transform: scale(0.985);
        }

        .progress-wrap {
          position: relative;
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          overflow: hidden;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.15);
        }

        .progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
          transition: width 0.9s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative;
        }

        .progress-fill::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: -30%;
          width: 30%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: shimmer 2.8s infinite linear;
        }

        .progress-thumb {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #60a5fa;
          border: 3px solid #ffffff;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.42);
          transition: left 0.9s cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(500%);
          }
        }
      `}</style>

      <div className="page-shell">
        <div className="app-container">
          <div className="glass-top section-fade">
            <div className="top-row">
              <div>
                <div className="welcome-kicker">Добро пожаловать</div>
                <h1 className="welcome-title">{user?.name || "Пользователь"}</h1>
                <div className="welcome-subline">
                  Бронируйте поездки быстро и без лишних действий
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenProfile}
                className="profile-btn"
              >
                ✦
              </button>
            </div>
          </div>

          {!bookingsLoading && bookingCards.length > 0 && (
            <div className="section-fade" style={{ marginBottom: "18px" }}>
              <div className="horizontal-scroll">
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
                      className="booking-card"
                    >
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
                          <div className="booking-pill">Моя бронь</div>

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
                                color: "#e5e7eb",
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
                              fontSize: "19px",
                              fontWeight: "800",
                              lineHeight: "1.3",
                              color: "#ffffff",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {trip.from_city} → {trip.to_city}
                          </div>

                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: "800",
                              color: "#ffffff",
                              whiteSpace: "nowrap",
                              opacity: 0.9,
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
                              color: "#ffffff",
                            }}
                          >
                            {booking.passengers_count}{" "}
                            {getPassengerWord(booking.passengers_count)}
                          </div>

                          <div
                            style={{
                              fontSize: "14px",
                              color: "#cbd5e1",
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
                              marginBottom: "12px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  color: "#cbd5e1",
                                  marginBottom: "4px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                Отправка
                              </div>
                              <div
                                style={{
                                  fontSize: "19px",
                                  fontWeight: "900",
                                  color: "#ffffff",
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
                                  color: "#cbd5e1",
                                  marginBottom: "4px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                Прибытие
                              </div>
                              <div
                                style={{
                                  fontSize: "19px",
                                  fontWeight: "900",
                                  color: "#ffffff",
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
                              className="driver-btn"
                            >
                              Связаться с водителем
                            </button>
                          ) : (
                            <div className="progress-wrap">
                              <div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                              />
                              <div
                                className="progress-thumb"
                                style={{
                                  left:
                                    progress <= 2
                                      ? "0px"
                                      : progress >= 98
                                      ? "calc(100% - 18px)"
                                      : `calc(${progress}% - 9px)`,
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
                  <Link href="/bookings" className="booking-card-light">
                    <div>
                      <div
                        style={{
                          width: "54px",
                          height: "54px",
                          borderRadius: "18px",
                          background:
                            "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "22px",
                          marginBottom: "18px",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                        }}
                      >
                        ≡
                      </div>

                      <div
                        style={{
                          fontSize: "20px",
                          fontWeight: "800",
                          lineHeight: "1.3",
                          marginBottom: "10px",
                          color: "#0f172a",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Посмотреть все бронирования
                      </div>

                      <div
                        style={{
                          fontSize: "14px",
                          color: "#64748b",
                          lineHeight: "1.5",
                        }}
                      >
                        Откройте полный список поездок и детали по каждой броне
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "18px",
                        fontSize: "14px",
                        fontWeight: "800",
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

          <div className="filters-row section-fade">
            <select
              value={appliedRoute}
              onChange={(e) => handleRouteChange(e.target.value)}
              className="premium-select"
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
              className="filter-toggle-btn"
            >
              ☰
            </button>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div>
                <label className="panel-label">Дата</label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="premium-input"
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label className="panel-label">С</label>
                  <input
                    type="time"
                    value={draftTimeFrom}
                    onChange={(e) => setDraftTimeFrom(e.target.value)}
                    className="premium-input"
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label className="panel-label">До</label>
                  <input
                    type="time"
                    value={draftTimeTo}
                    onChange={(e) => setDraftTimeTo(e.target.value)}
                    className="premium-input"
                  />
                </div>
              </div>

              <div>
                <label className="panel-label">Свободных мест от</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Например: 2"
                  value={draftMinSeats}
                  onChange={(e) => setDraftMinSeats(e.target.value)}
                  className="premium-input"
                />
              </div>

              <button type="button" onClick={handleSaveFilters} className="primary-btn">
                Сохранить фильтры
              </button>

              <button type="button" onClick={handleResetFilters} className="secondary-btn">
                Сбросить фильтры
              </button>
            </div>
          )}

          {shouldAutoShowTomorrow && (
            <div className="info-banner section-fade">
              На сегодня доступных поездок больше нет. Показаны рейсы на завтра —{" "}
              {formatDateRu(displayedTripsDate)}.
            </div>
          )}

          <div className="cards-list">
            {loading ? (
              <div className="empty-card">Загрузка поездок...</div>
            ) : filteredTrips.length === 0 ? (
              <div className="empty-card">Нет поездок по выбранным параметрам</div>
            ) : (
              filteredTrips.map((trip) => {
                const departureTime = normalizeTime(trip.departure_time);
                const duration = trip.travel_duration || "~9 ч";
                const freeSeats = Number(
                  freeSeatsMap[trip.id] ?? trip.seats_total ?? 15
                );

                return (
                  <div key={trip.id} className="trip-card">
                    <div className="trip-head">
                      <div>
                        <div className="trip-route">
                          {trip.from_city} → {trip.to_city}
                        </div>

                        <div className="trip-subline">
                          Отправление: {formatDateRu(trip.trip_date)} в {departureTime}
                        </div>
                      </div>

                      <div className="trip-time-badge">{departureTime}</div>
                    </div>

                    <div className="trip-stats-grid">
                      <div className="trip-stat">
                        <div className="trip-stat-label">Время в дороге</div>
                        <div className="trip-stat-value">{duration}</div>
                      </div>

                      <div className="trip-stat">
                        <div className="trip-stat-label">Свободных мест</div>
                        <div className="trip-stat-value">{freeSeats}</div>
                      </div>
                    </div>

                    <div className="trip-bottom">
                      <div>
                        <div className="price-label">Стоимость</div>
                        <div className="price-value">{trip.price} ₽</div>
                      </div>

                      <Link href={`/trip/${trip.id}`} className="trip-cta-btn">
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
    </>
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
      dotColor: "#a78bfa",
      dotGlow: "rgba(167,139,250,0.25)",
    };
  }

  if (booking.status === "confirmed" && start && now < start) {
    return {
      kind: "upcoming",
      label: "Ожидает отправления",
      dotColor: "#2563eb",
      dotGlow: "rgba(37,99,235,0.25)",
    };
  }

  if (start && end && now >= start && now < end) {
    return {
      kind: "in_progress",
      label: "В пути",
      dotColor: "#22c55e",
      dotGlow: "rgba(34,197,94,0.25)",
    };
  }

  return {
    kind: "created",
    label:
      booking.status === "confirmed" ? "Ожидает отправления" : "Бронь создана",
    dotColor: "#2563eb",
    dotGlow: "rgba(37,99,235,0.25)",
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
