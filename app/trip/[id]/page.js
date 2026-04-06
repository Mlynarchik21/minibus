"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function TripDetailsPage({ params }) {
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [profile, setProfile] = useState(null);

  const [passengersCount, setPassengersCount] = useState("1");
  const [bookingForOther, setBookingForOther] = useState(false);
  const [showContactSection, setShowContactSection] = useState(false);

  const [contactName, setContactName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestPhoneSecondary, setGuestPhoneSecondary] = useState("");

  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [driverMessage, setDriverMessage] = useState("");

  useEffect(() => {
    loadTripAndProfile();
  }, [id]);

  async function loadTripAndProfile() {
    try {
      setLoading(true);

      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .single();

      if (tripError) {
        console.error("Ошибка загрузки trip:", tripError);
        setTrip(null);
        return;
      }

      setTrip(tripData);

      const telegramId = getTelegramUserId();

      if (!telegramId) {
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", telegramId)
        .single();

      if (profileError) {
        console.error("Ошибка загрузки profile:", profileError);
        setProfile(null);
        return;
      }

      setProfile(profileData);

      setContactName(profileData?.name || "");
      setPrimaryPhone(profileData?.phone || "");
      setSecondaryPhone(profileData?.phone_secondary || "");
    } catch (error) {
      console.error("Ошибка страницы trip:", error);
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }

  const routeName = useMemo(() => {
    if (!trip) return "";
    return `${trip.from_city} → ${trip.to_city}`;
  }, [trip]);

  const departureTime = trip?.departure_time?.slice(0, 5) || "";
  const duration = trip?.travel_duration || "~9 ч";
  const isDepartureDay = trip?.trip_date === getTodayString();

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
    ? guestName || guestPhone || guestPhoneSecondary
      ? `${guestName || "Без имени"} · ${guestPhone || "без телефона"}`
      : "Заполните данные пассажира"
    : contactName || primaryPhone || secondaryPhone
    ? `${contactName || "Без имени"} · ${primaryPhone || "без телефона"}`
    : "Данные профиля не найдены";

  if (loading) {
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
              backgroundColor: "#ffffff",
              borderRadius: "22px",
              padding: "20px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              border: "1px solid #eef2f7",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Загрузка данных поездки...
          </div>
        </div>
      </div>
    );
  }

  if (!trip || !points) {
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
              backgroundColor: "#ffffff",
              borderRadius: "22px",
              padding: "20px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              border: "1px solid #eef2f7",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#111827",
                marginBottom: "8px",
              }}
            >
              Рейс не найден
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#6b7280",
                marginBottom: "18px",
              }}
            >
              Возможно, рейс был удалён или ссылка устарела
            </div>

            <Link href="/" style={backButtonStyle}>
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            Детали поездки
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "#111827",
              lineHeight: "1.3",
              marginBottom: "10px",
            }}
          >
            {routeName}
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: "1.4",
              marginBottom: "16px",
            }}
          >
            Отправление: {formatDateRu(trip.trip_date)} в {departureTime}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <InfoCard
              label="Дата отправления"
              value={formatDateRu(trip.trip_date)}
            />
            <InfoCard label="Время отправления" value={departureTime} />
            <InfoCard label="Время в дороге" value={duration} />
            <InfoCard label="Стоимость" value={`${trip.price} ₽`} />
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#6b7280",
            }}
          >
            Свободных мест: {trip.seats_available}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "14px",
            }}
          >
            Информация о маршрутке
          </div>

          <DetailsRow label="ФИО водителя" value={driverName} />
          <DetailsRow label="Марка маршрутки" value={vehicleModel} />
          <DetailsRow
            label="Номер маршрутки"
            value={vehiclePlate}
            withoutBorder
          />
        </div>

        <form
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
            }}
          >
            Настройки поездки
          </div>

          <div
            style={{
              backgroundColor: "#f8fafc",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "4px",
              }}
            >
              Направление
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              {routeName}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Количество пассажиров</label>
            <select
              value={passengersCount}
              onChange={(e) => setPassengersCount(e.target.value)}
              style={inputStyle}
            >
              <option value="1">1 пассажир</option>
              <option value="2">2 пассажира</option>
              <option value="3">3 пассажира</option>
              <option value="4">4 пассажира</option>
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
            <button
              type="button"
              onClick={() => setShowContactSection((prev) => !prev)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: "4px",
                  }}
                >
                  Данные для связи
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    lineHeight: "1.4",
                  }}
                >
                  {contactSummary}
                </div>
              </div>

              <div
                style={{
                  fontSize: "18px",
                  color: "#111827",
                  marginLeft: "12px",
                }}
              >
                {showContactSection ? "−" : "+"}
              </div>
            </button>

            {showContactSection && (
              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "14px",
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    border: "1px solid #e5e7eb",
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
                      <label style={labelStyle}>Основной телефон пассажира</label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+7 ..."
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Дополнительный телефон пассажира
                      </label>
                      <input
                        type="tel"
                        value={guestPhoneSecondary}
                        onChange={(e) => setGuestPhoneSecondary(e.target.value)}
                        placeholder="+7 ..."
                        style={inputStyle}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

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

          <button
            type="button"
            style={{
              height: "48px",
              border: "none",
              borderRadius: "14px",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(17,24,39,0.18)",
            }}
          >
            Подтвердить бронирование
          </button>
        </form>
      </div>
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

function formatDateRu(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU");
}

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

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "44px",
  padding: "0 18px",
  borderRadius: "14px",
  backgroundColor: "#111827",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "700",
};
