"use client";

import { useMemo, useState } from "react";

const routes = [
  {
    id: 1,
    from: "Москва",
    to: "Санкт-Петербург",
    date: getTodayString(),
    time: "07:00",
    seats: 6,
    price: "2500 ₽",
  },
  {
    id: 2,
    from: "Москва",
    to: "Санкт-Петербург",
    date: getTodayString(),
    time: "10:00",
    seats: 4,
    price: "2500 ₽",
  },
  {
    id: 3,
    from: "Санкт-Петербург",
    to: "Москва",
    date: getTodayString(),
    time: "12:00",
    seats: 5,
    price: "2500 ₽",
  },
  {
    id: 4,
    from: "Санкт-Петербург",
    to: "Москва",
    date: getTodayString(),
    time: "18:00",
    seats: 3,
    price: "2500 ₽",
  },
];

export default function HomeScreen({ user, onOpenProfile }) {
  const today = getTodayString();

  const [showFilters, setShowFilters] = useState(false);

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

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      const routeName = `${route.from} → ${route.to}`;

      const matchRoute =
        appliedRoute === "all" || routeName === appliedRoute;

      const matchDate =
        !appliedDate || route.date === appliedDate;

      const matchSeats =
        !appliedMinSeats || route.seats >= Number(appliedMinSeats);

      const matchTimeFrom =
        !appliedTimeFrom || route.time >= appliedTimeFrom;

      const matchTimeTo =
        !appliedTimeTo || route.time <= appliedTimeTo;

      return (
        matchRoute &&
        matchDate &&
        matchSeats &&
        matchTimeFrom &&
        matchTimeTo
      );
    });
  }, [
    appliedRoute,
    appliedDate,
    appliedTimeFrom,
    appliedTimeTo,
    appliedMinSeats,
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
    setDraftRoute("all");
    setDraftDate(today);
    setDraftTimeFrom("");
    setDraftTimeTo("");
    setDraftMinSeats("");

    setAppliedRoute("all");
    setAppliedDate(today);
    setAppliedTimeFrom("");
    setAppliedTimeTo("");
    setAppliedMinSeats("");

    setShowFilters(false);
  };

  const titleDateText = appliedDate
    ? formatDateRu(appliedDate)
    : "сегодня";

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
                height: "42px",
                border: "none",
                borderRadius: "12px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Сохранить фильтры
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
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
            Доступные поездки на {titleDateText}
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
              Нет поездок по выбранным параметрам
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
                  Дата: {formatDateRu(route.date)}
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

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRu(dateString) {
  if (!dateString) return "сегодня";

  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const labelStyle = {
  fontSize: "14px",
  color: "#374151",
};

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
