"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function ChevronIcon({ open }) {
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

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7.5 4H10L11.2 7.5L9.7 9C10.4 10.4 11.6 11.6 13 12.3L14.5 10.8L18 12V14.5C18 15.3 17.3 16 16.5 16C9.6 16 4 10.4 4 3.5C4 2.7 4.7 2 5.5 2H8L7.5 4Z"
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

function Section({
  icon,
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  defaultOpen = false,
}) {
  const open = isOpen ?? defaultOpen;

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        boxShadow: "0 6px 20px rgba(17,24,39,0.06)",
        overflow: "hidden",
        marginBottom: "12px",
        border: "1px solid #eef2f7",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
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
            flex: 1,
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

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#111827",
                marginBottom: subtitle ? "2px" : 0,
              }}
            >
              {title}
            </div>

            {subtitle ? (
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: "18px",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            padding: "0 16px 16px 16px",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        padding: "10px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#111827",
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function SettingRow({ title, subtitle, value, onChange, disabled = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "14px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#111827",
            marginBottom: subtitle ? "3px" : 0,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              lineHeight: "17px",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <Toggle checked={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function ProfileScreen({
  user,
  recentTrips = [],
  contacts = {
    dispatcherPhone: "+7 (999) 000-00-00",
    workTime: "Ежедневно с 08:00 до 22:00",
    email: "support@example.com",
    feedbackUrl: "https://t.me/your_support_bot",
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

  const userId = useMemo(() => {
    return user?.telegram_id || user?.id || "Не найден";
  }, [user]);

  const toggleSection = (key) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || !phone.trim()) {
      alert("Заполни имя и основной номер телефона");
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
        background: "#f5f7fb",
        padding: "16px 14px 28px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "540px",
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
              background: "#ffffff",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              cursor: "pointer",
              fontSize: "18px",
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
                fontWeight: 800,
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
              Данные пользователя и настройки
            </div>
          </div>
        </div>

        {/* Верхний блок профиля */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "22px",
            boxShadow: "0 8px 28px rgba(17,24,39,0.06)",
            padding: "18px",
            marginBottom: "14px",
            border: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "62px",
                height: "62px",
                borderRadius: "50%",
                background: "#f3f4f6",
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
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: "24px",
                  wordBreak: "break-word",
                }}
              >
                {user?.name || "Пользователь"}
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Профиль пассажира
              </div>
            </div>
          </div>

          <InfoRow label="ID" value={userId} />
          <InfoRow label="Имя" value={user?.name || "Не указано"} />
          <InfoRow label="Телефон" value={user?.phone || "Не указан"} />
        </div>

        {/* История поездок */}
        <Section
          icon={<ClockIcon />}
          title="История поездок"
          subtitle="Последние поездки и переход ко всей истории"
          isOpen={openSection === "history"}
          onToggle={() => toggleSection("history")}
        >
          <div style={{ paddingTop: "6px" }}>
            {recentTrips.length === 0 ? (
              <div
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  padding: "8px 0 14px",
                }}
              >
                Пока нет поездок
              </div>
            ) : (
              <div style={{ marginBottom: "14px" }}>
                {recentTrips.slice(0, 3).map((trip, index) => (
                  <div
                    key={trip.id || index}
                    style={{
                      padding: "12px 0",
                      borderBottom:
                        index !== Math.min(recentTrips.length, 3) - 1
                          ? "1px solid #f3f4f6"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: "4px",
                      }}
                    >
                      {trip.route || "Маршрут"}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#6b7280",
                        marginBottom: "2px",
                      }}
                    >
                      {trip.date || "Дата не указана"} {trip.time ? `• ${trip.time}` : ""}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#6b7280",
                      }}
                    >
                      {trip.status || "Завершено"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/history"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "14px",
                background: "#111827",
                color: "#ffffff",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Все поездки
            </Link>
          </div>
        </Section>

        {/* Уведомления */}
        <Section
          icon={<BellIcon />}
          title="Настройки уведомлений"
          subtitle="Управление Telegram-уведомлениями"
          isOpen={openSection === "notifications"}
          onToggle={() => toggleSection("notifications")}
        >
          <div style={{ paddingTop: "6px" }}>
            <SettingRow
              title="Все уведомления"
              subtitle="Главный переключатель всех уведомлений"
              value={allNotifications}
              onChange={handleToggleAllNotifications}
            />

            <SettingRow
              title="Уведомления о бронировании"
              value={bookingNotifications}
              onChange={() => setBookingNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Уведомления об изменении"
              value={changeNotifications}
              onChange={() => setChangeNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Уведомления об отмене бронирования"
              value={cancelNotifications}
              onChange={() => setCancelNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Перенос или отмена рейсов"
              value={tripStatusNotifications}
              onChange={() => setTripStatusNotifications((prev) => !prev)}
              disabled={!allNotifications}
            />

            <SettingRow
              title="Напоминание за 1 час"
              subtitle="Напоминание перед отправлением"
              value={oneHourReminder}
              onChange={() => setOneHourReminder((prev) => !prev)}
              disabled={!allNotifications}
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
                  background: "#111827",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isSavingNotifications ? "default" : "pointer",
                  opacity: isSavingNotifications ? 0.7 : 1,
                }}
              >
                {isSavingNotifications
                  ? "Сохранение..."
                  : "Сохранить настройки"}
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
                  background: "#ffffff",
                  color: "#111827",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isSendingTest ? "default" : "pointer",
                  opacity: isSendingTest ? 0.7 : 1,
                }}
              >
                {isSendingTest ? "Отправка..." : "Тест уведомления"}
              </button>
            </div>
          </div>
        </Section>

        {/* Профиль */}
        <Section
          icon={<EditIcon />}
          title="Настройки профиля"
          subtitle="Изменение имени и номера телефона"
          isOpen={openSection === "profile"}
          onToggle={() => toggleSection("profile")}
        >
          <div style={{ paddingTop: "12px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
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
                  background: "#ffffff",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                Основной номер телефона
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
                  background: "#ffffff",
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
                background: "#111827",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 700,
                cursor: isSavingProfile ? "default" : "pointer",
                opacity: isSavingProfile ? 0.7 : 1,
              }}
            >
              {isSavingProfile ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </Section>

        {/* Контакты */}
        <Section
          icon={<PhoneIcon />}
          title="Контакты для связи"
          subtitle="Диспетчер, время работы, почта и форма обратной связи"
          isOpen={openSection === "contacts"}
          onToggle={() => toggleSection("contacts")}
        >
          <div style={{ paddingTop: "6px" }}>
            <InfoRow label="Номер диспетчера" value={contacts.dispatcherPhone} />
            <InfoRow label="Время работы" value={contacts.workTime} />
            <InfoRow label="Почта" value={contacts.email} />

            <a
              href={contacts.feedbackUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                marginTop: "14px",
                width: "100%",
                height: "46px",
                borderRadius: "14px",
                background: "#111827",
                color: "#ffffff",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Форма для связи
            </a>
          </div>
        </Section>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            width: "100%",
            height: "50px",
            borderRadius: "16px",
            border: "none",
            background: "#dc2626",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 700,
            cursor: isDeleting ? "default" : "pointer",
            opacity: isDeleting ? 0.7 : 1,
            marginTop: "6px",
          }}
        >
          {isDeleting ? "Удаление..." : "Удалить профиль"}
        </button>
      </div>
    </div>
  );
}