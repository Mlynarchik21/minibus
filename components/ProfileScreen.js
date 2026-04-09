"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function ChevronIcon({ open = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="#6b7280"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileAvatarIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="#111827" strokeWidth="1.8" />
      <path
        d="M4 19C5.8 15.8 8.4 14.2 12 14.2C15.6 14.2 18.2 15.8 20 19"
        stroke="#111827"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="#6b7280" strokeWidth="1.7" />
      <path
        d="M12 8V12L14.5 14"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 18C14.7 19.2 13.5 20 12 20C10.5 20 9.3 19.2 9 18"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18 16H6C7 14.8 7.5 13.3 7.5 11.5V10.5C7.5 8 9.2 6 12 6C14.8 6 16.5 8 16.5 10.5V11.5C16.5 13.3 17 14.8 18 16Z"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20H8L18 10C18.8 9.2 18.8 7.9 18 7.1L16.9 6C16.1 5.2 14.8 5.2 14 6L4 16V20Z"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 10.5C8 8.01472 10.0147 6 12.5 6C14.9853 6 17 8.01472 17 10.5V11.5C17 12.0523 17.4477 12.5 18 12.5C18.5523 12.5 19 12.9477 19 13.5V14.5C19 15.6046 18.1046 16.5 17 16.5H16"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8 16.5H7C5.89543 16.5 5 15.6046 5 14.5V13.5C5 12.9477 5.44772 12.5 6 12.5C6.55228 12.5 7 12.0523 7 11.5V10.5"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 18.5H13.5"
        stroke="#6b7280"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon({ copied }) {
  if (copied) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5L9.5 17L19 7.5"
          stroke="#16a34a"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="9"
        y="9"
        width="10"
        height="10"
        rx="2"
        stroke="#6b7280"
        strokeWidth="1.8"
      />
      <path
        d="M15 9V7C15 5.89543 14.1046 5 13 5H7C5.89543 5 5 5.89543 5 7V13C5 14.1046 5.89543 15 7 15H9"
        stroke="#6b7280"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{
        width: "50px",
        height: "30px",
        borderRadius: "999px",
        border: "none",
        background: checked ? "#111827" : "#d1d5db",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.2s ease",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "23px" : "3px",
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: "#ffffff",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
        }}
      />
    </button>
  );
}

function MenuLinkRow({ icon, title, href }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "16px",
        color: "#111827",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {title}
        </div>
      </div>

      <ChevronIcon />
    </Link>
  );
}

function AccordionSection({ icon, title, isOpen, onToggle, children, hasBorder = true }) {
  return (
    <div
      style={{
        borderBottom: hasBorder ? "1px solid #f1f5f9" : "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "16px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {title}
          </div>
        </div>

        <ChevronIcon open={isOpen} />
      </button>

      <div
        style={{
          maxHeight: isOpen ? "800px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.28s ease",
        }}
      >
        <div
          style={{
            padding: "0 16px 16px 16px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ title, value, onChange, disabled = false, noBorder = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "14px 0",
        borderBottom: noBorder ? "none" : "1px solid #f3f4f6",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#111827",
          lineHeight: "20px",
        }}
      >
        {title}
      </div>

      <Toggle checked={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function ProfileScreen({
  user,
  recentTrips = [],
  contacts = {
    dispatcherPhone: "+7 999 000-00-00",
    workTime: "08:00–22:00",
    email: "support@minibus.ru",
    feedbackUrl: "https://t.me/your_bot",
  },
  onBack,
  onSave,
  onDelete,
  onSendTestNotification,
}) {
  const [openSection, setOpenSection] = useState(null);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const [allNotifications, setAllNotifications] = useState(
    user?.notifications_enabled ?? true
  );
  const [bookingNotifications, setBookingNotifications] = useState(
    user?.notify_booking ?? true
  );
  const [changeNotifications, setChangeNotifications] = useState(
    user?.notify_changes ?? true
  );
  const [cancelNotifications, setCancelNotifications] = useState(
    user?.notify_cancelled ?? true
  );
  const [tripStatusNotifications, setTripStatusNotifications] = useState(
    user?.notify_trip_status ?? true
  );
  const [oneHourReminder, setOneHourReminder] = useState(
    user?.notify_before_one_hour ?? true
  );

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;

    const timer = setTimeout(() => {
      setIsCopied(false);
    }, 1400);

    return () => clearTimeout(timer);
  }, [isCopied]);

  const toggleSection = (key) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  const handleCopyId = async () => {
    const id = String(user?.telegram_id || user?.id || "").trim();

    if (!id) {
      alert("ID пользователя не найден");
      return;
    }

    try {
      await navigator.clipboard.writeText(id);
      setIsCopied(true);
    } catch (error) {
      console.error("Ошибка копирования ID:", error);
      alert("Не удалось скопировать ID");
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || !phone.trim()) {
      alert("Заполни имя и номер телефона");
      return;
    }

    try {
      setIsSavingProfile(true);

      await onSave?.({
        name: name.trim(),
        phone: phone.trim(),
      });
    } catch (error) {
      console.error("Ошибка сохранения профиля:", error);
      alert("Не удалось сохранить профиль");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSavingNotifications(true);

      await onSave?.({
        notifications_enabled: allNotifications,
        notify_booking: bookingNotifications,
        notify_changes: changeNotifications,
        notify_cancelled: cancelNotifications,
        notify_trip_status: tripStatusNotifications,
        notify_before_one_hour: oneHourReminder,
      });
    } catch (error) {
      console.error("Ошибка сохранения уведомлений:", error);
      alert("Не удалось сохранить настройки уведомлений");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Вы уверены, что хотите удалить профиль? Это действие нельзя отменить."
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await onDelete?.();
    } catch (error) {
      console.error("Ошибка удаления профиля:", error);
      alert("Не удалось удалить профиль");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user?.telegram_id) {
      alert("ID пользователя не найден");
      return;
    }

    try {
      setIsSendingTest(true);
      await onSendTestNotification?.();
    } catch (error) {
      console.error("Ошибка тестового уведомления:", error);
      alert("Не удалось отправить тестовое уведомление");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggleAllNotifications = () => {
    const next = !allNotifications;

    setAllNotifications(next);
    setBookingNotifications(next);
    setChangeNotifications(next);
    setCancelNotifications(next);
    setTripStatusNotifications(next);
    setOneHourReminder(next);
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
            marginBottom: "16px",
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
              color: "#111827",
              flexShrink: 0,
            }}
          >
            ←
          </button>

          <div>
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

            <div
              style={{
                marginTop: "2px",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              Управление аккаунтом
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            marginBottom: "14px",
            border: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: "20px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "16px",
              lineHeight: "26px",
              wordBreak: "break-word",
            }}
          >
            {user?.name || "Пользователь"}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "62px",
                height: "62px",
                borderRadius: "50%",
                backgroundColor: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ProfileAvatarIcon />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#111827",
                  lineHeight: "22px",
                  wordBreak: "break-word",
                }}
              >
                {user?.phone || "Номер телефона не указан"}
              </div>

              <div
                style={{
                  marginTop: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    lineHeight: "18px",
                    wordBreak: "break-word",
                  }}
                >
                  ID: {user?.telegram_id || user?.id || "—"}
                </div>

                <button
                  type="button"
                  onClick={handleCopyId}
                  aria-label="Скопировать ID"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: isCopied ? "#dcfce7" : "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    transform: isCopied ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <CopyIcon copied={isCopied} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
            overflow: "hidden",
            marginBottom: "14px",
          }}
        >
          <MenuLinkRow
            icon={<ClockIcon />}
            title="История поездок"
            href="/history"
          />

          <AccordionSection
            icon={<BellIcon />}
            title="Настройки уведомлений"
            isOpen={openSection === "notifications"}
            onToggle={() => toggleSection("notifications")}
          >
            <SettingRow
              title="Все уведомления"
              value={allNotifications}
              onChange={handleToggleAllNotifications}
            />

            <SettingRow
              title="Подтверждение бронирования"
              value={bookingNotifications}
              onChange={() => setBookingNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Изменения по бронированию"
              value={changeNotifications}
              onChange={() => setChangeNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Отмена бронирования"
              value={cancelNotifications}
              onChange={() => setCancelNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Перенос или отмена рейса"
              value={tripStatusNotifications}
              onChange={() => setTripStatusNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Напоминание за 1 час до отправления"
              value={oneHourReminder}
              onChange={() => setOneHourReminder((prev) => !prev)}
              disabled={!allNotifications}
              noBorder
            />

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "16px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={isSavingNotifications}
                style={{
                  flex: 1,
                  minWidth: "180px",
                  height: "46px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#111827",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: isSavingNotifications ? "default" : "pointer",
                  opacity: isSavingNotifications ? 0.7 : 1,
                }}
              >
                {isSavingNotifications ? "Сохранение..." : "Сохранить"}
              </button>

              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={isSendingTest}
                style={{
                  flex: 1,
                  minWidth: "180px",
                  height: "46px",
                  borderRadius: "14px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: isSendingTest ? "default" : "pointer",
                  opacity: isSendingTest ? 0.7 : 1,
                }}
              >
                {isSendingTest ? "Отправка..." : "Тест уведомления"}
              </button>
            </div>
          </AccordionSection>

          <AccordionSection
            icon={<EditIcon />}
            title="Настройки профиля"
            isOpen={openSection === "profile"}
            onToggle={() => toggleSection("profile")}
          >
            <div style={{ paddingTop: "4px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
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
                    borderRadius: "14px",
                    border: "1px solid #d1d5db",
                    padding: "0 14px",
                    fontSize: "15px",
                    boxSizing: "border-box",
                    outline: "none",
                    backgroundColor: "#ffffff",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#374151",
                  }}
                >
                  Номер телефона
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  style={{
                    width: "100%",
                    height: "48px",
                    borderRadius: "14px",
                    border: "1px solid #d1d5db",
                    padding: "0 14px",
                    fontSize: "15px",
                    boxSizing: "border-box",
                    outline: "none",
                    backgroundColor: "#ffffff",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                style={{
                  width: "100%",
                  height: "48px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#111827",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: isSavingProfile ? "default" : "pointer",
                  opacity: isSavingProfile ? 0.7 : 1,
                }}
              >
                {isSavingProfile ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </AccordionSection>

          <MenuLinkRow
            icon={<SupportIcon />}
            title="Служба поддержки"
            href="/support"
          />
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            width: "100%",
            height: "50px",
            border: "none",
            borderRadius: "16px",
            backgroundColor: "#dc2626",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: "700",
            cursor: isDeleting ? "default" : "pointer",
            opacity: isDeleting ? 0.7 : 1,
            boxShadow: "0 8px 24px rgba(220,38,38,0.18)",
          }}
        >
          {isDeleting ? "Удаление..." : "Удалить профиль"}
        </button>
      </div>
    </div>
  );
}
