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
    let mounted = true;

    async function initApp() {
      try {
        initTelegramApp();

        const user = getTelegramUser();
        if (!mounted) return;

        setTelegramUser(user || null);

        if (user?.id) {
          await checkUser(user.id, mounted);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Ошибка при инициализации приложения:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initApp();

    return () => {
      mounted = false;
    };
  }, []);

  async function checkUser(telegramId, mounted = true) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (error) {
        console.error("Ошибка при поиске пользователя:", error);
        if (mounted) setIsLoading(false);
        return;
      }

      if (data && mounted) {
        setAppUser(data);
      }

      if (mounted) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Ошибка в checkUser:", error);
      if (mounted) {
        setIsLoading(false);
      }
    }
  }

  async function handleSaveUser(formData) {
    try {
      if (!telegramUser?.id) {
        alert("Не удалось получить Telegram ID");
        return;
      }

      const newUser = {
        telegram_id: telegramUser.id,
        name: String(formData?.name || "").trim(),
        phone: String(formData?.phone || "").trim(),
        phone_secondary: "",
        notifications_enabled: true,
        bot_started: true,
        broadcast_enabled: true,
        bot_blocked: false,
        telegram_username: telegramUser?.username || null,
      };

      const { data, error } = await supabase
        .from("users")
        .insert([newUser])
        .select()
        .single();

      if (error) {
        console.error("Ошибка при сохранении:", error);
        alert("Ошибка при сохранении пользователя");
        return;
      }

      setAppUser(data);
      setCurrentScreen("home");
    } catch (error) {
      console.error("Ошибка в handleSaveUser:", error);
      alert("Произошла ошибка при сохранении");
    }
  }

  async function handleUpdateProfile(updatedData) {
    try {
      if (!appUser?.id) {
        alert("Пользователь не найден");
        return;
      }

      const payload = {
        name: String(updatedData?.name || "").trim(),
        phone: String(updatedData?.phone || "").trim(),
        phone_secondary: updatedData?.phone_secondary
          ? String(updatedData.phone_secondary).trim()
          : null,
        notifications_enabled: Boolean(updatedData?.notifications_enabled),
      };

      const { data, error } = await supabase
        .from("users")
        .update(payload)
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
  }

  async function handleDeleteProfile() {
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
  }

  async function handleSendTestNotification() {
    try {
      if (!appUser?.telegram_id) {
        alert("Telegram ID не найден");
        return;
      }

      if (appUser?.notifications_enabled === false) {
        alert("Уведомления выключены в профиле");
        return;
      }

      const response = await fetch("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramId: appUser.telegram_id,
          text: "🚀 Это тестовое уведомление из MiniBus",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("Ошибка отправки уведомления:", result);
        alert("Не удалось отправить тестовое уведомление");
        return;
      }

      alert("Тестовое уведомление отправлено");
    } catch (error) {
      console.error("Ошибка в handleSendTestNotification:", error);
      alert("Ошибка при отправке тестового уведомления");
    }
  }

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
        onSendTestNotification={handleSendTestNotification}
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
