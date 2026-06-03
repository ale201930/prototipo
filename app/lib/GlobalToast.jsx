"use client";

import React, { useState, useEffect } from "react";

export default function GlobalToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Save the original alert function
    const originalAlert = window.alert;

    // Override window.alert
    window.alert = (message) => {
      // Generate unique ID
      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      
      // Determine type based on emojis or keywords in the message
      let type = "info";
      let cleanMessage = message || "";
      let icon = "fa-circle-info";

      if (cleanMessage.startsWith("✅")) {
        type = "success";
        cleanMessage = cleanMessage.replace("✅", "").trim();
        icon = "fa-circle-check";
      } else if (cleanMessage.startsWith("⚠️")) {
        type = "warning";
        cleanMessage = cleanMessage.replace("⚠️", "").trim();
        icon = "fa-triangle-exclamation";
      } else if (cleanMessage.startsWith("❌") || cleanMessage.startsWith("🚫") || cleanMessage.toLowerCase().includes("error")) {
        type = "error";
        cleanMessage = cleanMessage.replace("❌", "").replace("🚫", "").trim();
        icon = "fa-circle-xmark";
      } else if (cleanMessage.startsWith("🔑") || cleanMessage.startsWith("🔒") || cleanMessage.startsWith("🔑")) {
        type = "security";
        cleanMessage = cleanMessage.replace("🔑", "").replace("🔒", "").trim();
        icon = "fa-key";
      }

      // Add to state
      setToasts((prev) => [...prev, { id, message: cleanMessage, type, icon }]);

      // Auto-remove after 4.5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);

      // Log to console so developer can still see it
      console.log(`[Alert Intercepted]: ${message}`);
    };

    return () => {
      // Restore original alert on unmount
      window.alert = originalAlert;
    };
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        // Theme styling classes
        let typeClasses = "";
        let iconColor = "";
        let borderGlow = "";

        switch (t.type) {
          case "success":
            typeClasses = "bg-slate-900/90 border-emerald-500/30 text-slate-100";
            iconColor = "text-emerald-400";
            borderGlow = "shadow-[0_0_15px_rgba(16,185,129,0.15)]";
            break;
          case "warning":
            typeClasses = "bg-slate-900/90 border-amber-500/30 text-slate-100";
            iconColor = "text-amber-400";
            borderGlow = "shadow-[0_0_15px_rgba(245,158,11,0.15)]";
            break;
          case "error":
            typeClasses = "bg-slate-900/90 border-rose-500/30 text-slate-100";
            iconColor = "text-rose-400";
            borderGlow = "shadow-[0_0_15px_rgba(244,63,94,0.15)]";
            break;
          case "security":
            typeClasses = "bg-slate-900/90 border-cyan-500/30 text-slate-100";
            iconColor = "text-cyan-400";
            borderGlow = "shadow-[0_0_15px_rgba(6,182,212,0.15)]";
            break;
          default:
            typeClasses = "bg-slate-900/90 border-blue-500/30 text-slate-100";
            iconColor = "text-blue-400";
            borderGlow = "shadow-[0_0_15px_rgba(59,130,246,0.15)]";
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 transform translate-x-0 animate-slide-up ${typeClasses} ${borderGlow}`}
            style={{
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            {/* Left Status Icon */}
            <div className={`text-lg flex-shrink-0 mt-0.5 ${iconColor}`}>
              <i className={`fas ${t.icon}`} />
            </div>

            {/* Notification Text */}
            <div className="flex-grow">
              <p className="text-xs font-semibold leading-relaxed tracking-wide">
                {t.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0 text-xs ml-1"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
