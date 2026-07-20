"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ThemeToggle() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read from localStorage or documentElement class
    const savedTheme = localStorage.getItem("theme");
    const htmlHasDark = document.documentElement.classList.contains("theme-dark");
    
    if (savedTheme === "dark" || (!savedTheme && htmlHasDark)) {
      setIsDark(true);
      document.documentElement.classList.add("theme-dark", "dark");
      document.body.classList.add("theme-dark", "dark");
    } else {
      setIsDark(false);
      document.documentElement.classList.remove("theme-dark", "dark");
      document.body.classList.remove("theme-dark", "dark");
    }
  }, []);

  // No mostrar el botón flotante de tema en la pantalla de login
  if (pathname === "/login") {
    return null;
  }

  const handleToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("theme-dark", "dark");
      document.body.classList.add("theme-dark", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("theme-dark", "dark");
      document.body.classList.remove("theme-dark", "dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="fixed bottom-6 right-6 z-[9999] w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer no-print"
      style={{
        background: isDark ? "linear-gradient(135deg, #1e293b, #0f172a)" : "linear-gradient(135deg, #ffffff, #f1f5f9)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.1)",
        color: isDark ? "#fbbf24" : "#4f46e5",
        boxShadow: isDark 
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(251, 191, 36, 0.15)" 
          : "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 0 15px rgba(79, 70, 229, 0.1)",
      }}
      title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
    >
      <i className={`fas ${isDark ? "fa-sun text-lg" : "fa-moon text-lg"} transition-transform duration-500 ${isDark ? "rotate-90" : "rotate-0"}`} />
    </button>
  );
}
