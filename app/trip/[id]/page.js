"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

const ACTIVE_BOOKING_STATUSES = ["new", "confirmed"];

export default function TripDetailsPage({ params }) {
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [userData, setUserData] = useState(null);

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

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTripAndUser();
  }, [id]);

  async function loadTripAndUser() {
    try {
      setLoading(true);

      const [tripResult, userResult] = await Promise.all([
        loadTripWithActualSeats(id),
        loadCurrentUser(),
      ]);

      if (tripResult) {
        setTrip(tripResult);
      } else {
        setTrip(null);
      }

      if (userResult) {
        setUserData(userResult);
        setContactName(userResult.name || "");
        setPrimaryPhone(userResult.phone || "");
        setSecondaryPhone(userResult.phone_secondary || "");
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

    const bookedSeats = await getActiveBookedSeats(tripId);
    const seatsTotal = Number(tripData?.seats_total || 15);
    const freeSeats = Math.max(seatsTotal - bookedSeats, 0);

    return {
      ...tripData,
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
      const freshTotalSeats = Number(trip.seats_total || 15);
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
          : secondaryPhone.trim() || null,
        pickup_point: pickupPoint,
        dropoff_point: dropoffPoint,
        driver_message: driverMessage.trim() || null,
        status: "new",
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

  const routeName = useMemo(() => {
    if (!trip) return "";
    return `${trip.from_city} → ${trip.to_city}`;
  }, [trip]);

  const departureTime = normalizeTime(trip?.departure_time);
  const arrivalTime = getArrivalTime(
    trip?.trip_date,
    trip?.departure_time,
    trip?.travel_duration
  );
  const duration = formatTravelDurationCompact(trip?.travel_duration || "~9 ч");
  const isDepartureDay = trip?.trip_date === getTodayString();

  const availableSeats = Number(trip?.free_seats || 0);

  const passengerOptions = Array.from(
    { length: Math.max(availableSeats, 0) },
    (_, index) => index + 1
  );

  const points = useMemo(() => {
    if (!trip) return null;
    return getRoutePoints(trip.from_city, trip.to_city);
  }, [trip]);

  const driverName = isDepartureDay
    ? trip?.driver_name || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehicleModel = isDepartureDay
    ? trip?.vehicle_model || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehiclePlate = isDepartureDay
    ? trip?.vehicle_plate || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const contactSummary = bookingForOther
    ? guestName || guestPhone
      ? `${guestName || "Без имени"} · ${guestPhone || "без телефона"}`
      : "Заполните данные пассажира"
    : contactName || primaryPhone || secondaryPhone
      ? `${contactName || "Без имени"} · ${primaryPhone || "без телефона"}`
      : "Заполните данные для связи";

  const shortFrom = getCityCode(trip?.from_city);
  const shortTo = getCityCode(trip?.to_city);
  const headerBackground = getBookingBackgroundByArrivalCity(trip?.to_city);

  if (loading) {
    return (
      <PageShell>
        <StatusCard
          title="Загрузка данных поездки..."
          text="Подготавливаем информацию по рейсу"
        />
      </PageShell>
    );
  }

  if (!trip || !points) {
    return (
      <PageShell>
        <StatusCard
          title="Рейс не найден"
          text="Возможно, рейс был удалён или ссылка устарела"
          action={
            <Link href="/" style={backButtonStyle}>
              Вернуться на главную
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (availableSeats <= 0) {
    return (
      <PageShell>
        <StatusCard
          title="Свободных мест нет"
          text="На этот рейс сейчас нельзя оформить бронирование"
          action={
            <Link href="/" style={backButtonStyle}>
              Вернуться на главную
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef3fb 0%, #f5f7fb 24%, #f5f7fb 100%)",
        padding: "14px 14px 28px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
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
              fontSize: "13px",
              color: "#7b8798",
              fontWeight: "700",
            }}
          >
            Бронирование поездки
          </div>
        </div>

        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "28px",
            padding: "18px 18px 16px",
            backgroundColor: "#11246F",
            backgroundImage: headerBackground
              ? `linear-gradient(180deg, rgba(8,20,88,0.72) 0%, rgba(8,20,88,0.82) 52%, rgba(8,20,88,0.90) 100%), url(${headerBackground})`
              : "linear-gradient(135deg, #10206C 0%, #17339A 55%, #10206C 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            boxShadow: "0 18px 36px rgba(28, 44, 122, 0.20)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 28%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  minHeight: "34px",
                  padding: "0 16px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  fontWeight: "800",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                {formatDateRu(trip.trip_date)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "42px",
                    fontWeight: "900",
                    lineHeight: 1,
                    color: "#FFFFFF",
                    letterSpacing: "-1.4px",
                  }}
                >
                  {shortFrom}
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "rgba(235,241,255,0.92)",
                    lineHeight: 1.2,
                  }}
                >
                  {trip.from_city}
                </div>
              </div>

              <div
                style={{
                  minWidth: "118px",
                  height: "34px",
                  borderRadius: "999px",
                  padding: "0 10px",
                  backgroundColor: "rgba(8,16,45,0.86)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.14)",
                }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: "800",
                    color: "#FFFFFF",
                    lineHeight: 1,
                  }}
                >
                  {duration}
                </span>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "42px",
                    fontWeight: "900",
                    lineHeight: 1,
                    color: "#FFFFFF",
                    letterSpacing: "-1.4px",
                  }}
                >
                  {shortTo}
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "rgba(235,241,255,0.92)",
                    lineHeight: 1.2,
                  }}
                >
                  {trip.to_city}
                </div>
              </div>
            </div>

            <div
              style={{
                height: "1px",
                backgroundColor: "rgba(255,255,255,0.14)",
                marginBottom: "14px",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 92px 1fr",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "rgba(228,235,255,0.88)",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  Отправление
                </div>
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: "900",
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
                    fontSize: "12px",
                    color: "rgba(228,235,255,0.88)",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  Прибытие
                </div>
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: "900",
                    lineHeight: 1,
                    color: "#FFFFFF",
                  }}
                >
                  {arrivalTime}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "8px",
              }}
            >
              <HeroStatBadge label="Цена" value={`${formatPrice(trip.price)} ₽`} />
              <HeroStatBadge
                label="Свободно"
                value={`${availableSeats} ${getPassengerWord(availableSeats)}`}
              />
              <HeroStatBadge label="Статус" value="Бронирование" />
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitBooking();
          }}
          style={{
            background:
              "linear-gradient(180deg, #ffffff 0%, #fbfcff 100%)",
            borderRadius: "28px",
            padding: "18px",
            boxShadow: "0 14px 30px rgba(17,24,39,0.07)",
            border: "1px solid #e8edf6",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <SectionTitle
            title="Настройки поездки"
            subtitle="Выберите параметры бронирования и проверьте контактные данные"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "10px",
            }}
          >
            <FieldBlock
              label={`Количество пассажиров`}
              hint={`доступно ${availableSeats}`}
              icon={<UserIcon />}
            >
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
            </FieldBlock>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => setBookingForOther(false)}
                style={{
                  ...segmentedButtonStyle,
                  ...(bookingForOther ? {} : segmentedButtonActiveStyle),
                }}
              >
                <CheckDiamondIcon />
                Заказать на себя
              </button>

              <button
                type="button"
                onClick={() => setBookingForOther(true)}
                style={{
                  ...segmentedButtonStyle,
                  ...(bookingForOther ? segmentedButtonActiveStyle : {}),
                }}
              >
                <UserTwoIcon />
                Другому человеку
              </button>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "20px",
                padding: "14px",
                border: "1px solid #edf2f8",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#7b8798",
                  fontWeight: "700",
                  marginBottom: "6px",
                }}
              >
                Данные для бронирования
              </div>

              <div
                style={{
                  minHeight: "48px",
                  borderRadius: "14px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e8edf5",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 14px",
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#1f2937",
                  lineHeight: 1.3,
                  marginBottom: "14px",
                }}
              >
                {contactSummary}
              </div>

              {!bookingForOther ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "10px",
                  }}
                >
                  <FieldBlock label="Имя для связи" icon={<ProfileIcon />}>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Введите имя"
                      style={fieldNativeInputStyle}
                    />
                  </FieldBlock>

                  <FieldBlock label="Основной номер телефона" icon={<PhoneIcon />}>
                    <input
                      type="tel"
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value)}
                      placeholder="+7 ..."
                      style={fieldNativeInputStyle}
                    />
                  </FieldBlock>

                  <FieldBlock
                    label="Дополнительный номер телефона"
                    icon={<PhoneIcon />}
                  >
                    <input
                      type="tel"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value)}
                      placeholder="+7 ..."
                      style={fieldNativeInputStyle}
                    />
                  </FieldBlock>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "10px",
                  }}
                >
                  <FieldBlock label="Имя пассажира" icon={<ProfileIcon />}>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="На кого бронируем"
                      style={fieldNativeInputStyle}
                    />
                  </FieldBlock>

                  <FieldBlock label="Телефон пассажира" icon={<PhoneIcon />}>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+7 ..."
                      style={fieldNativeInputStyle}
                    />
                  </FieldBlock>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              height: "1px",
              backgroundColor: "#edf2f8",
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "10px",
            }}
          >
            <FieldBlock label="Посадка" icon={<PinIcon />}>
              <select
                value={pickupPoint}
                onChange={(e) => setPickupPoint(e.target.value)}
                style={fieldNativeSelectStyle}
              >
                <option value="" disabled>
                  Выберите точку посадки
                </option>

                <optgroup label="Основная">
                  <option value={points.pickup.main}>{points.pickup.main}</option>
                </optgroup>

                <optgroup label="Дополнительные точки посадки">
                  {points.pickup.additional.map((point) => (
                    <option key={point} value={point}>
                      {point}
                    </option>
                  ))}
                </optgroup>
              </select>
            </FieldBlock>

            <FieldBlock label="Высадка" icon={<PinIcon />}>
              <select
                value={dropoffPoint}
                onChange={(e) => setDropoffPoint(e.target.value)}
                style={fieldNativeSelectStyle}
              >
                <option value="" disabled>
                  Выберите точку высадки
                </option>

                <optgroup label="Основная">
                  <option value={points.dropoff.main}>
                    {points.dropoff.main}
                  </option>
                </optgroup>

                <optgroup label="Дополнительные точки высадки">
                  {points.dropoff.additional.map((point) => (
                    <option key={point} value={point}>
                      {point}
                    </option>
                  ))}
                </optgroup>
              </select>
            </FieldBlock>
          </div>

          <div>
            <label style={labelStyle}>Сообщение водителю</label>
            <textarea
              value={driverMessage}
              onChange={(e) => setDriverMessage(e.target.value)}
              placeholder="Например: буду с багажом / буду у дополнительной точки / есть комментарий по поездке"
              style={textareaStyle}
            />
          </div>

          <div
            style={{
              height: "1px",
              backgroundColor: "#edf2f8",
            }}
          />

          <SectionTitle
            title="Информация о маршруте"
            subtitle="Данные водителя и маршрутки открываются в день отправления"
            centered
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "10px",
            }}
          >
            <RouteInfoCard
              icon={<CarIcon />}
              label="Марка машины"
              value={vehicleModel}
            />
            <RouteInfoCard
              icon={<CarIcon />}
              label="Госномер"
              value={vehiclePlate}
            />
            <RouteInfoCard
              icon={<ProfileIcon />}
              label="Водитель"
              value={driverName}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: "56px",
              border: "none",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg, #0b1224 0%, #142344 45%, #0b1224 100%)",
              color: "#ffffff",
              fontSize: "17px",
              fontWeight: "800",
              cursor: isSubmitting ? "default" : "pointer",
              opacity: isSubmitting ? 0.72 : 1,
              boxShadow: "0 12px 24px rgba(11,18,36,0.22)",
            }}
          >
            {isSubmitting ? "Сохранение..." : "Подтвердить бронирование"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef3fb 0%, #f5f7fb 24%, #f5f7fb 100%)",
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
          marginBottom: action ? "18px" : 0,
          lineHeight: "1.5",
        }}
      >
        {text}
      </div>

      {action}
    </div>
  );
}

function SectionTitle({ title, subtitle, centered = false }) {
  return (
    <div style={{ textAlign: centered ? "center" : "left" }}>
      <div
        style={{
          fontSize: "18px",
          fontWeight: "800",
          color: "#111827",
          marginBottom: subtitle ? "4px" : 0,
        }}
      >
        {title}
      </div>

      {subtitle ? (
        <div
          style={{
            fontSize: "13px",
            color: "#6b7280",
            lineHeight: "1.45",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function HeroStatBadge({ label, value }) {
  return (
    <div
      style={{
        minHeight: "42px",
        padding: "8px 12px",
        borderRadius: "14px",
        backgroundColor: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "rgba(228,235,255,0.80)",
          marginBottom: "2px",
          fontWeight: "700",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "#FFFFFF",
          fontWeight: "800",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FieldBlock({ label, hint, icon, children }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "6px",
          marginBottom: "6px",
          flexWrap: "wrap",
        }}
      >
        <label style={labelStyle}>{label}</label>
        {hint ? (
          <span
            style={{
              fontSize: "13px",
              color: "#7b8798",
              fontWeight: "700",
            }}
          >
            ({hint})
          </span>
        ) : null}
      </div>

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
    </div>
  );
}

function RouteInfoCard({ icon, label, value }) {
  return (
    <div
      style={{
        borderRadius: "18px",
        backgroundColor: "#f6f8fc",
        border: "1px solid #edf2f8",
        padding: "14px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          color: "#111827",
          flexShrink: 0,
          marginTop: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>
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
  if (!year || !month || !day) return dateString;
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

function CheckDiamondIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
      <path
        d="M12 4 20 12 12 20 4 12 12 4Z"
        fill="currentColor"
        opacity="0.95"
      />
    </svg>
  );
}

function UserTwoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
      <circle cx="10" cy="8.2" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.8 18c1.2-2.5 3.3-3.9 5.2-3.9s4 1.4 5.2 3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17.2 9.5c1.3.1 2.3 1 2.7 2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17.8 15.2c1 .4 1.8 1.1 2.3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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

const labelStyle = {
  display: "block",
  fontSize: "14px",
  color: "#374151",
  fontWeight: "700",
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
  fontWeight: "600",
  color: "#394150",
  padding: "0",
  margin: "0",
  boxSizing: "border-box",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const textareaStyle = {
  width: "100%",
  minHeight: "120px",
  borderRadius: "16px",
  border: "1px solid #e8edf5",
  padding: "14px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
  resize: "vertical",
  boxShadow: "0 2px 6px rgba(15,23,42,0.02)",
};

const segmentedButtonStyle = {
  flex: 1,
  height: "42px",
  borderRadius: "14px",
  border: "1px solid #dbe4f0",
  backgroundColor: "#ffffff",
  color: "#475569",
  fontSize: "14px",
  fontWeight: "800",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const segmentedButtonActiveStyle = {
  background: "linear-gradient(135deg, #2457F5 0%, #2F6BFF 45%, #2155EA 100%)",
  color: "#ffffff",
  border: "1px solid transparent",
  boxShadow: "0 10px 20px rgba(37,99,235,0.18)",
};

const backLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "42px",
  padding: "0 14px",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "800",
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  border: "1px solid #e8edf6",
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
  fontWeight: "800",
};
