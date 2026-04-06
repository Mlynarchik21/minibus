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
  }, [
    booking,
    departureDateTime,
    confirmWindowStart,
    isDepartureConfirmed,
  ]);

  const shouldShowConfirmPrompt =
    action === "confirm" && booking?.status !== "cancelled" && !isDepartureConfirmed;

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

  if (loading) {
    return (
      <PageWrapper>
        <Card centered>Загрузка бронирования...</Card>
      </PageWrapper>
    );
  }

  if (!booking || !trip) {
    return (
      <PageWrapper>
        <Card centered>
          <div style={titleStyle}>Бронь не найдена</div>
          <div style={subtitleStyle}>
            Возможно, ссылка устарела или бронь недоступна
          </div>
          <Link href="/" style={primaryDarkButtonStyle}>
            Вернуться на главную
          </Link>
        </Card>
      </PageWrapper>
    );
  }

  const statusLabel = getBookingStatusLabel(booking.status);

  return (
    <PageWrapper>
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          paddingBottom: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Link href="/" style={backLinkStyle}>
            ← Назад
          </Link>

          <div
            style={{
              fontSize: "14px",
              color: "#6b7280",
              fontWeight: "600",
            }}
          >
            Бронирование
          </div>
        </div>

        {shouldShowConfirmPrompt && (
          <Card>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "800",
                color: "#111827",
                marginBottom: "10px",
              }}
            >
              Подтверждение поездки
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#4b5563",
                lineHeight: "1.6",
                marginBottom: "16px",
              }}
            >
              Ваш рейс скоро отправляется. Пожалуйста, подтвердите, что поездка
              актуальна.
              <br />
              <br />
              Маршрут: <b>{routeName}</b>
              <br />
              Дата: <b>{formatDateRu(selectedTrip?.trip_date || trip.trip_date)}</b>
              <br />
              Отправление: <b>{departureTime}</b>
              <br />
              Пассажиров: <b>{booking.passengers_count}</b>
            </div>

            {isDepartureConfirmed ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#ecfdf3",
                  color: "#166534",
                  fontSize: "14px",
                  fontWeight: "700",
                }}
              >
                Поездка уже подтверждена
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConfirmTrip}
                disabled={confirmingTrip}
                style={{
                  ...confirmButtonStyle,
                  opacity: confirmingTrip ? 0.7 : 1,
                  cursor: confirmingTrip ? "default" : "pointer",
                }}
              >
                {confirmingTrip ? "Подтверждение..." : "Подтвердить поездку"}
              </button>
            )}
          </Card>
        )}

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div style={titleStyle}>Информация о брони</div>

            <div
              style={{
                ...statusBadgeStyle,
                backgroundColor:
                  booking.status === "cancelled" ? "#fee2e2" : "#dbeafe",
                color: booking.status === "cancelled" ? "#991b1b" : "#1d4ed8",
              }}
            >
              {statusLabel}
            </div>
          </div>

          <div
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "8px",
            }}
          >
            {routeName}
          </div>

          {isDepartureConfirmed && booking.status !== "cancelled" && (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "14px",
                backgroundColor: "#ecfdf3",
                color: "#166534",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Поездка подтверждена
            </div>
          )}

          {!isDepartureConfirmed &&
            booking.status !== "cancelled" &&
            !canConfirmTrip &&
            confirmWindowStart &&
            departureDateTime &&
            new Date() < confirmWindowStart && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  backgroundColor: "#f8fafc",
                  color: "#475569",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                Подтверждение станет доступно за 1 час до отправления
              </div>
            )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
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
        </Card>

        <Card>
          <div style={sectionTitleStyle}>Пассажиры и контакты</div>

          <DetailsRow
            label="Количество пассажиров"
            value={`${booking.passengers_count} ${getPassengerWord(
              booking.passengers_count
            )}`}
          />
          <DetailsRow
            label="Оформлено"
            value={booking.booking_for_other ? "На другого человека" : "На себя"}
          />
          <DetailsRow label="Имя" value={booking.contact_name || "—"} />
          <DetailsRow
            label="Основной телефон"
            value={booking.contact_phone || "—"}
          />
          <DetailsRow
            label="Дополнительный телефон"
            value={booking.contact_phone_secondary || "—"}
            withoutBorder
          />
        </Card>

        <Card>
          <div style={sectionTitleStyle}>Поездка</div>

          <DetailsRow label="Посадка" value={booking.pickup_point || "—"} />
          <DetailsRow label="Высадка" value={booking.dropoff_point || "—"} />
          <DetailsRow
            label="Сообщение водителю"
            value={booking.driver_message || "—"}
            withoutBorder
          />
        </Card>

        <Card>
          <div style={sectionTitleStyle}>Информация о маршрутке</div>

          <DetailsRow label="ФИО водителя" value={driverName} />
          <DetailsRow label="Марка маршрутки" value={vehicleModel} />
          <DetailsRow
            label="Номер маршрутки"
            value={vehiclePlate}
            withoutBorder
          />
        </Card>

        {booking.status !== "cancelled" && !editMode && (
          <Card>
            <div style={sectionTitleStyle}>Действия</div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {canConfirmTrip && !isDepartureConfirmed && (
                <button
                  type="button"
                  onClick={handleConfirmTrip}
                  disabled={confirmingTrip}
                  style={{
                    ...confirmButtonStyle,
                    opacity: confirmingTrip ? 0.7 : 1,
                    cursor: confirmingTrip ? "default" : "pointer",
                  }}
                >
                  {confirmingTrip ? "Подтверждение..." : "Подтвердить поездку"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditMode(true)}
                style={primaryDarkButtonStyle}
              >
                Изменить бронь
              </button>

              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={cancelling}
                style={{
                  ...dangerButtonStyle,
                  opacity: cancelling ? 0.7 : 1,
                  cursor: cancelling ? "default" : "pointer",
                }}
              >
                {cancelling ? "Отмена..." : "Отменить бронь"}
              </button>
            </div>
          </Card>
        )}

        {booking.status !== "cancelled" && editMode && (
          <Card>
            <div style={sectionTitleStyle}>Редактирование брони</div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={labelStyle}>Дата</label>
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
                  style={inputStyle}
                >
                  {dateOptions.map((date) => (
                    <option key={date} value={date}>
                      {formatDateRu(date)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Время отправления</label>
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  style={inputStyle}
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
              </div>

              <div>
                <label style={labelStyle}>
                  Количество пассажиров ({availableSeatsForSelectedTrip} доступно)
                </label>
                <select
                  value={passengersCount}
                  onChange={(e) => setPassengersCount(e.target.value)}
                  style={inputStyle}
                >
                  {passengerOptions.map((count) => (
                    <option key={count} value={String(count)}>
                      {count} {getPassengerWord(count)}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "14px",
                  padding: "14px",
                  border: "1px solid #eef2f7",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={bookingForOther}
                    onChange={(e) => setBookingForOther(e.target.checked)}
                  />
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    Заказать не себе
                  </span>
                </label>
              </div>

              {!bookingForOther ? (
                <>
                  <div>
                    <label style={labelStyle}>Имя для связи</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Введите имя"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Основной номер телефона</label>
                    <input
                      type="tel"
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value)}
                      placeholder="+7 ..."
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Дополнительный номер телефона
                    </label>
                    <input
                      type="tel"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value)}
                      placeholder="+7 ..."
                      style={inputStyle}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>Имя пассажира</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="На кого бронируем"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Телефон пассажира</label>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+7 ..."
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Посадка</label>
                <select
                  value={pickupPoint}
                  onChange={(e) => setPickupPoint(e.target.value)}
                  style={inputStyle}
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
              </div>

              <div>
                <label style={labelStyle}>Высадка</label>
                <select
                  value={dropoffPoint}
                  onChange={(e) => setDropoffPoint(e.target.value)}
                  style={inputStyle}
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
              </div>

              <div>
                <label style={labelStyle}>Сообщение водителю</label>
                <textarea
                  value={driverMessage}
                  onChange={(e) => setDriverMessage(e.target.value)}
                  placeholder="Комментарий по поездке"
                  style={textareaStyle}
                />
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  style={{
                    ...primaryDarkButtonStyle,
                    opacity: saving ? 0.7 : 1,
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
                    opacity: cancelling ? 0.7 : 1,
                    cursor: cancelling ? "default" : "pointer",
                  }}
                >
                  {cancelling ? "Отмена..." : "Отменить бронь"}
                </button>
              </div>
            </div>
          </Card>
        )}

        {booking.status === "cancelled" && (
          <Card centered>
            <div style={titleStyle}>Бронь отменена</div>
            <div style={subtitleStyle}>
              Эта бронь больше не участвует в активных поездках
            </div>
            <Link href="/" style={primaryDarkButtonStyle}>
              На главную
            </Link>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}

function PageWrapper({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fb",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, centered = false }) {
  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        backgroundColor: "#ffffff",
        borderRadius: "22px",
        padding: "20px",
        boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
        border: "1px solid #eef2f7",
        textAlign: centered ? "center" : "left",
      }}
    >
      {children}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
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

function DetailsRow({ label, value, withoutBorder = false }) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: withoutBorder ? "none" : "1px solid #eef2f7",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "15px",
          fontWeight: "600",
          color: "#111827",
          lineHeight: "1.4",
        }}
      >
        {value}
      </div>
    </div>
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

const titleStyle = {
  fontSize: "22px",
  fontWeight: "800",
  color: "#111827",
  marginBottom: "8px",
};

const subtitleStyle = {
  fontSize: "14px",
  color: "#6b7280",
  marginBottom: "18px",
};

const sectionTitleStyle = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#111827",
  marginBottom: "14px",
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
  color: "#374151",
  marginBottom: "6px",
  fontWeight: "600",
};

const inputStyle = {
  width: "100%",
  height: "48px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
};

const textareaStyle = {
  width: "100%",
  minHeight: "110px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  padding: "12px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
  resize: "vertical",
};

const backLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "40px",
  padding: "0 14px",
  borderRadius: "12px",
  backgroundColor: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "700",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  border: "1px solid #eef2f7",
};

const primaryDarkButtonStyle = {
  width: "100%",
  height: "48px",
  border: "none",
  borderRadius: "14px",
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(17,24,39,0.18)",
};

const secondaryButtonStyle = {
  width: "100%",
  height: "48px",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
};

const dangerButtonStyle = {
  width: "100%",
  height: "48px",
  border: "none",
  borderRadius: "14px",
  backgroundColor: "#7f1d1d",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(127,29,29,0.22)",
};

const confirmButtonStyle = {
  width: "100%",
  height: "48px",
  border: "none",
  borderRadius: "14px",
  backgroundColor: "#2f6f57",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(47,111,87,0.22)",
};
