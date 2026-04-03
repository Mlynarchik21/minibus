"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import OnboardingForm from "../components/OnboardingForm";
import HomeScreen from "../components/HomeScreen";
import ProfileScreen from "../components/ProfileScreen";
import { getTelegramUser, initTelegramApp } from "../lib/telegram";
import { supabase } from "../lib/supabase";

export default function Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser, setTelegramUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("home");

  useEffect(() => {
    const initApp = async () => {
      try {
        initTelegramApp();

        const user = getTelegramUser();
        setTelegramUser(user);

        if (user?.id) {
          await checkUser(user.id);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Ошибка при инициализации приложения:", error);
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  const checkUser = async (telegramId) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (error) {
        console.error("Ошибка при поиске пользователя:", error);
        setIsLoading(false);
        return;
      }

      if (data) {
        setAppUser(data);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Ошибка в checkUser:", error);
      setIsLoading(false);
    }
  };

  const handleSaveUser = async (formData) => {
    try {
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
        alert("Ошибка при сохранении пользователя");
        console.error("Ошибка при сохранении:", error);
        return;
      }

      setAppUser(data);
      setCurrentScreen("home");
    } catch (error) {
      alert("Произошла ошибка при сохранении");
      console.error("Ошибка в handleSaveUser:", error);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!appUser) {
    return <OnboardingForm onSave={handleSaveUser} />;
  }

  if (currentScreen === "profile") {
    return (
      <ProfileScreen
        user={appUser}
        onBack={() => setCurrentScreen("home")}
      />
    );
  }

  return (
    <HomeScreen
      user={appUser}
      onOpenProfile={() => setCurrentScreen("profile")}
    />
  );
}
