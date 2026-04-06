"use client";

import { useMemo, useState } from "react";

const routes = [
  {
    id: 1,
    from: "Москва",
    to: "Питер",
    date: "2025-07-20",
    time: "09:30",
    seats: 4,
    price: "2500 ₽",
  },
  {
    id: 2,
    from: "Москва",
    to: "Питер",
    date: "2025-07-20",
    time: "14:00",
    seats: 2,
    price: "2700 ₽",
  },
  {
    id: 3,
    from: "Питер",
    to: "Москва",
    date: "2025-07-20",
    time: "11:00",
    seats: 5,
    price: "2600 ₽",
  },
  {
    id: 4,
    from: "Питер",
    to: "Москва",
    date: "2025-07-20",
    time: "18:30",
    seats: 3,
    price: "2800 ₽",
  },
];

export default function HomeScreen({ user, onOpenProfile }) {
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [minSeats, setMinSeats] = useState("");

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      const routeName = `${route.from} → ${route.to}`;

      const matchRoute =
        selectedRoute === "all" || routeName === selectedRoute;

      const matchDate =
        !selectedDate || route.date === selectedDate;

      const matchSeats =
        !minSeats || route.seats >= Number(minSeats);

      const matchTimeFrom =
        !timeFrom || route.time >= timeFrom;

      const matchTimeTo =
        !timeTo || route.time <= timeTo;

      return (
        matchRoute &&
        matchDate &&
        matchSeats &&
        matchTimeFrom &&
        matchTimeTo
      );
    });
  }, [selectedRoute, selectedDate, timeFrom, timeTo, minSeats]);

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
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
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
            <option value="Москва → Питер">Москва → Питер</option>
            <option value="Питер → Москва">Питер → Москва</option>
          </select>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
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
              borderRadius: "18px",
              padding: "16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              marginBottom: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div>
              <label style={{ fontSize: "14px", color: "#374151" }}>Дата</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "14px", color: "#374151" }}>С</label>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "14px", color: "#374151" }}>До</label>
                <input
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "14px", color: "#374151" }}>
                Свободных мест от
              </label>
              <input
                type="number"
                min="1"
                placeholder="Например: 2"
                value={minSeats}
                onChange={(e) => setMinSeats(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate("");
                setTimeFrom("");
                setTimeTo("");
                setMinSeats("");
                setSelectedRoute("all");
              }}
              style={{
                marginTop: "6px",
                height: "42px",
                border: "none",
                borderRadius: "12px",
                backgroundColor: "#111827",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
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
              fontSize: "20px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            Доступные поездки
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            paddingBottom: "30px",
          }}
        >
          {filteredRoutes.length === 0 ? (
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "18px",
                padding: "18px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              Нет маршрутов по выбранным параметрам
            </div>
          ) : (
            filteredRoutes.map((route) => (
              <div
                key={route.id}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "18px",
                  padding: "18px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {route.from} → {route.to}
                  </div>

                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#2563eb",
                    }}
                  >
                    {route.time}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    marginBottom: "6px",
                  }}
                >
                  Дата: {route.date}
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    marginBottom: "14px",
                  }}
                >
                  Свободных мест: {route.seats}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {route.price}
                  </div>

                  <button
                    type="button"
                    style={{
                      height: "40px",
                      padding: "0 16px",
                      border: "none",
                      borderRadius: "12px",
                      backgroundColor: "#111827",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Забронировать
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: "44px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
  marginTop: "6px",
};
