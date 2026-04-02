"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import OnboardingForm from "../components/OnboardingForm";
import HomeScreen from "../components/HomeScreen";
import { getTelegramUser, initTelegramApp } from "../lib/telegram";

export default function Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser, setTelegramUser] = useState(null);
  const [appUser, setAppUser] = useState(null);

  useEffect(() => {
    initTelegramApp();

    const user = getTelegramUser();
    setTelegramUser(user);

    const savedUser = localStorage.getItem("app_user");

    if (savedUser) {
      setAppUser(JSON.parse(savedUser));
    }

    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleSaveUser = (formData) => {
    const newUser = {
      telegram_id: telegramUser?.id || null,
      telegram_first_name: telegramUser?.first_name || "",
      telegram_last_name: telegramUser?.last_name || "",
      telegram_username: telegramUser?.username || "",
      name: formData.name,
      phone: formData.phone,
    };

    localStorage.setItem("app_user", JSON.stringify(newUser));
    setAppUser(newUser);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!appUser) {
    return <OnboardingForm onSave={handleSaveUser} />;
  }

  return <HomeScreen user={appUser} />;
}
