"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import OnboardingForm from "../components/OnboardingForm";
import HomeScreen from "../components/HomeScreen";
import { getTelegramUser, initTelegramApp } from "../lib/telegram";
import { supabase } from "../lib/supabase";

export default function Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser, setTelegramUser] = useState(null);
  const [appUser, setAppUser] = useState(null);

  useEffect(() => {
    initTelegramApp();

    const user = getTelegramUser();
    setTelegramUser(user);

    if (user?.id) {
      checkUser(user.id);
    } else {
      setIsLoading(false);
    }
  }, []);

  const checkUser = async (telegramId) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (data) {
      setAppUser(data);
    }

    setIsLoading(false);
  };

  const handleSaveUser = async (formData) => {
    const newUser = {
      telegram_id: telegramUser?.id || null,
      name: formData.name,
      phone: formData.phone,
    };

    const { data, error } = await supabase
      .from("users")
      .insert([newUser])
      .select()
      .single();

    if (error) {
      alert("Ошибка при сохранении");
      console.error(error);
      return;
    }

    setAppUser(data);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!appUser) {
    return <OnboardingForm onSave={handleSaveUser} />;
  }

  return <HomeScreen user={appUser} />;
}
