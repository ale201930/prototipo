"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function PresentacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [slide, setSlide] = useState(1);

  const totalSlides = 6;

  // Leer la diapositiva inicial desde los parámetros de búsqueda de la URL
  useEffect(() => {
    const slideParam = searchParams.get("slide");
    if (slideParam) {
      const parsed = parseInt(slideParam, 10);
      if (parsed >= 1 && parsed <= totalSlides) {
        setSlide(parsed);
      }
    }
  }, [searchParams]);

  // Manejar el cambio de diapositiva y actualizar la URL sin recargar
  const cambiarSlide = (nuevaSlide) => {
    if (nuevaSlide >= 1 && nuevaSlide <= totalSlides) {
      setSlide(nuevaSlide);
      const url = new URL(window.location.href);
      url.searchParams.set("slide", nuevaSlide);
      window.history.pushState({}, "", url.toString());
    }
  };

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (slide < totalSlides) cambiarSlide(slide + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (slide > 1) cambiarSlide(slide - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slide]);

  // Manejar clic en pantalla para avanzar diapositiva (excepto en botones/enlaces)
  const manejarClickPantalla = (e) => {
    if (e.target.closest("a") || e.target.closest("button")) {
      return;
    }
    if (slide < totalSlides) {
      cambiarSlide(slide + 1);
    }
  };

  return (
    <div 
      onClick={manejarClickPantalla}
      className="relative w-screen h-screen overflow-hidden bg-black flex items-center justify-center cursor-pointer select-none"
    >
      {/* Contenedor de la Diapositiva (mantiene proporción exacta 16:9 y se ajusta al viewport) */}
      <div className="relative w-full max-w-full max-h-full aspect-[16/9] flex items-center justify-center">
        <img
          key={slide}
          src={`/img/slide${slide}.png`}
          alt={`Diapositiva ${slide}`}
          className="w-full h-full object-contain animate-fadeIn"
          style={{ imageRendering: "auto" }}
        />

        {/* LÁMINA 4 (Prototipo del Sistema): Superposición del botón arriba y a la derecha */}
        {slide === 4 && (
          <div className="absolute bottom-[52%] left-[64%] transform -translate-x-1/2 z-20">
            <Link
              href="/login?presentation=true"
              onClick={() => {
                sessionStorage.setItem("fromPresentation", "true");
              }}
              className="relative group flex items-center gap-2.5 px-7 py-3.5 bg-[#0b1329]/95 hover:bg-[#111e3f] border-2 border-slate-400 hover:border-slate-200 text-slate-100 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer shadow-xl shadow-black/80"
            >
              {/* Brillo pasante animado */}
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine"></span>
              
              <i className="fa-solid fa-circle-play text-sm text-slate-350 group-hover:text-white transition-colors"></i>
              <span>Iniciar Demostración</span>
              <i className="fa-solid fa-arrow-right-long text-sm text-slate-350 group-hover:translate-x-0.5 transition-transform"></i>
            </Link>
          </div>
        )}
      </div>

      {/* Estilos adicionales personalizados locales */}
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          background-color: black;
          overflow: hidden;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-in-out forwards;
        }
        @keyframes shine {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shine {
          animation: shine 1.6s infinite;
        }
      `}</style>
    </div>
  );
}

export default function Presentacion() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-black text-cyan-400 font-mono text-sm">
        <i className="fa-solid fa-circle-notch animate-spin text-2xl mb-4"></i>
        <span>Cargando Presentación de Tesis...</span>
      </div>
    }>
      <PresentacionContent />
    </Suspense>
  );
}
