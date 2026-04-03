"use client";

import { useState } from "react";

export default function ProfileScreen({ user, onBack, onSave, onDelete }) {
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [phoneSecondary, setPhoneSecondary] = useState(user?.phone_secondary || "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notifications_enabled ?? true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      alert("Пожалуйста, заполните имя и основной номер телефона");
      return;
    }

    try {
      setIsSaving(true);

      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        phone_secondary: phoneSecondary.trim(),
        notifications_enabled: notificationsEnabled,
      });
    } catch (error) {
      console.error("Ошибка при сохранении профиля:", error);
      alert("Не удалось сохранить изменения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Вы уверены, что хотите удалить свой профиль? Это действие нельзя отменить."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete();
    } catch (error) {
      console.error("Ошибка при удалении профиля:", error);
      alert("Не удалось удалить профиль");
    } finally {
      setIsDeleting(false);
    }
  };

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
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
              }}
            >
              Имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите имя"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "12px",
                border: "1px solid #d1d5db",
                padding: "0 14px",
                fontSize: "15px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
              }}
            >
              Основной телефон
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 999 123-45-67"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "12px",
                border: "1px solid #d1d5db",
                padding: "0 14px",
                fontSize: "15px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
              }}
            >
              Дополнительный телефон
            </label>
            <input
              type="tel"
              value={phoneSecondary}
              onChange={(e) => setPhoneSecondary(e.target.value)}
              placeholder="+7 999 123-45-67"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "12px",
                border: "1px solid #d1d5db",
                padding: "0 14px",
                fontSize: "15px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                Уведомления в Telegram
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: "18px",
                }}
              >
                Получать сообщения о бронировании и обновлениях
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNotificationsEnabled((prev) => !prev)}
              style={{
                minWidth: "86px",
                height: "40px",
                border: "none",
                borderRadius: "999px",
                backgroundColor: notificationsEnabled ? "#2563eb" : "#d1d5db",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                padding: "0 14px",
              }}
            >
              {notificationsEnabled ? "Вкл" : "Выкл"}
            </button>
          </div>

          <div style={{ marginBottom: "20px" }}>
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
                fontSize: "16px",
                fontWeight: "600",
                color: "#111827",
                wordBreak: "break-word",
              }}
            >
              {user?.telegram_id || "Пока не получен"}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              width: "100%",
              height: "50px",
              border: "none",
              borderRadius: "14px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: "600",
              cursor: isSaving ? "default" : "pointer",
              opacity: isSaving ? 0.7 : 1,
              marginBottom: "12px",
            }}
          >
            {isSaving ? "Сохранение..." : "Сохранить изменения"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              width: "100%",
              height: "48px",
              border: "none",
              borderRadius: "14px",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              cursor: isDeleting ? "default" : "pointer",
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? "Удаление..." : "Удалить мои данные"}
          </button>
        </div>
      </div>
    </div>
  );
}
