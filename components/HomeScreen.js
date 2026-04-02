"use client";

const routes = [
  {
    id: 1,
    from: "Центр",
    to: "Аэропорт",
    time: "09:30",
    seats: 4,
    price: "250 ₽",
  },
  {
    id: 2,
    from: "ЖД Вокзал",
    to: "Автовокзал",
    time: "11:00",
    seats: 2,
    price: "180 ₽",
  },
  {
    id: 3,
    from: "Центр",
    to: "Южный район",
    time: "13:20",
    seats: 5,
    price: "200 ₽",
  },
  {
    id: 4,
    from: "Северный район",
    to: "Центр",
    time: "15:10",
    seats: 3,
    price: "220 ₽",
  },
];

export default function HomeScreen({ user }) {
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
            marginBottom: "22px",
          }}
        >
          <input
            type="text"
            placeholder="Поиск маршрута"
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
          />

          <button
            type="button"
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

        <div style={{ marginBottom: "14px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            Ближайшие маршрутки на сегодня
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
          {routes.map((route) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
