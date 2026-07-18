"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function PresentationReturn() {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [desplegado, setDesplegado] = useState(false);

  useEffect(() => {
    // Solo mostrar si venimos de la presentación
    const fromPresentation = sessionStorage.getItem("fromPresentation") === "true";
    
    // Ocultar si estamos en la presentación propiamente dicha o en la página de login
    const enPresentacion = pathname === "/presentacion" || pathname === "/login";
    
    setVisible(fromPresentation && !enPresentacion);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col items-start gap-2 no-print">
      {/* Menú de navegación rápida desplegable */}
      {desplegado && (
        <div className="bg-slate-950/95 border border-cyan-500/30 rounded-2xl p-3 shadow-2xl shadow-cyan-950/50 backdrop-blur-md mb-2 flex flex-col gap-1.5 animate-slideUp text-xs font-semibold uppercase tracking-wider text-slate-300 w-48">
          <span className="text-[10px] text-cyan-400 font-bold border-b border-slate-800 pb-1.5 mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-graduation-cap"></i> Modo Presentación
          </span>
          <button
            onClick={() => {
              router.push("/presentacion?slide=4");
              setDesplegado(false);
            }}
            className="flex items-center gap-2 px-2.5 py-2 hover:bg-cyan-950/40 hover:text-white rounded-lg text-left transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-laptop-code text-cyan-500"></i>
            <span>Volver a Lámina 4 (Demo)</span>
          </button>
          <button
            onClick={() => {
              router.push("/presentacion?slide=5");
              setDesplegado(false);
            }}
            className="flex items-center gap-2 px-2.5 py-2 hover:bg-cyan-950/40 hover:text-white rounded-lg text-left transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-list-check text-cyan-500"></i>
            <span>Ir a Conclusiones</span>
          </button>
          <button
            onClick={() => {
              router.push("/presentacion?slide=6");
              setDesplegado(false);
            }}
            className="flex items-center gap-2 px-2.5 py-2 hover:bg-cyan-950/40 hover:text-white rounded-lg text-left transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-heart text-cyan-500"></i>
            <span>Ir a Agradecimiento</span>
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("fromPresentation");
              setVisible(false);
            }}
            className="flex items-center gap-2 px-2.5 py-2 hover:bg-rose-950/30 hover:text-rose-400 rounded-lg text-left transition-colors mt-1 border-t border-slate-900 cursor-pointer"
          >
            <i className="fa-solid fa-circle-xmark text-rose-500"></i>
            <span>Desactivar Modo</span>
          </button>
        </div>
      )}

      {/* Botón Principal Flotante */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/presentacion?slide=5")}
          className="px-4 h-12 bg-gradient-to-r from-cyan-950 to-slate-950 text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:text-white rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-950/40 hover:shadow-cyan-950/60 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          title="Regresar a la Presentación (Conclusiones)"
        >
          <i className="fa-solid fa-arrow-left-long text-sm animate-pulse" />
          <span className="text-xs uppercase font-extrabold tracking-widest hidden sm:inline">
            Volver a Tesis
          </span>
        </button>

        {/* Botón de control del menú rápido */}
        <button
          onClick={() => setDesplegado(!desplegado)}
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-sm transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
            desplegado
              ? "bg-cyan-500 border-cyan-400 text-white shadow-cyan-500/30"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30"
          }`}
          title="Menú de Navegación de Tesis"
        >
          <i className={`fa-solid ${desplegado ? "fa-xmark" : "fa-bars-staggered"} transition-transform duration-300`} />
        </button>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
