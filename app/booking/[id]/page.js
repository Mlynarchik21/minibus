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
  const [bookingUser, setBookingUser] = useState(null);

  const [tripOptions, setTripOptions] = useState([]);
  const [freeSeatsMap, setFreeSeatsMap] = useState({});

  const [editMode, setEditMode] = useState(false);

  const [selectedTripDate, setSelectedTripDate] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");

  const [passengersCount, setPassengersCount] = useState("1");
  const [bookingForOther, setBookingForOther] = useState(false);

  const [contactName, setContactName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [driverMessage, setDriverMessage] = useState("");

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

      let userData = null;

      if (bookingData.user_id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("id, telegram_id, name, phone, phone_secondary")
          .eq("id", bookingData.user_id)
          .maybeSingle();

        userData = userRow || null;
      }

      setBooking(bookingData);
      setTrip(tripData);
      setBookingUser(userData);

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
      setSecondaryPhone("");
    } else {
      setContactName(bookingData.contact_name || "");
      setPrimaryPhone(bookingData.contact_phone || "");
      setSecondaryPhone(bookingData.contact_phone_secondary || "");
      setGuestName("");
      setGuestPhone("");
    }

    setPickupPoint(bookingData.pickup_point || "");
    setDropoffPoint(bookingData.dropoff_point || "");
    setDriverMessage(bookingData.driver_message || "");
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

  const durationLabel = formatTravelDurationCompact(travelDuration);

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

  const confirmWindowStart = useMemo(() => {
    if (!departureDateTime) return null;
    return new Date(
      departureDateTime.getTime() -
        CONFIRM_BEFORE_DEPARTURE_MINUTES * 60 * 1000
    );
  }, [departureDateTime]);

  const isDepartureConfirmed = Boolean(booking?.departure_confirmed);

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
        contact_phone_secondary: bookingForOther
          ? null
          : secondaryPhone.trim() || null,
        pickup_point: pickupPoint,
        dropoff_point: dropoffPoint,
        driver_message: driverMessage.trim() || null,
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

  const statusLabel = getBookingStatusLabel(booking?.status);
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
        <div
          style={{
            padding: "4px 2px 2px",
          }}
        >
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
              alignItems: "start",
              gap: "10px",
              marginBottom: "2px",
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
                width: "150px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <RouteArc durationLabel={durationLabel} />
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "4px",
              marginTop: "-10px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "4px",
                  fontWeight: "600",
                }}
              >
                Отправление
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
                {departureTime}
              </div>
            </div>

            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "4px",
                  fontWeight: "600",
                }}
              >
                Прибытие
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
                {arrivalTime}
              </div>
            </div>
          </div>
        </div>

        {shouldShowConfirmPrompt && (
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>Подтверждение поездки</div>

            <InfoNote
              text={`Ваш рейс скоро отправляется. Пожалуйста, подтвердите, что поездка актуальна.`}
            />

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
                backgroundColor:
                  booking.status === "cancelled"
                    ? "#fee2e2"
                    : isDepartureConfirmed
                      ? "#dcfce7"
                      : "#dbeafe",
                color:
                  booking.status === "cancelled"
                    ? "#991b1b"
                    : isDepartureConfirmed
                      ? "#166534"
                      : "#1d4ed8",
              }}
            >
              {booking.status === "cancelled"
                ? statusLabel
                : isDepartureConfirmed
                  ? "Подтверждена поездка"
                  : statusLabel}
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

                  <div>
                    <div style={labelStyle}>Дополнительный номер телефона</div>
                    <FieldRow icon={<PhoneIcon />}>
                      <input
                        type="tel"
                        value={secondaryPhone}
                        onChange={(e) => setSecondaryPhone(e.target.value)}
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

              <div>
                <div style={labelStyle}>Сообщение водителю</div>
                <div style={textareaWrapStyle}>
                  <textarea
                    value={driverMessage}
                    onChange={(e) => setDriverMessage(e.target.value)}
                    placeholder="Комментарий по поездке"
                    style={textareaInnerStyle}
                  />
                </div>
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

function RouteArc({ durationLabel }) {
  return (
    <svg
      width="150"
      height="92"
      viewBox="0 0 150 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d="M14 70 C 36 10, 114 10, 136 70"
        stroke="#111827"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 5"
      />

      <circle cx="14" cy="70" r="7" fill="#111827" />
      <circle cx="136" cy="70" r="7" fill="#111827" />

      <text
        x="75"
        y="48"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill="#111827"
      >
        {getDurationTopLine(durationLabel)}
      </text>
      <text
        x="75"
        y="63"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#111827"
      >
        в пути
      </text>
    </svg>
  );
}

function PageWrap({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fb",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "520px", margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function StatusCard({ title, text, action }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "24px",
        padding: "24px",
        boxShadow: "0 14px 30px rgba(17,24,39,0.07)",
        border: "1px solid #e8edf6",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "24px",
          fontWeight: "800",
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#6b7280",
          lineHeight: "1.5",
          marginBottom: action ? "18px" : 0,
        }}
      >
        {text}
      </div>

      {action}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: "#f4f6fa",
        border: "1px solid #e8edf5",
        borderRadius: "16px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "4px",
          fontWeight: "700",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "15px",
          fontWeight: "700",
          color: "#111827",
          lineHeight: "1.35",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DetailsRow({ icon, label, value, withoutBorder = false }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "14px 0",
        borderBottom: withoutBorder ? "none" : "1px solid #e8edf5",
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          flexShrink: 0,
          color: "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "2px",
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            color: "#6b7280",
            marginBottom: "4px",
            fontWeight: "700",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "15px",
            fontWeight: "700",
            color: "#111827",
            lineHeight: "1.4",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ icon, rightIcon = null, children }) {
  return (
    <div
      style={{
        minHeight: "54px",
        borderRadius: "16px",
        backgroundColor: "#f4f6fa",
        border: "1px solid #e8edf5",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "0 14px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <div
        style={{
          width: "18px",
          height: "18px",
          flexShrink: 0,
          color: "#111827",
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
          overflow: "hidden",
        }}
      >
        {children}
      </div>

      {rightIcon ? (
        <div
          style={{
            width: "16px",
            height: "16px",
            flexShrink: 0,
            color: "#7c8798",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {rightIcon}
        </div>
      ) : null}
    </div>
  );
}

function RouteInfoBox({ icon, title, value }) {
  return (
    <div
      style={{
        borderRadius: "16px",
        backgroundColor: "#f4f6fa",
        border: "1px solid #e8edf5",
        padding: "14px",
        display: "flex",
        gap: "12px",
        alignItems: title ? "flex-start" : "center",
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          flexShrink: 0,
          color: "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: title ? "2px" : 0,
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>
        {title ? (
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              marginBottom: "4px",
              fontWeight: "700",
            }}
          >
            {title}
          </div>
        ) : null}

        <div
          style={{
            fontSize: "15px",
            fontWeight: "700",
            color: "#111827",
            lineHeight: "1.35",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function InfoNote({ text }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "14px",
        backgroundColor: "#f4f6fa",
        border: "1px solid #e8edf5",
        color: "#475569",
        fontSize: "14px",
        fontWeight: "600",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path
        d="M7.5 4.8h2.1c.4 0 .7.3.8.7l.8 3.1c.1.3 0 .6-.2.8l-1.4 1.4a13 13 0 0 0 3.8 3.8l1.4-1.4c.2-.2.5-.3.8-.2l3.1.8c.4.1.7.4.7.8v2.1c0 .5-.4.9-.9 1-6 .6-12.1-5.5-11.5-11.5.1-.5.5-.9 1-.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
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

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path
        d="M6.4 9.2 8 6.6c.3-.5.8-.8 1.4-.8h5.2c.6 0 1.1.3 1.4.8l1.6 2.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5.2 17.4h13.6a1 1 0 0 0 1-1v-4.2c0-1.5-1.2-2.7-2.7-2.7H7.9c-1.5 0-2.7 1.2-2.7 2.7v4.2a1 1 0 0 0 1 1Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="8.1" cy="14.1" r="1.1" fill="currentColor" />
      <circle cx="15.9" cy="14.1" r="1.1" fill="currentColor" />
      <path
        d="M7.2 17.5v1.5M16.8 17.5v1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 8v4l2.8 1.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <rect
        x="4"
        y="6"
        width="16"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M8 4v4M16 4v4M4 10h16"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <path
        d="M7.8 16.2C10.2 13.8 13.8 10.2 16.2 7.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeDasharray="1 4"
      />
    </svg>
  );
}

function getRoutePoints(fromCity, toCity) {
  if (fromCity === "Санкт-Петербург" && toCity === "Москва") {
    return {
      pickup: {
        main: "м. Московская",
        additional: [
          "Московский вокзал / пл. Восстания",
          "м. Купчино",
          "м. Звёздная",
          "КАД / южный выезд",
        ],
      },
      dropoff: {
        main: "м. Ховрино",
        additional: [
          "м. Речной вокзал",
          "м. Комсомольская",
          "МКАД / северный въезд",
        ],
      },
    };
  }

  return {
    pickup: {
      main: "м. Ховрино",
      additional: [
        "м. Речной вокзал",
        "м. Комсомольская",
        "МКАД / северный въезд",
      ],
    },
    dropoff: {
      main: "м. Московская",
      additional: [
        "Московский вокзал / пл. Восстания",
        "м. Купчино",
        "м. Звёздная",
        "КАД / южный выезд",
      ],
    },
  };
}

function getTelegramUserId() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(timeString) {
  return String(timeString || "").slice(0, 5);
}

function formatDateRu(dateString) {
  if (!dateString) return "";
  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return String(dateString);
  return `${day}.${month}.${year}`;
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
    return `${hours} часов`;
  }

  return `${hours} ч ${mins} м`;
}

function getArrivalTime(dateString, timeString, travelDuration) {
  if (!dateString || !timeString) return "--:--";

  const start = new Date(`${dateString}T${normalizeTime(timeString)}:00`);
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

function getBookingStatusLabel(status) {
  if (status === "confirmed") return "Подтверждена";
  if (status === "cancelled") return "Отменена";
  if (status === "rejected") return "Отклонена";
  return "Создана";
}

function getCityCode(city) {
  const value = String(city || "").toLowerCase().trim();

  if (value.includes("моск")) return "MSK";
  if (value.includes("санкт") || value.includes("петер")) return "SPB";

  return String(city || "").slice(0, 3).toUpperCase();
}

function getDurationTopLine(label) {
  const text = String(label || "").trim();

  if (text.includes("часов")) {
    return text;
  }

  if (text.includes("ч")) {
    return text.replace(" ч", " часов");
  }

  return `${text} часов`;
}

const cardStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "30px",
  padding: "20px 16px 18px",
  border: "1px solid #e8edf6",
  boxShadow: "0 14px 30px rgba(17,24,39,0.06)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const sectionHeaderStyle = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#111827",
};

const statusBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "32px",
  padding: "0 12px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "700",
};

const labelStyle = {
  display: "block",
  fontSize: "14px",
  color: "#111827",
  marginBottom: "6px",
  fontWeight: "700",
  lineHeight: 1.35,
};

const labelHintStyle = {
  fontSize: "13px",
  color: "#6b7280",
  fontWeight: "700",
};

const dividerStyle = {
  height: "1px",
  backgroundColor: "#e6ecf4",
};

const fieldNativeInputStyle = {
  width: "100%",
  height: "100%",
  minHeight: "52px",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontSize: "15px",
  fontWeight: "600",
  color: "#394150",
  padding: "0",
  margin: "0",
  boxSizing: "border-box",
};

const fieldNativeSelectStyle = {
  width: "100%",
  height: "100%",
  minHeight: "52px",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontSize: "15px",
  fontWeight: "700",
  color: "#111827",
  padding: "0",
  margin: "0",
  boxSizing: "border-box",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const textareaWrapStyle = {
  borderRadius: "16px",
  backgroundColor: "#f4f6fa",
  border: "1px solid #e8edf5",
  padding: "12px 14px",
};

const textareaInnerStyle = {
  width: "100%",
  minHeight: "110px",
  border: "none",
  outline: "none",
  resize: "vertical",
  backgroundColor: "transparent",
  fontSize: "15px",
  fontWeight: "600",
  color: "#394150",
  padding: 0,
  margin: 0,
  boxSizing: "border-box",
};

const topBackLinkStyle = {
  width: "42px",
  height: "42px",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  fontSize: "22px",
  fontWeight: "800",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #e8edf6",
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
};

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "46px",
  padding: "0 18px",
  borderRadius: "14px",
  backgroundColor: "#111827",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "700",
};

const primaryButtonStyle = {
  width: "100%",
  height: "58px",
  border: "none",
  borderRadius: "20px",
  backgroundColor: "#10206C",
  color: "#ffffff",
  fontSize: "17px",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(16,32,108,0.18)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const secondaryButtonStyle = {
  width: "100%",
  height: "54px",
  border: "1px solid #d7deea",
  borderRadius: "18px",
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
};

const dangerButtonStyle = {
  width: "100%",
  height: "54px",
  border: "none",
  borderRadius: "18px",
  backgroundColor: "#991b1b",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(127,29,29,0.16)",
};

const greenButtonStyle = {
  width: "100%",
  height: "54px",
  border: "none",
  borderRadius: "18px",
  background: "linear-gradient(135deg, #2f6f57 0%, #1f8b66 100%)",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(47,111,87,0.18)",
};
