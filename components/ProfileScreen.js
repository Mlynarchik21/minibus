"use client";

export default function ProfileScreen({ user, onBack }) {
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
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#ffffff",
              fontSize: "18px",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            }}
          >
            ←
          </button>

          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            Профиль
          </h1>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              backgroundColor: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              marginBottom: "18px",
            }}
          >
            👤
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "6px",
              }}
            >
              Имя
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              {user?.name || "Не указано"}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "6px",
              }}
            >
              Телефон
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              {user?.phone || "Не указан"}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "6px",
              }}
            >
              Telegram ID
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
                wordBreak: "break-word",
              }}
            >
              {user?.telegram_id || "Пока не получен"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
