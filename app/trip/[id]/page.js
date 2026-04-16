"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

export default function TripDetailsPage({ params }) {
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [userData, setUserData] = useState(null);

  const [passengersCount, setPassengersCount] = useState("1");
  const [bookingForOther, setBookingForOther] = useState(false);

  const [contactName, setContactName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTripAndUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadTripAndUser() {
    try {
      setLoading(true);

      const [tripResult, userResult] = await Promise.all([
        loadTripWithActualSeats(id),
        loadCurrentUser(),
      ]);

      setTrip(tripResult || null);

      if (userResult) {
        setUserData(userResult);
        setContactName(userResult.name || "");
        setPrimaryPhone(userResult.phone || "");
      } else {
        const fallbackName =
          window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "";
        setContactName(fallbackName);
      }
    } catch (error) {
      console.error("Ошибка страницы trip:", error);
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser() {
    const telegramId = getTelegramUserId();

    if (!telegramId) {
      console.warn("Telegram user id не найден");
      return null;
    }

    const { data, error } = await supabase
      .from("users")
      .select(
        "id, telegram_id, name, phone, phone_secondary, notifications_enabled"
      )
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) {
      console.error("Ошибка загрузки user:", error);
      return null;
    }

    return data || null;
  }

  async function enrichTripRelations(tripData) {
    if (!tripData) return null;

    let driver = null;
    let vehicle = null;

    if (tripData.driver_id) {
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("id, full_name, phone, email, status")
        .eq("id", tripData.driver_id)
        .maybeSingle();

      if (driverError) {
        console.error("Ошибка загрузки driver:", driverError);
      } else {
        driver = driverData || null;
      }
    }

    if (tripData.vehicle_id) {
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select(
          "id, plate_number, brand, model, color, year, seats_total, seats_count, status, class"
        )
        .eq("id", tripData.vehicle_id)
        .maybeSingle();

      if (vehicleError) {
        console.error("Ошибка загрузки vehicle:", vehicleError);
      } else {
        vehicle = vehicleData || null;
      }
    }

    return {
      ...tripData,
      driver,
      vehicle,
      driver_name: driver?.full_name || "",
      driver_phone: driver?.phone || "",
      vehicle_model: buildVehicleModel(vehicle),
      vehicle_plate: vehicle?.plate_number || "",
    };
  }

  async function loadTripWithActualSeats(tripId) {
    const { data: tripData, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError) {
      console.error("Ошибка загрузки trip:", tripError);
      return null;
    }

    const enrichedTrip = await enrichTripRelations(tripData);

    const bookedSeats = await getActiveBookedSeats(tripId);
    const seatsTotal = Number(
      enrichedTrip?.seats_total || enrichedTrip?.seats_count || 15
    );
    const freeSeats = Math.max(seatsTotal - bookedSeats, 0);

    return {
      ...enrichedTrip,
      booked_seats: bookedSeats,
      free_seats: freeSeats,
    };
  }

  async function getActiveBookedSeats(tripId) {
    const { data, error } = await supabase
      .from("bookings")
      .select("passengers_count, status")
      .eq("trip_id", tripId)
      .in("status", ACTIVE_BOOKING_STATUSES);

    if (error) {
      console.error("Ошибка загрузки bookings:", error);
      return 0;
    }

    return (data || []).reduce((sum, item) => {
      return sum + Number(item.passengers_count || 0);
    }, 0);
  }

  async function handleSubmitBooking() {
    if (!trip) return;

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
    const currentAvailableSeats = Number(trip.free_seats || 0);

    if (seatsToBook < 1) {
      alert("Некорректное количество пассажиров");
      return;
    }

    if (seatsToBook > currentAvailableSeats) {
      alert("Недостаточно свободных мест");
      return;
    }

    try {
      setIsSubmitting(true);

      const freshBookedSeats = await getActiveBookedSeats(trip.id);
      const freshTotalSeats = Number(trip.seats_total || trip.seats_count || 15);
      const freshAvailableSeats = Math.max(
        freshTotalSeats - freshBookedSeats,
        0
      );

      if (seatsToBook > freshAvailableSeats) {
        alert(
          "Пока вы оформляли бронь, свободных мест стало меньше. Обновите страницу."
        );

        const refreshedTrip = {
          ...trip,
          booked_seats: freshBookedSeats,
          free_seats: freshAvailableSeats,
        };

        setTrip(refreshedTrip);

        if (
          freshAvailableSeats > 0 &&
          Number(passengersCount) > freshAvailableSeats
        ) {
          setPassengersCount(String(freshAvailableSeats));
        }

        return;
      }

      const telegramId = getTelegramUserId();

      const resolvedContactName = bookingForOther
        ? guestName.trim()
        : contactName.trim();

      const bookingPayload = {
        trip_id: trip.id,
        telegram_id: telegramId,
        user_id: userData?.id || null,
        passengers_count: seatsToBook,
        booking_for_other: bookingForOther,
        contact_name: resolvedContactName,
        contact_phone: bookingForOther
          ? guestPhone.trim()
          : primaryPhone.trim(),
        contact_phone_secondary: bookingForOther
          ? null
          : userData?.phone_secondary || null,
        pickup_point: pickupPoint,
        dropoff_point: dropoffPoint,
        driver_message: null,
        status: "pending",
      };

      const { data: insertedBooking, error: insertError } = await supabase
        .from("bookings")
        .insert([bookingPayload])
        .select("id")
        .single();

      if (insertError) {
        console.error("Ошибка создания заказа:", insertError);
        alert("Не удалось создать бронирование");
        return;
      }

      const bookingId = insertedBooking?.id;

      if (telegramId && bookingId) {
        try {
          const notificationResponse = await fetch(
            "/api/send-booking-notification",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                bookingId,
                telegramId,
                routeName: `${trip.from_city} → ${trip.to_city}`,
                tripDate: trip.trip_date,
                departureTime: normalizeTime(trip.departure_time),
                passengersCount: seatsToBook,
                pickupPoint,
                dropoffPoint,
                contactName: resolvedContactName,
              }),
            }
          );

          if (!notificationResponse.ok) {
            const notificationData = await notificationResponse
              .json()
              .catch(() => null);

            console.error(
              "Ошибка ответа send-booking-notification:",
              notificationData || notificationResponse.status
            );
          }
        } catch (notificationError) {
          console.error(
            "Ошибка отправки Telegram-уведомления:",
            notificationError
          );
        }
      }

      alert("Бронирование успешно создано");
      window.location.href = "/";
    } catch (error) {
      console.error("Ошибка при подтверждении бронирования:", error);
      alert("Не удалось подтвердить бронирование");
    } finally {
      setIsSubmitting(false);
    }
  }

  const departureTime = normalizeTime(trip?.departure_time);
  const arrivalTime = getArrivalTime(
    trip?.trip_date,
    trip?.departure_time,
    trip
  );

  const durationLabel = formatTravelDurationCompact(trip);

  const isDepartureDay = trip?.trip_date === getTodayString();
  const availableSeats = Number(trip?.free_seats || 0);

  const passengerOptions = Array.from(
    { length: Math.max(availableSeats, 0) },
    (_, index) => index + 1
  );

  const pickupOptions = useMemo(() => {
    if (!trip) return [];

    const actualPoints = normalizeStopPoints(trip.pickup_points);
    if (actualPoints.length > 0) return actualPoints;

    return trip.from_city ? [trip.from_city] : [];
  }, [trip]);

  const dropoffOptions = useMemo(() => {
    if (!trip) return [];

    const actualPoints = normalizeStopPoints(trip.dropoff_points);
    if (actualPoints.length > 0) return actualPoints;

    return trip.to_city ? [trip.to_city] : [];
  }, [trip]);

  useEffect(() => {
    if (pickupOptions.length > 0 && !pickupOptions.includes(pickupPoint)) {
      setPickupPoint(pickupOptions[0]);
    }
  }, [pickupOptions, pickupPoint]);

  useEffect(() => {
    if (dropoffOptions.length > 0 && !dropoffOptions.includes(dropoffPoint)) {
      setDropoffPoint(dropoffOptions[0]);
    }
  }, [dropoffOptions, dropoffPoint]);

  const driverName = isDepartureDay
    ? trip?.driver_name || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehicleModel = isDepartureDay
    ? trip?.vehicle_model || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehiclePlate = isDepartureDay
    ? trip?.vehicle_plate || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const shortFrom = getCityCode(trip?.from_city);
  const shortTo = getCityCode(trip?.to_city);

  if (loading) {
    return (
      <PageWrap>
        <StatusCard
          title="Загрузка данных поездки..."
          text="Подготавливаем информацию по рейсу"
        />
      </PageWrap>
    );
  }

  if (!trip) {
    return (
      <PageWrap>
        <StatusCard
          title="Рейс не найден"
          text="Возможно, рейс был удалён или ссылка устарела"
          action={
            <Link href="/" style={backButtonStyle}>
              Вернуться на главную
            </Link>
          }
        />
      </PageWrap>
    );
  }

  if (availableSeats <= 0) {
    return (
      <PageWrap>
        <StatusCard
          title="Свободных мест нет"
          text="На этот рейс сейчас нельзя оформить бронирование"
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
        padding: "14px 12px 20px",
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
          paddingBottom: "20px",
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
              {formatDateRu(trip.trip_date)}
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
                {trip.from_city}
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
                {trip.to_city}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitBooking();
          }}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "30px",
            padding: "20px 16px 18px",
            border: "1px solid #e8edf6",
            boxShadow: "0 14px 30px rgba(17,24,39,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "2px",
            }}
          >
            Настройки поездки
          </div>

          <div>
            <div style={labelStyle}>
              Количество пассажиров{" "}
              <span style={labelHintStyle}>(доступно {availableSeats})</span>
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

          <div>
            <div style={labelStyle}>Имя</div>
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
            <div style={labelStyle}>Основной телефон</div>
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

          {bookingForOther ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "10px",
              }}
            >
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
            </div>
          ) : null}

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

                {pickupOptions.map((point) => (
                  <option key={point} value={point}>
                    {point}
                  </option>
                ))}
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

                {dropoffOptions.map((point) => (
                  <option key={point} value={point}>
                    {point}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginTop: "2px",
            }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e6ecf4" }} />
            <div
              style={{
                fontSize: "17px",
                fontWeight: "800",
                color: "#111827",
                whiteSpace: "nowrap",
              }}
            >
              Информация о маршруте
            </div>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e6ecf4" }} />
          </div>

          <RouteInfoBox
            icon={<CarIcon />}
            title="Марка машины"
            value={vehicleModel}
          />

          <RouteInfoBox icon={<CarIcon />} value={vehiclePlate} />

          <RouteInfoBox
            icon={<ProfileIcon />}
            title="Водитель"
            value={driverName}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: "6px",
              height: "58px",
              border: "none",
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, #0c1430 0%, #10206C 45%, #081224 100%)",
              color: "#ffffff",
              fontSize: "17px",
              fontWeight: "800",
              cursor: isSubmitting ? "default" : "pointer",
              opacity: isSubmitting ? 0.72 : 1,
              boxShadow: "0 14px 28px rgba(16,32,108,0.24)",
            }}
          >
            {isSubmitting ? "Сохранение..." : "Подтвердить бронирование"}
          </button>
        </form>
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

function normalizeStopPoints(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (
        item &&
        typeof item === "object" &&
        typeof item.label === "string"
      ) {
        return item.label.trim();
      }

      return "";
    })
    .filter(Boolean);
}

function buildVehicleModel(vehicle) {
  if (!vehicle) return "";

  const brand = String(vehicle.brand || "").trim();
  const model = String(vehicle.model || "").trim();

  if (brand && model) return `${brand} ${model}`;
  return brand || model || "";
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
  if (!year || !month || !day) return dateString;
  return `${day}.${month}.${year}`;
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
    return `${hours} часов`;
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

function buildTripDateTime(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const normalizedTime = normalizeTime(timeString);
  return new Date(`${dateString}T${normalizedTime}:00`);
}

function getPassengerWord(count) {
  const n = Number(count);

  if (n % 10 === 1 && n % 100 !== 11) return "пассажир";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return "пассажира";
  }

  return "пассажиров";
}

function getCityCode(city) {
  const value = String(city || "").toLowerCase().trim();

  if (value.includes("моск")) return "MSK";
  if (value.includes("санкт") || value.includes("петер")) return "SPB";

  return String(city || "").slice(0, 3).toUpperCase();
}

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
