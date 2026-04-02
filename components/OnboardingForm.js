"use client";

import { useState } from "react";

export default function OnboardingForm({ onSave }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      alert("Пожалуйста, заполните имя и номер телефона");
      return;
    }

    onSave({
      name: name.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        backgroundColor: "#f5f7fb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          padding: "28px 22px",
          boxSizing: "border-box",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "24px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          Добро пожаловать
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            fontSize: "15px",
            lineHeight: "22px",
            color: "#6b7280",
          }}
        >
          Укажите имя и номер телефона для бронирования маршруток.
        </p>

        <form onSubmit={handleSubmit}>
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
              placeholder="Введите имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
              }}
            >
              Номер телефона
            </label>
            <input
              type="tel"
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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

          <button
            type="submit"
            style={{
              width: "100%",
              height: "50px",
              border: "none",
              borderRadius: "14px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
}
