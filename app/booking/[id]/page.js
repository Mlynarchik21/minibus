"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const ACTIVE_BOOKING_STATUSES = ["new", "confirmed"];
const CONFIRM_BEFORE_DEPARTURE_MINUTES = 60;

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId = params?.id;
  const action = searchParams?.get("action");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingTrip, setConfirmingTrip] = useState(false);

  const [booking, setBooking] = useState(null);
  const [trip, setTrip] = useState(null);

  const [tripOptions, setTripOptions] = useState([]);
  const [freeSeatsMap, setFreeSeatsMap] = useState({});

  const [editMode, setEditMode] = useState(false);

  const [selectedTripDate, setSelectedTripDate] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");

  const [passengersCount, setPassengersCount] = useState("1");
  const [bookingForOther, setBookingForOther] = useState(false);

  const [contactName, setContactName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");

  useEffect(() => {
    if (action === "edit") {
      setEditMode(true);
    }
  }, [action]);

  useEffect(() => {
    if (bookingId) {
      loadBookingPage();
    }
  }, [bookingId]);

  async function loadBookingPage() {
    try {
      setLoading(true);

      const telegramId = getTelegramUserId();

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (bookingError || !bookingData) {
        console.error("Ошибка загрузки booking:", bookingError);
        setBooking(null);
        setTrip(null);
        return;
      }

      if (
        telegramId &&
        bookingData.telegram_id &&
        String(bookingData.telegram_id) !== String(telegramId)
      ) {
        console.error("Попытка открыть чужую бронь");
        setBooking(null);
        setTrip(null);
        return;
      }

      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", bookingData.trip_id)
        .single();

      if (tripError || !tripData) {
        console.error("Ошибка загрузки trip:", tripError);
        setBooking(null);
        setTrip(null);
        return;
      }

      setBooking(bookingData);
      setTrip(tripData);

      fillFormFromBooking(bookingData, tripData);
      await loadRouteTripsAndSeats(bookingData, tripData);
    } catch (error) {
      console.error("Ошибка страницы booking:", error);
      setBooking(null);
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }

  function fillFormFromBooking(bookingData, tripData) {
    setSelectedTripDate(tripData.trip_date || "");
    setSelectedTripId(tripData.id || "");

    setPassengersCount(String(bookingData.passengers_count || 1));
    setBookingForOther(Boolean(bookingData.booking_for_other));

    if (bookingData.booking_for_other) {
      setGuestName(bookingData.contact_name || "");
      setGuestPhone(bookingData.contact_phone || "");
      setContactName("");
      setPrimaryPhone("");
    } else {
      setContactName(bookingData.contact_name || "");
      setPrimaryPhone(bookingData.contact_phone || "");
      setGuestName("");
      setGuestPhone("");
    }

    setPickupPoint(bookingData.pickup_point || "");
    setDropoffPoint(bookingData.dropoff_point || "");
  }

  async function loadRouteTripsAndSeats(bookingData, tripData) {
    const { data: routeTrips, error: routeTripsError } = await supabase
      .from("trips")
      .select("*")
      .eq("status", "active")
      .eq("from_city", tripData.from_city)
      .eq("to_city", tripData.to_city)
      .order("trip_date", { ascending: true })
      .order("departure_time", { ascending: true });

    if (routeTripsError) {
      console.error("Ошибка загрузки доступных рейсов:", routeTripsError);
      setTripOptions([]);
      setFreeSeatsMap({});
      return;
    }

    const tripsList = routeTrips || [];
    setTripOptions(tripsList);

    if (tripsList.length === 0) {
      setFreeSeatsMap({});
      return;
    }

    const tripIds = tripsList.map((item) => item.id);

    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, trip_id, passengers_count, status")
      .in("trip_id", tripIds)
      .in("status", ACTIVE_BOOKING_STATUSES);

    if (bookingsError) {
      console.error("Ошибка загрузки бронирований рейсов:", bookingsError);
      setFreeSeatsMap({});
      return;
    }

    const bookedByTrip = {};

    for (const row of bookingsData || []) {
      const current = bookedByTrip[row.trip_id] || 0;
      bookedByTrip[row.trip_id] = current + Number(row.passengers_count || 0);
    }

    const calculatedFreeSeats = {};

    for (const item of tripsList) {
      const totalSeats = Number(item.seats_total || 15);
      let bookedSeats = Number(bookedByTrip[item.id] || 0);

      if (String(item.id) === String(bookingData.trip_id)) {
        bookedSeats = Math.max(
          bookedSeats - Number(bookingData.passengers_count || 0),
          0
        );
      }

      calculatedFreeSeats[item.id] = Math.max(totalSeats - bookedSeats, 0);
    }

    setFreeSeatsMap(calculatedFreeSeats);
  }

  const selectedTrip = useMemo(() => {
    return (
      tripOptions.find((item) => String(item.id) === String(selectedTripId)) ||
      trip ||
      null
    );
  }, [tripOptions, selectedTripId, trip]);

  const dateOptions = useMemo(() => {
    const unique = new Map();

    for (const item of tripOptions) {
      if (!unique.has(item.trip_date)) {
        unique.set(item.trip_date, item.trip_date);
      }
    }

    return Array.from(unique.values());
  }, [tripOptions]);

  const timeOptions = useMemo(() => {
    return tripOptions.filter((item) => item.trip_date === selectedTripDate);
  }, [tripOptions, selectedTripDate]);

  const availableSeatsForSelectedTrip = Number(
    freeSeatsMap[selectedTrip?.id] ?? selectedTrip?.seats_total ?? 15
  );

  const passengerOptions = Array.from(
    { length: Math.max(availableSeatsForSelectedTrip, 0) },
    (_, index) => index + 1
  );

  const points = useMemo(() => {
    if (!selectedTrip && !trip) return null;
    const baseTrip = selectedTrip || trip;
    return getRoutePoints(baseTrip.from_city, baseTrip.to_city);
  }, [selectedTrip, trip]);

  const routeName = selectedTrip
    ? `${selectedTrip.from_city} → ${selectedTrip.to_city}`
    : trip
      ? `${trip.from_city} → ${trip.to_city}`
      : "";

  const departureTime = normalizeTime(
    selectedTrip?.departure_time || trip?.departure_time
  );

  const travelDuration =
    selectedTrip?.travel_duration || trip?.travel_duration || "~9 ч";

  const arrivalTime = getArrivalTime(
    selectedTrip?.trip_date || trip?.trip_date,
    selectedTrip?.departure_time || trip?.departure_time,
    selectedTrip?.travel_duration || trip?.travel_duration
  );

  const isDepartureDay =
    (selectedTrip?.trip_date || trip?.trip_date) === getTodayString();

  const driverName = isDepartureDay
    ? selectedTrip?.driver_name ||
      trip?.driver_name ||
      "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehicleModel = isDepartureDay
    ? selectedTrip?.vehicle_model ||
      trip?.vehicle_model ||
      "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehiclePlate = isDepartureDay
    ? selectedTrip?.vehicle_plate ||
      trip?.vehicle_plate ||
      "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const departureDateTime = useMemo(() => {
    const dateValue = selectedTrip?.trip_date || trip?.trip_date;
    const timeValue = selectedTrip?.departure_time || trip?.departure_time;

    if (!dateValue || !timeValue) return null;
    return new Date(`${dateValue}T${normalizeTime(timeValue)}:00`);
  }, [
    selectedTrip?.trip_date,
    selectedTrip?.departure_time,
    trip?.trip_date,
    trip?.departure_time,
  ]);

  const arrivalDateTime = useMemo(() => {
    if (!departureDateTime) return null;
    const durationMinutes = parseTravelDurationMinutes(
      selectedTrip?.travel_duration || trip?.travel_duration
    );
    return new Date(departureDateTime.getTime() + durationMinutes * 60 * 1000);
  }, [departureDateTime, selectedTrip?.travel_duration, trip?.travel_duration]);

  const confirmWindowStart = useMemo(() => {
    if (!departureDateTime) return null;
    return new Date(
      departureDateTime.getTime() -
        CONFIRM_BEFORE_DEPARTURE_MINUTES * 60 * 1000
    );
  }, [departureDateTime]);

  const isDepartureConfirmed = Boolean(booking?.departure_confirmed);

  const liveTripStatus = useMemo(() => {
    const now = new Date();

    if (booking?.status === "cancelled") return "cancelled";
    if (!departureDateTime || !arrivalDateTime) return "created";
    if (now < departureDateTime) return "created";
    if (now >= departureDateTime && now < arrivalDateTime) return "in_progress";
    return "completed";
  }, [booking?.status, departureDateTime, arrivalDateTime]);

  const canConfirmTrip = useMemo(() => {
    if (!booking || !departureDateTime || !confirmWindowStart) return false;
    if (booking.status === "cancelled") return false;
    if (isDepartureConfirmed) return false;

    const now = new Date();
    return now >= confirmWindowStart && now < departureDateTime;
  }, [booking, departureDateTime, confirmWindowStart, isDepartureConfirmed]);

  const shouldShowConfirmPrompt =
    action === "confirm" &&
    booking?.status !== "cancelled" &&
    !isDepartureConfirmed;

  const progress = useMemo(() => {
    return getTripProgressPercent(
      selectedTrip?.trip_date || trip?.trip_date,
      selectedTrip?.departure_time || trip?.departure_time,
      selectedTrip?.travel_duration || trip?.travel_duration
    );
  }, [
    selectedTrip?.trip_date,
    selectedTrip?.departure_time,
    selectedTrip?.travel_duration,
    trip?.trip_date,
    trip?.departure_time,
    trip?.travel_duration,
  ]);

  const headerMeta = useMemo(() => {
    return getTripHeaderMeta(
      selectedTrip?.trip_date || trip?.trip_date,
      selectedTrip?.departure_time || trip?.departure_time,
      selectedTrip?.travel_duration || trip?.travel_duration
    );
  }, [
    selectedTrip?.trip_date,
    selectedTrip?.departure_time,
    selectedTrip?.travel_duration,
    trip?.trip_date,
    trip?.departure_time,
    trip?.travel_duration,
  ]);

  const bookingInfoStatus = useMemo(() => {
    if (booking?.status === "cancelled") {
      return {
        label: "Отменена",
        bg: "#fee2e2",
        color: "#991b1b",
      };
    }

    if (liveTripStatus === "in_progress") {
      return {
        label: "В пути",
        bg: "#dcfce7",
        color: "#166534",
      };
    }

    if (liveTripStatus === "completed") {
      return {
        label: "Завершена",
        bg: "#f3f4f6",
        color: "#374151",
      };
    }

    if (isDepartureConfirmed) {
      return {
        label: "Подтверждена поездка",
        bg: "#dcfce7",
        color: "#166534",
      };
    }

    if (booking?.status === "confirmed") {
      return {
        label: "Подтверждена",
        bg: "#dbeafe",
        color: "#1d4ed8",
      };
    }

    return {
      label: "Создана",
      bg: "#dbeafe",
      color: "#1d4ed8",
    };
  }, [booking?.status, isDepartureConfirmed, liveTripStatus]);

  useEffect(() => {
    if (!selectedTripDate || !timeOptions.length) return;

    const hasSelectedTrip = timeOptions.some(
      (item) => String(item.id) === String(selectedTripId)
    );

    if (!hasSelectedTrip) {
      setSelectedTripId(String(timeOptions[0].id));
    }
  }, [selectedTripDate, timeOptions, selectedTripId]);

  useEffect(() => {
    if (
      availableSeatsForSelectedTrip > 0 &&
      Number(passengersCount) > availableSeatsForSelectedTrip
    ) {
      setPassengersCount(String(availableSeatsForSelectedTrip));
    }
  }, [availableSeatsForSelectedTrip, passengersCount]);

  async function handleSaveChanges() {
    if (!booking || !selectedTrip) return;

    if (booking.status === "cancelled") {
      alert("Эта бронь уже отменена");
      return;
    }

    if (!pickupPoint) {
      alert("Выберите точку посадки");
      return;
    }

    if (!dropoffPoint) {
      alert("Выберите точку высадки");
      return;
    }

    if (!bookingForOther) {
      if (!contactName.trim() || !primaryPhone.trim()) {
        alert("Заполните имя и основной номер телефона");
        return;
      }
    }

    if (bookingForOther) {
      if (!guestName.trim() || !guestPhone.trim()) {
        alert("Заполните имя и телефон пассажира");
        return;
      }
    }

    const seatsToBook = Number(passengersCount);

    if (seatsToBook < 1) {
      alert("Некорректное количество пассажиров");
      return;
    }

    try {
      setSaving(true);

      const freshAvailableSeats = await getFreshAvailableSeatsForTrip(
        selectedTrip.id,
        booking.id,
        booking.trip_id,
        booking.passengers_count,
        selectedTrip.seats_total
      );

      if (seatsToBook > freshAvailableSeats) {
        alert("На выбранный рейс уже не хватает мест. Обновите параметры.");
        await loadRouteTripsAndSeats(booking, trip);
        return;
      }

      const resolvedContactName = bookingForOther
        ? guestName.trim()
        : contactName.trim();

      const updatePayload = {
        trip_id: selectedTrip.id,
        passengers_count: seatsToBook,
        booking_for_other: bookingForOther,
        contact_name: resolvedContactName,
        contact_phone: bookingForOther
          ? guestPhone.trim()
          : primaryPhone.trim(),
        contact_phone_secondary: null,
        pickup_point: pickupPoint,
        dropoff_point: dropoffPoint,
        driver_message: null,
      };

      const { data: updatedBooking, error: updateError } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", booking.id)
        .select("*")
        .single();

      if (updateError || !updatedBooking) {
        console.error("Ошибка обновления брони:", updateError);
        alert("Не удалось сохранить изменения");
        return;
      }

      setBooking(updatedBooking);
      setTrip(selectedTrip);
      setEditMode(false);

      await loadRouteTripsAndSeats(updatedBooking, selectedTrip);

      try {
        if (updatedBooking.telegram_id) {
          await fetch("/api/send-booking-updated-notification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              telegramId: updatedBooking.telegram_id,
              bookingId: updatedBooking.id,
              routeName: `${selectedTrip.from_city} → ${selectedTrip.to_city}`,
              tripDate: selectedTrip.trip_date,
              departureTime: normalizeTime(selectedTrip.departure_time),
              travelDuration: selectedTrip.travel_duration || "~9 ч",
              passengersCount: updatedBooking.passengers_count,
              pickupPoint: updatedBooking.pickup_point,
              dropoffPoint: updatedBooking.dropoff_point,
              contactName: updatedBooking.contact_name,
            }),
          });
        }
      } catch (notificationError) {
        console.error(
          "Ошибка отправки уведомления об изменении:",
          notificationError
        );
      }

      alert("Изменения сохранены");
    } catch (error) {
      console.error("Ошибка сохранения изменений:", error);
      alert("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

  async function getFreshAvailableSeatsForTrip(
    tripId,
    currentBookingId,
    originalTripId,
    originalPassengersCount,
    seatsTotal
  ) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, trip_id, passengers_count, status")
      .eq("trip_id", tripId)
      .in("status", ACTIVE_BOOKING_STATUSES);

    if (error) {
      console.error("Ошибка проверки доступных мест:", error);
      return 0;
    }

    let bookedSeats = (data || []).reduce((sum, item) => {
      return sum + Number(item.passengers_count || 0);
    }, 0);

    if (String(tripId) === String(originalTripId)) {
      bookedSeats = Math.max(
        bookedSeats - Number(originalPassengersCount || 0),
        0
      );
    }

    return Math.max(Number(seatsTotal || 15) - bookedSeats, 0);
  }

  async function handleConfirmTrip() {
    if (!booking) return;

    if (booking.status === "cancelled") {
      alert("Эта бронь уже отменена");
      return;
    }

    if (isDepartureConfirmed) {
      alert("Поездка уже подтверждена");
      return;
    }

    if (!canConfirmTrip && action !== "confirm") {
      alert("Подтверждение станет доступно за 1 час до отправления");
      return;
    }

    try {
      setConfirmingTrip(true);

      const { data: updatedBooking, error: confirmError } = await supabase
        .from("bookings")
        .update({
          departure_confirmed: true,
          departure_confirmed_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select("*")
        .single();

      if (confirmError || !updatedBooking) {
        console.error("Ошибка подтверждения поездки:", confirmError);
        alert("Не удалось подтвердить поездку");
        return;
      }

      setBooking(updatedBooking);
      alert("Поездка подтверждена");
      router.replace(`/booking/${booking.id}`);
      router.refresh();
    } catch (error) {
      console.error("Ошибка подтверждения поездки:", error);
      alert("Не удалось подтвердить поездку");
    } finally {
      setConfirmingTrip(false);
    }
  }

  async function handleCancelBooking() {
    if (!booking || !trip) return;

    if (booking.status === "cancelled") {
      alert("Эта бронь уже отменена");
      return;
    }

    const confirmed = window.confirm("Точно отменить бронирование?");
    if (!confirmed) return;

    try {
      setCancelling(true);

      const { data: cancelledBooking, error: cancelError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", booking.id)
        .select("*")
        .single();

      if (cancelError || !cancelledBooking) {
        console.error("Ошибка отмены брони:", cancelError);
        alert("Не удалось отменить бронирование");
        return;
      }

      setBooking(cancelledBooking);

      try {
        if (cancelledBooking.telegram_id) {
          await fetch("/api/send-booking-cancel-notification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              telegramId: cancelledBooking.telegram_id,
              bookingId: cancelledBooking.id,
              routeName: `${trip.from_city} → ${trip.to_city}`,
              tripDate: trip.trip_date,
              departureTime: normalizeTime(trip.departure_time),
              passengersCount: cancelledBooking.passengers_count,
            }),
          });
        }
      } catch (notificationError) {
        console.error(
          "Ошибка отправки уведомления об отмене:",
          notificationError
        );
      }

      alert("Бронирование отменено");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Ошибка отмены брони:", error);
      alert("Не удалось отменить бронирование");
    } finally {
      setCancelling(false);
    }
  }

  const shortFrom = getCityCode(selectedTrip?.from_city || trip?.from_city);
  const shortTo = getCityCode(selectedTrip?.to_city || trip?.to_city);

  if (loading) {
    return (
      <PageWrap>
        <StatusCard
          title="Загрузка бронирования..."
          text="Подготавливаем информацию по вашей поездке"
        />
      </PageWrap>
    );
  }

  if (!booking || !trip) {
    return (
      <PageWrap>
        <StatusCard
          title="Бронь не найдена"
          text="Возможно, ссылка устарела или бронь недоступна"
          action={
            <Link href="/" style={backButtonStyle}>
              Вернуться на главную
            </Link>
          }
        />
      </PageWrap>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fb",
        padding: "14px 12px 24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          paddingBottom: "28px",
        }}
      >
        <div style={{ padding: "4px 2px 2px" }}>
          <div
            style={{
              position: "relative",
              minHeight: "42px",
              marginBottom: "18px",
            }}
          >
            <Link href="/" style={topBackLinkStyle}>
              ←
            </Link>

            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                minHeight: "34px",
                padding: "0 16px",
                borderRadius: "999px",
                backgroundColor: "#1b3fb5",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "800",
                textAlign: "center",
                whiteSpace: "nowrap",
                boxShadow: "0 8px 18px rgba(27,63,181,0.18)",
              }}
            >
              {formatDateRu(selectedTrip?.trip_date || trip.trip_date)}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "34px",
                  lineHeight: 1,
                  fontWeight: "900",
                  color: "#111827",
                  letterSpacing: "-0.8px",
                  whiteSpace: "nowrap",
                }}
              >
                {shortFrom}
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                }}
              >
                {selectedTrip?.from_city || trip.from_city}
              </div>
            </div>

            <div
              style={{
                minWidth: "138px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "4px",
                  fontWeight: "600",
                  lineHeight: 1.1,
                }}
              >
                {headerMeta.label}
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "900",
                  lineHeight: 1,
                  color: "#111827",
                  letterSpacing: "-0.6px",
                  whiteSpace: "nowrap",
                }}
              >
                {headerMeta.value}
              </div>
            </div>

            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div
                style={{
                  fontSize: "34px",
                  lineHeight: 1,
                  fontWeight: "900",
                  color: "#111827",
                  letterSpacing: "-0.8px",
                  whiteSpace: "nowrap",
                }}
              >
                {shortTo}
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.2,
                  textAlign: "right",
                  wordBreak: "break-word",
                }}
              >
                {selectedTrip?.to_city || trip.to_city}
              </div>
            </div>
          </div>

          <ProgressHeaderLine progress={progress} />
        </div>

        {shouldShowConfirmPrompt && (
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>Подтверждение поездки</div>

            <InfoNote text="Ваш рейс скоро отправляется. Пожалуйста, подтвердите, что поездка актуальна." />

            <div
              style={{
                marginTop: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <RouteInfoBox
                icon={<RouteIcon />}
                title="Маршрут"
                value={routeName}
              />
              <RouteInfoBox
                icon={<CalendarIcon />}
                title="Дата"
                value={formatDateRu(selectedTrip?.trip_date || trip.trip_date)}
              />
              <RouteInfoBox
                icon={<ClockIcon />}
                title="Отправление"
                value={departureTime}
              />
              <RouteInfoBox
                icon={<UserIcon />}
                title="Пассажиры"
                value={`${booking.passengers_count} ${getPassengerWord(
                  booking.passengers_count
                )}`}
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmTrip}
              disabled={confirmingTrip || isDepartureConfirmed}
              style={{
                ...greenButtonStyle,
                marginTop: "16px",
                opacity: confirmingTrip || isDepartureConfirmed ? 0.72 : 1,
                cursor:
                  confirmingTrip || isDepartureConfirmed ? "default" : "pointer",
              }}
            >
              {isDepartureConfirmed
                ? "Поездка уже подтверждена"
                : confirmingTrip
                  ? "Подтверждение..."
                  : "Подтвердить поездку"}
            </button>
          </div>
        )}

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div style={sectionHeaderStyle}>Информация о брони</div>

            <div
              style={{
                ...statusBadgeStyle,
                backgroundColor: bookingInfoStatus.bg,
                color: bookingInfoStatus.color,
              }}
            >
              {bookingInfoStatus.label}
            </div>
          </div>

          {!isDepartureConfirmed &&
            booking.status !== "cancelled" &&
            !canConfirmTrip &&
            confirmWindowStart &&
            departureDateTime &&
            new Date() < confirmWindowStart && (
              <InfoNote text="Подтверждение станет доступно за 1 час до отправления" />
            )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginTop: "14px",
            }}
          >
            <InfoCard
              label="Дата отправления"
              value={formatDateRu(selectedTrip?.trip_date || trip.trip_date)}
            />
            <InfoCard label="Время отправления" value={departureTime} />
            <InfoCard label="Время в дороге" value={travelDuration} />
            <InfoCard label="Время прибытия" value={arrivalTime} />
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>Пассажиры и контакты</div>

          <DetailsRow
            icon={<UserIcon />}
            label="Количество пассажиров"
            value={`${booking.passengers_count} ${getPassengerWord(
              booking.passengers_count
            )}`}
          />
          <DetailsRow
            icon={<ProfileIcon />}
            label="Имя"
            value={booking.contact_name || "—"}
          />
          <DetailsRow
            icon={<PhoneIcon />}
            label="Основной телефон"
            value={booking.contact_phone || "—"}
            withoutBorder
          />
        </div>

        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>Поездка</div>

          <DetailsRow
            icon={<PinIcon />}
            label="Посадка"
            value={booking.pickup_point || "—"}
          />
          <DetailsRow
            icon={<PinIcon />}
            label="Высадка"
            value={booking.dropoff_point || "—"}
            withoutBorder
          />
        </div>

        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>Информация о маршрутке</div>

          <RouteInfoBox
            icon={<CarIcon />}
            title="Марка машины"
            value={vehicleModel}
          />
          <div style={{ height: "10px" }} />
          <RouteInfoBox
            icon={<CarIcon />}
            title="Номер маршрутки"
            value={vehiclePlate}
          />
          <div style={{ height: "10px" }} />
          <RouteInfoBox
            icon={<ProfileIcon />}
            title="Водитель"
            value={driverName}
          />
        </div>

        {booking.status !== "cancelled" && !editMode && (
          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {canConfirmTrip && !isDepartureConfirmed && (
                <button
                  type="button"
                  onClick={handleConfirmTrip}
                  disabled={confirmingTrip}
                  style={{
                    ...greenButtonStyle,
                    opacity: confirmingTrip ? 0.72 : 1,
                    cursor: confirmingTrip ? "default" : "pointer",
                  }}
                >
                  {confirmingTrip ? "Подтверждение..." : "Подтвердить поездку"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditMode(true)}
                style={primaryButtonStyle}
              >
                Изменить бронь
              </button>

              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={cancelling}
                style={{
                  ...dangerButtonStyle,
                  opacity: cancelling ? 0.72 : 1,
                  cursor: cancelling ? "default" : "pointer",
                }}
              >
                {cancelling ? "Отмена..." : "Отменить бронь"}
              </button>
            </div>
          </div>
        )}

        {booking.status !== "cancelled" && editMode && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveChanges();
            }}
            style={cardStyle}
          >
            <div style={sectionHeaderStyle}>Редактирование брони</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div style={labelStyle}>Дата</div>
                <FieldRow icon={<CalendarIcon />} rightIcon={<ChevronRightIcon />}>
                  <select
                    value={selectedTripDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setSelectedTripDate(nextDate);

                      const firstTripForDate = tripOptions.find(
                        (item) => item.trip_date === nextDate
                      );

                      if (firstTripForDate) {
                        setSelectedTripId(String(firstTripForDate.id));
                      }
                    }}
                    style={fieldNativeSelectStyle}
                  >
                    {dateOptions.map((date) => (
                      <option key={date} value={date}>
                        {formatDateRu(date)}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>

              <div>
                <div style={labelStyle}>Время отправления</div>
                <FieldRow icon={<ClockIcon />} rightIcon={<ChevronRightIcon />}>
                  <select
                    value={selectedTripId}
                    onChange={(e) => setSelectedTripId(e.target.value)}
                    style={fieldNativeSelectStyle}
                  >
                    {timeOptions.map((item) => {
                      const freeSeats = Number(
                        freeSeatsMap[item.id] ?? item.seats_total ?? 15
                      );

                      return (
                        <option key={item.id} value={item.id}>
                          {normalizeTime(item.departure_time)} — мест: {freeSeats}
                        </option>
                      );
                    })}
                  </select>
                </FieldRow>
              </div>

              <div>
                <div style={labelStyle}>
                  Количество пассажиров{" "}
                  <span style={labelHintStyle}>
                    (доступно {availableSeatsForSelectedTrip})
                  </span>
                </div>
                <FieldRow icon={<UserIcon />} rightIcon={<ChevronRightIcon />}>
                  <select
                    value={passengersCount}
                    onChange={(e) => setPassengersCount(e.target.value)}
                    style={fieldNativeSelectStyle}
                  >
                    {passengerOptions.map((count) => (
                      <option key={count} value={String(count)}>
                        {count} {getPassengerWord(count)}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  userSelect: "none",
                  marginTop: "-2px",
                }}
              >
                <input
                  type="checkbox"
                  checked={bookingForOther}
                  onChange={(e) => setBookingForOther(e.target.checked)}
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "#2457F5",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#111827",
                    lineHeight: 1.3,
                  }}
                >
                  Заказать не себе
                </span>
              </label>

              {!bookingForOther ? (
                <>
                  <div>
                    <div style={labelStyle}>Имя для связи</div>
                    <FieldRow icon={<ProfileIcon />}>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Введите имя"
                        style={fieldNativeInputStyle}
                      />
                    </FieldRow>
                  </div>

                  <div>
                    <div style={labelStyle}>Основной номер телефона</div>
                    <FieldRow icon={<PhoneIcon />}>
                      <input
                        type="tel"
                        value={primaryPhone}
                        onChange={(e) => setPrimaryPhone(e.target.value)}
                        placeholder="+7 ..."
                        style={fieldNativeInputStyle}
                      />
                    </FieldRow>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div style={labelStyle}>Имя пассажира</div>
                    <FieldRow icon={<ProfileIcon />}>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="На кого бронируем"
                        style={fieldNativeInputStyle}
                      />
                    </FieldRow>
                  </div>

                  <div>
                    <div style={labelStyle}>Телефон пассажира</div>
                    <FieldRow icon={<PhoneIcon />}>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+7 ..."
                        style={fieldNativeInputStyle}
                      />
                    </FieldRow>
                  </div>
                </>
              )}

              <div style={dividerStyle} />

              <div>
                <div style={labelStyle}>Посадка</div>
                <FieldRow icon={<PinIcon />}>
                  <select
                    value={pickupPoint}
                    onChange={(e) => setPickupPoint(e.target.value)}
                    style={fieldNativeSelectStyle}
                  >
                    <option value="" disabled>
                      Выберите точку посадки
                    </option>

                    <optgroup label="Основная">
                      <option value={points?.pickup?.main || ""}>
                        {points?.pickup?.main}
                      </option>
                    </optgroup>

                    <optgroup label="Дополнительные точки посадки">
                      {(points?.pickup?.additional || []).map((point) => (
                        <option key={point} value={point}>
                          {point}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </FieldRow>
              </div>

              <div>
                <div style={labelStyle}>Высадка</div>
                <FieldRow icon={<PinIcon />}>
                  <select
                    value={dropoffPoint}
                    onChange={(e) => setDropoffPoint(e.target.value)}
                    style={fieldNativeSelectStyle}
                  >
                    <option value="" disabled>
                      Выберите точку высадки
                    </option>

                    <optgroup label="Основная">
                      <option value={points?.dropoff?.main || ""}>
                        {points?.dropoff?.main}
                      </option>
                    </optgroup>

                    <optgroup label="Дополнительные точки высадки">
                      {(points?.dropoff?.additional || []).map((point) => (
                        <option key={point} value={point}>
                          {point}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </FieldRow>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  opacity: saving ? 0.72 : 1,
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>

              <button
                type="button"
                onClick={() => {
                  fillFormFromBooking(booking, trip);
                  setEditMode(false);
                }}
                style={secondaryButtonStyle}
              >
                Отменить изменения
              </button>

              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={cancelling}
                style={{
                  ...dangerButtonStyle,
                  opacity: cancelling ? 0.72 : 1,
                  cursor: cancelling ? "default" : "pointer",
                }}
              >
                {cancelling ? "Отмена..." : "Отменить бронь"}
              </button>
            </div>
          </form>
        )}

        {booking.status === "cancelled" && (
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>Бронь отменена</div>
            <InfoNote text="Эта бронь больше не участвует в активных поездках" />
            <Link href="/" style={{ ...primaryButtonStyle, marginTop: "14px" }}>
              На главную
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressHeaderLine({ progress }) {
  return (
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
          borderTop: "2px dotted rgba(17,24,39,0.85)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: "#111827",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: "#111827",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `calc(${progress}% - 14px)`,
          transform: "translateY(-50%)",
          width: "28px",
          height: "28px",
          borderRadius: "999px",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
          border: "1px solid #e5e7eb",
          zIndex: 1,
          transition: "left 0.8s ease",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#111827",
          }}
        />
      </div>
    </div>
  );
}

function getTripHeaderMeta(dateString, timeString, travelDuration) {
  const start = buildTripDateTime(dateString, timeString);

  if (!start) {
    return {
      label: "Отправление",
      value: "--:--",
    };
  }

  const durationMinutes = parseTravelDurationMinutes(travelDuration);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  if (now < start) {
    return {
      label: "До отправления",
      value: getTimeLeftLabel(start),
    };
  }

  if (now >= start && now < end) {
    return {
      label: "До конца маршрута",
      value: getTimeLeftLabel(end),
    };
  }

  return {
    label: "Маршрут завершён",
    value: "0ч 00м",
  };
}
