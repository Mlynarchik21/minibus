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
        phone_secondary: "",
        notifications_enabled: true,
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

  const handleUpdateProfile = async (updatedData) => {
    try {
      if (!appUser?.id) {
        alert("Пользователь не найден");
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .update({
          name: updatedData.name,
          phone: updatedData.phone,
          phone_secondary: updatedData.phone_secondary || null,
          notifications_enabled: updatedData.notifications_enabled,
        })
        .eq("id", appUser.id)
        .select()
        .single();

      if (error) {
        console.error("Ошибка при обновлении профиля:", error);
        alert("Не удалось сохранить изменения");
        return;
      }

      setAppUser(data);
      alert("Профиль обновлён");
    } catch (error) {
      console.error("Ошибка в handleUpdateProfile:", error);
      alert("Ошибка при обновлении профиля");
    }
  };

  const handleDeleteProfile = async () => {
    try {
      if (!appUser?.id) {
        alert("Пользователь не найден");
        return;
      }

      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", appUser.id);

      if (error) {
        console.error("Ошибка при удалении профиля:", error);
        alert("Не удалось удалить профиль");
        return;
      }

      setAppUser(null);
      setCurrentScreen("home");
      alert("Профиль удалён");
    } catch (error) {
      console.error("Ошибка в handleDeleteProfile:", error);
      alert("Ошибка при удалении профиля");
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
        onSave={handleUpdateProfile}
        onDelete={handleDeleteProfile}
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
