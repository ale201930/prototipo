"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth, registrarAccion } from "../../../lib/firebase"; 
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function NuevoUsuario() {
  const [formData, setFormData] = useState({
    correo: "", 
    clave: "",
    nombres: "", 
    cedula: "", 
    telefono: "", 
    fechaNac: "", 
    nacionalidad: "Venezolana", 
    direccion: "",
    ficha: "", 
    rol: "Inspector", 
    cargo: "", 
    departamento: "", 
    fechaIngreso: "" 
  });
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (formData.clave.length < 6) return alert("La clave debe tener al menos 6 caracteres.");
    
    setCargando(true);
    try {
      const usuariosRef = collection(db, "usuarios");
      const cedulaForm = formData.cedula.trim();
      const fichaForm = formData.ficha.trim();

      // 1. VALIDACIÓN DE CÉDULA ÚNICA
      const qCedula = query(usuariosRef, where("cedula", "==", cedulaForm));
      const querySnapshotCedula = await getDocs(qCedula);
      
      if (!querySnapshotCedula.empty) {
        setCargando(false);
        return alert("⚠️ Error: Ya existe un colaborador registrado con esa Cédula de Identidad.");
      }

      // 2. VALIDACIÓN DE N° DE FICHA ÚNICA
      const qFicha = query(usuariosRef, where("ficha", "==", fichaForm));
      const querySnapshotFicha = await getDocs(qFicha);
      
      if (!querySnapshotFicha.empty) {
        setCargando(false);
        return alert("⚠️ Error: El Número de Ficha ya está asignado a otro trabajador de planta.");
      }

      // 3. Crear usuario en Firebase Auth
      const emailLimpio = formData.correo.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpio, formData.clave);
      const uid = userCredential.user.uid;

      // 4. Preparar datos para Firestore
      const datosParaGuardar = { ...formData };
      delete datosParaGuardar.clave;
      datosParaGuardar.correo = emailLimpio;
      datosParaGuardar.username = emailLimpio.split("@")[0];

      // 5. Guardar en la colección de usuarios
      await setDoc(doc(db, "usuarios", uid), {
        uid,
        ...datosParaGuardar,
        estado: "Activo",
        fechaRegistro: new Date().toISOString()
      });

      await registrarAccion(
        null, 
        null, 
        `Usuario registrado: ${formData.nombres || formData.correo} (${formData.rol})`, 
        "Control de Usuarios"
      );

      alert("✅ Personal registrado exitosamente");
      router.push("/administrador/usuarios"); 
    } catch (error) {
      console.error("Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Error: Este correo ya está registrado en el sistema.");
      } else {
        alert("Error al registrar: " + error.message);
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav no-print bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/administrador/usuarios")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-4xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            REGISTROS DE USUARIOS
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Módulo de Ingreso de nuevos colaboradores
          </p>
        </header>

        {/* FORMULARIO */}
        <form onSubmit={handleGuardar} className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/20 space-y-8 text-slate-800 relative shadow-neon-cyan">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          {/* SECCIÓN 1: CREDENCIALES */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2">
              <i className="fas fa-lock"></i> Credenciales de Acceso
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">CORREO INSTITUCIONAL</label>
                <input name="correo" type="email" placeholder="ejemplo@invecem.com" onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">CONTRASEÑA TEMPORAL</label>
                <input name="clave" type="password" placeholder="********" onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
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
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">NOMBRES Y APELLIDOS</label>
                <input name="nombres" type="text" placeholder="Ej: Juan Pérez" onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">CÉDULA DE IDENTIDAD</label>
                <input name="cedula" type="text" placeholder="Ej: V-12345678" onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">TELÉFONO</label>
                <input name="telefono" type="text" placeholder="Ej: 04121234567" onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">FECHA NACIMIENTO</label>
                <input name="fechaNac" type="date" onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold cursor-pointer shadow-sm" />
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
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">N° DE FICHA</label>
                <input name="ficha" type="text" placeholder="Ej: 554433" onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm font-mono" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">ROL DE SISTEMA</label>
                <select name="rol" onChange={handleChange} value={formData.rol} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold cursor-pointer shadow-sm">
                  <option value="Inspector">Inspector</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Proteccion Fisica">Protección Física</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">CARGO</label>
                <input name="cargo" type="text" placeholder="Ej: Cargo" onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">DEPARTAMENTO</label>
                <input name="departamento" type="text" placeholder="Ej: Operaciones" onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 text-sm font-semibold shadow-sm" />
              </div>
            </div>
            
            {/* CAMPO: FECHA DE INGRESO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">FECHA DE INGRESO A LA EMPRESA</label>
                <input 
                  name="fechaIngreso" 
                  type="date" 
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
            {cargando ? "Registrando..." : "Registrar en el Sistema"}
          </button>
        </form>
      </div>
    </div>
  );
}

