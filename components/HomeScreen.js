"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function HomeScreen({ user, onOpenProfile }) {
  const today = getTodayString();
  const nowTime = getCurrentTimeString();

  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  // Черновик фильтров
  const [draftRoute, setDraftRoute] = useState("all");
  const [draftDate, setDraftDate] = useState(today);
  const [draftTimeFrom, setDraftTimeFrom] = useState("");
  const [draftTimeTo, setDraftTimeTo] = useState("");
  const [draftMinSeats, setDraftMinSeats] = useState("");

  // Применённые фильтры
  const [appliedRoute, setAppliedRoute] = useState("all");
  const [appliedDate, setAppliedDate] = useState(today);
  const [appliedTimeFrom, setAppliedTimeFrom] = useState("");
  const [appliedTimeTo, setAppliedTimeTo] = useState("");
  const [appliedMinSeats, setAppliedMinSeats] = useState("");

  useEffect(() => {
    loadTrips();
  }, [appliedDate]);

  async function loadTrips() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "active")
        .eq("trip_date", appliedDate)
        .order("departure_time", { ascending: true });

      if (error) {
        console.error("Ошибка загрузки trips:", error);
        alert("Ошибка загрузки маршрутов: " + error.message);
        setTrips([]);
        return;
      }

      console.log("Загруженные trips:", data);
      setTrips(data || []);
    } catch (err) {
      console.error("Ошибка:", err);
      alert("Ошибка загрузки маршрутов");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const routeName = `${trip.from_city} → ${trip.to_city}`;
      const isToday = appliedDate === today;

      const matchRoute =
        appliedRoute === "all" || routeName === appliedRoute;

      const matchSeats =
        !appliedMinSeats || trip.seats_available >= Number(appliedMinSeats);

      const matchTimeFrom =
        !appliedTimeFrom || trip.departure_time >= appliedTimeFrom;

      const matchTimeTo =
        !appliedTimeTo || trip.departure_time <= appliedTimeTo;

      const matchCurrentTime =
        !isToday || trip.departure_time.slice(0, 5) >= nowTime;

      return (
        matchRoute &&
        matchSeats &&
        matchTimeFrom &&
        matchTimeTo &&
        matchCurrentTime
      );
    });
  }, [
    trips,
    appliedRoute,
    appliedDate,
    appliedMinSeats,
    appliedTimeFrom,
    appliedTimeTo,
    today,
    nowTime,
  ]);

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

  const titleDateText = appliedDate
    ? formatDateRu(appliedDate)
    : formatDateRu(today);

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

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <select
            value={draftRoute}
            onChange={(e) => setDraftRoute(e.target.value)}
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
            }}
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
              }}
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
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: "800",
              color: "#111827",
              lineHeight: "1.2",
            }}
          >
            Доступные поездки на {titleDateText}
          </h2>
        </div>

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
              const departureTime = trip.departure_time?.slice(0, 5) || "";
              const duration = trip.travel_duration || "~9 ч";

              return (
                <div
                  key={trip.id}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "22px",
                    padding: "18px",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
                    border: "1px solid #eef2f7",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "19px",
                          fontWeight: "800",
                          color: "#111827",
                          lineHeight: "1.3",
                          marginBottom: "6px",
                        }}
                      >
                        {trip.from_city} → {trip.to_city}
                      </div>

                      <div
                        style={{
                          fontSize: "14px",
                          color: "#6b7280",
                          lineHeight: "1.4",
                        }}
                      >
                        Отправление: {formatDateRu(trip.trip_date)} в{" "}
                        {departureTime}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: "68px",
                        textAlign: "right",
                        fontSize: "20px",
                        fontWeight: "800",
                        color: "#2563eb",
                        lineHeight: "1.2",
                      }}
                    >
                      {departureTime}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "16px",
                    }}
                  >
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
                        Время в дороге
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        {duration}
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: "14px",
                        padding: "12px",
                      }}
                    >
                      <
