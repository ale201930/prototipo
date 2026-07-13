"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, registrarAccion } from "../../../lib/firebase"; 
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditarUsuario() {
  const [formData, setFormData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("id");

  // 1. CARGAR LOS DATOS ACTUALES DEL USUARIO
  useEffect(() => {
    if (!userId) return;
    const cargarDatos = async () => {
      try {
        const docRef = doc(db, "usuarios", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data());
        } else {
          alert("No se encontró el expediente del usuario.");
          router.push("/administrador/usuarios");
        }
      } catch (error) {
        console.error("Error al cargar:", error);
      }
    };
    cargarDatos();
  }, [userId, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (name === "cedula") {
      val = val.replace(/\D/g, "").slice(0, 8);
    } else if (name === "telefono") {
      val = val.replace(/\D/g, "").slice(0, 11);
    }
    setFormData({ ...formData, [name]: val });
  };

  // 2. GUARDAR LOS CAMBIOS EN FIRESTORE
  const handleActualizar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const docRef = doc(db, "usuarios", userId);
      
      // Aseguramos de computar y guardar el username derivado del correo
      const datosActualizados = { ...formData };
      if (datosActualizados.correo) {
        datosActualizados.username = datosActualizados.correo.trim().toLowerCase().split("@")[0];
      }
      
      await updateDoc(docRef, datosActualizados);
      await registrarAccion(
        null, 
        null, 
        `Usuario modificado: ${formData.nombres || formData.correo || userId} (${formData.rol})`, 
        "Control de Usuarios"
      );
      alert("✅ Expediente actualizado correctamente");
      router.push("/administrador/usuarios");
    } catch (error) {
      console.error("Error al actualizar:", error);
      alert("Error al actualizar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  if (!formData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-black uppercase tracking-widest text-red-505 animate-pulse">
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
          onClick={() => router.back()}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-4xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE TÉCNICO */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            Modificar Expediente
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Actualización de datos maestros del colaborador en el sistema de planta
          </p>
        </header>

        {/* FORMULARIO */}
        <form onSubmit={handleActualizar} className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/20 space-y-8 text-slate-800 relative shadow-neon-cyan">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          {/* SECCIÓN 1: CREDENCIALES (Lectura) */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2">
              <i className="fas fa-lock"></i> Credenciales de Acceso
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">CORREO INSTITUCIONAL</label>
                <input 
                  name="correo" 
                  type="email" 
                  value={formData.correo || ""} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">UID DE SISTEMA</label>
                <input value={userId || ""} disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold text-sm cursor-not-allowed shadow-sm" />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: INFO PERSONAL */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-purple-600 tracking-wider border-b border-dashed border-purple-500/20 pb-2 flex items-center gap-2">
              <i className="fas fa-user-circle"></i> Información Personal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">NOMBRES Y APELLIDOS</label>
                <input name="nombres" type="text" value={formData.nombres || ""} onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">CÉDULA DE IDENTIDAD</label>
                <input name="cedula" type="text" value={formData.cedula || ""} maxLength={8} onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">TELÉFONO</label>
                <input name="telefono" type="text" value={formData.telefono || ""} maxLength={11} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">FECHA NACIMIENTO</label>
                <input name="fechaNac" type="date" value={formData.fechaNac || ""} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold cursor-pointer shadow-sm" />
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: FICHA LABORAL */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-indigo-600 tracking-wider border-b border-dashed border-indigo-500/20 pb-2 flex items-center gap-2">
              <i className="fas fa-briefcase"></i> Ficha Laboral de Planta
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">N° DE FICHA</label>
                <input name="ficha" type="text" value={formData.ficha || ""} onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm font-mono" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">ROL DE SISTEMA</label>
                <select name="rol" onChange={handleChange} value={formData.rol || "Inspector"} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold cursor-pointer shadow-sm">
                  <option value="Inspector">Inspector</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Proteccion Fisica">Protección Física</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">CARGO</label>
                <input name="cargo" type="text" value={formData.cargo || ""} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">DEPARTAMENTO</label>
                <input name="departamento" type="text" value={formData.departamento || ""} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
            </div>

            {/* FECHA DE INGRESO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-550">FECHA DE INGRESO A LA EMPRESA</label>
                <input 
                  name="fechaIngreso" 
                  type="date" 
                  value={formData.fechaIngreso || ""} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold cursor-pointer shadow-sm"
                />
              </div>
            </div>
          </section>

          <button 
            type="submit" 
            className="w-full py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-purple transition-all duration-200 transform cursor-pointer flex items-center justify-center gap-2"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Actualizando...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Guardar Cambios en el Expediente
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

