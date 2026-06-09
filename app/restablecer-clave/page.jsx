"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, registrarAccion } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function RestablecerClaveContent() {
  const [usuario, setUsuario] = useState(null);
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");

  useEffect(() => {
    if (!uid) {
      setError("Enlace de restablecimiento inválido o expirado.");
      return;
    }

    const cargarUsuario = async () => {
      try {
        const docRef = doc(db, "usuarios", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUsuario(docSnap.data());
        } else {
          setError("El usuario solicitado no existe en el sistema.");
        }
      } catch (err) {
        console.error("Error al cargar usuario:", err);
        setError("Error de conexión con el sistema.");
      }
    };

    cargarUsuario();
  }, [uid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (nuevaClave.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nuevaClave !== confirmarClave) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    try {
      const { updatePassword } = await import("../lib/firebase-mock");
      await updatePassword({ uid }, nuevaClave);

      await registrarAccion(
        usuario?.nombres || usuario?.correo || "Usuario",
        usuario?.rol || "Invitado",
        "Restablecimiento de contraseña por correo exitoso",
        "Acceso"
      );

      setExito(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      console.error("Error al guardar clave:", err);
      setError("Error al restablecer la contraseña: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="theme-dark min-h-screen w-full flex items-center justify-center p-6 md:p-12" style={{ fontFamily: "'Inter', sans-serif", background: "var(--bg-main)" }}>
      <div className="w-full max-w-md animate-fade-in">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center animate-glow-ring"
            style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
            <i className="fas fa-fingerprint text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-black text-white">INVECEM</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Restablecer Contraseña de Acceso</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10"
          style={{ boxShadow: "0 20px 60px rgba(15,23,42,0.15), 0 1px 3px rgba(15,23,42,0.05)" }}>
          
          {error && (
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                <i className="fas fa-triangle-exclamation text-rose-500 text-sm flex-shrink-0" />
                <p>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Volver al Inicio de Sesión
              </button>
            </div>
          )}

          {exito && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-450 animate-bounce">
                <i className="fas fa-check-double text-2xl" />
              </div>
              <h3 className="text-lg font-black text-white">¡Contraseña Cambiada!</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Tu contraseña ha sido restablecida correctamente. Serás redirigido al login en unos instantes...
              </p>
            </div>
          )}

          {!error && !exito && usuario && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Colaborador</p>
                <p className="text-sm font-extrabold text-cyan-400 uppercase">{usuario.nombres}</p>
                <p className="text-xxs text-slate-400 mt-0.5">{usuario.correo}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-key text-cyan-500 text-[11px]" />
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-semibold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-500 transition-colors cursor-pointer"
                  >
                    <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-key text-cyan-500 text-[11px]" />
                  Confirmar Contraseña
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Repita la nueva contraseña"
                  value={confirmarClave}
                  onChange={(e) => setConfirmarClave(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-900/40 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-semibold text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-neon-cyan active:scale-95 text-white font-extrabold uppercase text-xs tracking-widest rounded-xl transition-all duration-200 transform cursor-pointer flex items-center justify-center gap-2"
              >
                {cargando ? "Guardando..." : "Restablecer Contraseña"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

export default function RestablecerClave() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <i className="fas fa-spinner fa-spin mr-2"></i> Cargando...
      </div>
    }>
      <RestablecerClaveContent />
    </Suspense>
  );
}
