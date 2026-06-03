"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function VerUsuario() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("id"); // Agarramos el ID de la URL
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      const docRef = doc(db, "usuarios", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUser(docSnap.data());
      } else {
        alert("No se encontró el usuario");
        router.push("/administrador/usuarios");
      }
    };
    fetchUser();
  }, [userId, router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-black uppercase tracking-widest text-red-500 animate-pulse">
          <i className="fas fa-spinner fa-spin mr-2"></i> Cargando datos del personal...
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN SUPERIOR UNIFICADA */}
      <nav className="top-nav no-print bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/administrador/usuarios")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <div className="max-w-4xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE TÉCNICO */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            Expediente Digital
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Visualización detallada de datos maestros y credenciales del colaborador
          </p>
        </header>

        {/* TARJETA PRINCIPAL */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/20 text-slate-800 relative shadow-neon-cyan">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          {/* ESTATUS EN LA PARTE SUPERIOR DE LA TARJETA */}
          <div className="flex justify-between items-center mb-6">
            <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${user.estado === "Activo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
              ● {user.estado || "Activo"}
            </span>
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">{user.rol}</span>
          </div>

          {/* SECCIÓN 1: DATOS PERSONALES */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2">
              <i className="fas fa-id-card"></i> Datos Personales
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Nombres y Apellidos</label>
                <input type="text" value={user.nombres || user.usuario || ""} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Cédula de Identidad</label>
                <input type="text" value={user.cedula || ""} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Nacionalidad</label>
                <input type="text" value={user.nacionalidad || "No registrada"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Fecha de Nacimiento</label>
                <input type="text" value={user.fechaNac || "No registrada"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Teléfono de Contacto</label>
                <input type="text" value={user.telefono || "No registrado"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Correo Institucional</label>
                 <input type="text" value={user.correo || ""} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-indigo-600 font-semibold text-sm cursor-not-allowed" />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: INFORMACIÓN LABORAL */}
          <section className="space-y-6 mt-8">
            <h3 className="text-xs font-black uppercase text-purple-600 tracking-wider border-b border-dashed border-purple-500/20 pb-2 flex items-center gap-2">
              <i className="fas fa-briefcase"></i> Información Laboral
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">N° de Ficha</label>
                 <input type="text" value={user.ficha || "N/A"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-cyan-600 font-black text-sm font-mono cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Cargo / Puesto</label>
                <input type="text" value={user.cargo || "Sin cargo asignado"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 block">Departamento / Unidad</label>
                <input type="text" value={user.departamento || "Sin unidad asignada"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Fecha de Ingreso</label>
                <input type="text" value={user.fechaIngreso || "No registrada"} disabled className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed" />
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

