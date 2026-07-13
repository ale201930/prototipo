"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function PerfilUsuario() {
  const [userData, setUserData] = useState(null);

  const [claveActual, setClaveActual] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");

  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [claveParaCorreo, setClaveParaCorreo] = useState("");
  const [cargandoCorreo, setCargandoCorreo] = useState(false);
  const [verClaveCorreo, setVerClaveCorreo] = useState(false);

  const [cargando, setCargando] = useState(false);

  const [verClaveActual, setVerClaveActual] = useState(false);
  const [verNuevaClave, setVerNuevaClave] = useState(false);
  const [verConfirmarClave, setVerConfirmarClave] = useState(false);

  const [validaciones, setValidaciones] = useState({
    longitud: false,
    mayuscula: false,
    minuscula: false,
    numero: false,
    coincide: false
  });

  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        if (typeof user.reload === "function") {
          try {
            await user.reload();
          } catch (reloadErr) {
            console.warn("No se pudo recargar el estado del usuario Auth:", reloadErr);
          }
        }
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          let data = docSnap.data();
          
          // Sincronizar el correo en Firestore si se cambió y verificó en Firebase Auth
          if (user.email && data.correo !== user.email) {
            const emailLimpio = user.email.toLowerCase();
            const usernameExtracted = emailLimpio.split("@")[0];
            try {
              await updateDoc(docRef, {
                correo: emailLimpio,
                username: usernameExtracted
              });
              data = { ...data, correo: emailLimpio, username: usernameExtracted };
            } catch (syncErr) {
              console.error("Error al sincronizar correo verificado:", syncErr);
            }
          }

          setUserData(data);
          
          // Inicializar username si no existe en Firestore
          if (!data.username && data.correo) {
            const usernameExtracted = data.correo.split("@")[0];
            try {
              await updateDoc(docRef, { username: usernameExtracted });
              setUserData(prev => prev ? { ...prev, username: usernameExtracted } : null);
            } catch (err) {
              console.error("Error al inicializar username:", err);
            }
          }
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    setValidaciones({
      longitud: nuevaClave.length >= 8,
      mayuscula: /[A-Z]/.test(nuevaClave),
      minuscula: /[a-z]/.test(nuevaClave),
      numero: /\d/.test(nuevaClave),
      coincide: nuevaClave === confirmarClave && nuevaClave !== ""
    });
  }, [nuevaClave, confirmarClave]);

  const handleCambiarClave = async (e) => {
    e.preventDefault();

    const todasValidas = Object.values(validaciones).every(v => v);

    if (!todasValidas) {
      return alert("❌ Debes cumplir todos los requisitos.");
    }

    setCargando(true);

    try {
      const user = auth.currentUser;

      const credential = EmailAuthProvider.credential(
        user.email,
        claveActual
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, nuevaClave);

      alert("✅ Contraseña actualizada correctamente");

      setClaveActual("");
      setNuevaClave("");
      setConfirmarClave("");
      setVerClaveActual(false);
      setVerNuevaClave(false);
      setVerConfirmarClave(false);

    } catch (error) {
      if (error.code === "auth/wrong-password") {
        alert("❌ La contraseña actual es incorrecta.");
      } else {
        alert("Error: " + error.message);
      }
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarCorreo = async (e) => {
    e.preventDefault();
    if (!nuevoCorreo.trim() || !claveParaCorreo) {
      return alert("❌ Debes completar todos los campos.");
    }
    setCargandoCorreo(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, claveParaCorreo);
      
      // Reautenticar al usuario antes del cambio de correo
      await reauthenticateWithCredential(user, credential);
      
      // Enviar correo de verificación para el cambio en Firebase Auth
      const emailLimpio = nuevoCorreo.trim().toLowerCase();
      await verifyBeforeUpdateEmail(user, emailLimpio);
      
      alert("✉️ Se ha enviado un enlace de verificación a " + emailLimpio + ". El correo se actualizará en el sistema una vez que verifiques el enlace desde tu bandeja de entrada.");
      setNuevoCorreo("");
      setClaveParaCorreo("");
    } catch (error) {
      if (error.code === "auth/wrong-password") {
        alert("❌ La contraseña es incorrecta.");
      } else {
        alert("Error al actualizar correo: " + error.message);
      }
    } finally {
      setCargandoCorreo(false);
    }
  };

  const EyeIcon = ({ visible }) => {
    if (visible) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      );
    }
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-black uppercase tracking-widest text-red-500 animate-pulse">
          <i className="fas fa-spinner fa-spin mr-2"></i> Cargando perfil...
        </div>
      </div>
    );
  }

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
          onClick={() => router.back()}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR DE CONTENIDO DEL MÓDULO */}
      <div className="max-w-6xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-650">INVECEM</span> - Perfil de Usuario
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Consulta de datos de planta y actualización de credenciales
          </p>
        </header>

        {/* TARJETA EN SHADOW RELIEF / GLASSMORPHISM */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-250/20 text-slate-800 relative shadow-neon-cyan">
          {/* Tech Corner Details */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1px_1fr] gap-8 md:gap-12 items-start">
            
            {/* SECCIÓN IZQUIERDA: INFORMACIÓN EXTENDIDA */}
            <section className="space-y-8">
              
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2">
                  <i className="fas fa-id-card mr-2"></i> Información Personal
                </h4>
                
                <div className="space-y-1">
                  <label className="text-xxs font-extrabold text-slate-450 uppercase tracking-widest block">Nombres y Apellidos</label>
                  <p className="text-sm font-extrabold text-slate-800 uppercase">{userData.nombres || "No registrado"}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-450 uppercase tracking-widest block">Cédula de Identidad</label>
                    <p className="text-sm font-extrabold text-slate-800 uppercase">{userData.cedula || "No registrado"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-450 uppercase tracking-widest block">Teléfono</label>
                    <p className="text-sm font-extrabold text-slate-800">{userData.telefono || "No registrado"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-450 uppercase tracking-widest block">Correo Institucional</label>
                    <p className="text-sm font-extrabold text-indigo-600 break-all">{userData.correo || "No registrado"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-450 uppercase tracking-widest block">Fecha Nacimiento</label>
                    <p className="text-sm font-extrabold text-slate-800 uppercase">{userData.fechaNac || "No registrado"}</p>
                  </div>
                </div>
              </div>

              {/* GRUPO DE FICHA LABORAL */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-purple-600 tracking-wider border-b border-dashed border-purple-500/20 pb-2">
                  <i className="fas fa-fingerprint mr-2"></i> Ficha Laboral de Planta
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-455 uppercase tracking-widest block">N° de Ficha</label>
                    <p className="text-base font-black text-cyan-600 font-mono">{userData.ficha || "No registrado"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-455 uppercase tracking-widest block">Rol de Sistema</label>
                    <div>
                      <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-650 rounded-lg font-bold text-xs tracking-wider uppercase inline-block font-mono">
                        {userData.rol || "No registrado"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-455 uppercase tracking-widest block">Cargo</label>
                    <p className="text-sm font-extrabold text-slate-800 uppercase">{userData.cargo || "No registrado"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-extrabold text-slate-455 uppercase tracking-widest block">Departamento</label>
                    <p className="text-sm font-extrabold text-slate-800 uppercase">{userData.departamento || "No registrado"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-extrabold text-slate-455 uppercase tracking-widest block">Fecha de Ingreso</label>
                  <p className="text-sm font-extrabold text-slate-800 uppercase">{userData.fechaIngreso || "No registrado"}</p>
                </div>
              </div>

            </section>

            {/* DIVIDER VERTICAL */}
            <div className="hidden lg:block bg-slate-200 w-[1px] h-full min-h-[400px]"></div>

            {/* SECCIÓN DERECHA: CONFIGURACIÓN Y SEGURIDAD */}
            <div className="space-y-8">
              
              {/* FORMULARIO DE CONTRASEÑA */}
              <form onSubmit={handleCambiarClave} className="space-y-6 bg-slate-550/5 p-6 border border-slate-200/50 rounded-2xl">
                <div>
                  <h3 className="text-xs font-black uppercase text-indigo-600 tracking-wider border-b border-dashed border-indigo-500/20 pb-2 flex items-center gap-2">
                    <i className="fas fa-lock"></i> Seguridad y Contraseña
                  </h3>
                  <p className="text-slate-500 text-xs mt-1.5 font-medium">Actualiza tu clave de acceso al sistema INVECEM</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-600 block">Contraseña Actual</label>
                  <div className="relative flex w-full">
                    <input 
                      type={verClaveActual ? "text" : "password"} 
                      value={claveActual}
                      onChange={(e) => setClaveActual(e.target.value)}
                      required 
                      className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 font-semibold"
                    />
                    <button 
                      type="button" 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                      onClick={() => setVerClaveActual(!verClaveActual)}
                    >
                      <EyeIcon visible={verClaveActual} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-600 block">Nueva Contraseña</label>
                  <div className="relative flex w-full">
                    <input 
                      type={verNuevaClave ? "text" : "password"} 
                      value={nuevaClave}
                      onChange={(e) => setNuevaClave(e.target.value)}
                      required 
                      className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 font-semibold"
                    />
                    <button 
                      type="button" 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                      onClick={() => setVerNuevaClave(!verNuevaClave)}
                    >
                      <EyeIcon visible={verNuevaClave} />
                    </button>
                  </div>
                </div>

                {/* LISTA VISUAL REQUISITOS */}
                <div className="bg-slate-50 p-4 border border-slate-200/80 rounded-xl space-y-1.5">
                  <p className={`text-xxs font-bold uppercase tracking-wider flex items-center gap-2 ${validaciones.longitud ? "text-emerald-600" : "text-slate-400"}`}>
                    <i className={`fas ${validaciones.longitud ? 'fa-check-circle' : 'fa-circle-notch'}`}></i> Mínimo 8 caracteres
                  </p>
                  <p className={`text-xxs font-bold uppercase tracking-wider flex items-center gap-2 ${validaciones.mayuscula ? "text-emerald-600" : "text-slate-450"}`}>
                    <i className={`fas ${validaciones.mayuscula ? 'fa-check-circle' : 'fa-circle-notch'}`}></i> Al menos una mayúscula
                  </p>
                  <p className={`text-xxs font-bold uppercase tracking-wider flex items-center gap-2 ${validaciones.minuscula ? "text-emerald-600" : "text-slate-450"}`}>
                    <i className={`fas ${validaciones.minuscula ? 'fa-check-circle' : 'fa-circle-notch'}`}></i> Al menos una minúscula
                  </p>
                  <p className={`text-xxs font-bold uppercase tracking-wider flex items-center gap-2 ${validaciones.numero ? "text-emerald-600" : "text-slate-450"}`}>
                    <i className={`fas ${validaciones.numero ? 'fa-check-circle' : 'fa-circle-notch'}`}></i> Al menos un número
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-600 block">Confirmar Nueva Contraseña</label>
                  <div className="relative flex w-full">
                    <input 
                      type={verConfirmarClave ? "text" : "password"} 
                      value={confirmarClave}
                      onChange={(e) => setConfirmarClave(e.target.value)}
                      required 
                      className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 font-semibold"
                    />
                    <button 
                      type="button" 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                      onClick={() => setVerConfirmarClave(!verConfirmarClave)}
                    >
                      <EyeIcon visible={verConfirmarClave} />
                    </button>
                  </div>
                </div>

                <p className={`text-xxs font-bold uppercase tracking-wider flex items-center gap-2 ${validaciones.coincide ? "text-emerald-600" : "text-slate-400"}`}>
                  <i className={`fas ${validaciones.coincide ? 'fa-check-circle' : 'fa-circle-notch'}`}></i> Las contraseñas coinciden
                </p>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 transform cursor-pointer text-white hover:shadow-neon-purple" 
                  disabled={cargando}
                >
                  {cargando ? "Procesando..." : "Actualizar Contraseña"}
                </button>
              </form>

              {/* FORMULARIO DE CORREO */}
              <form onSubmit={handleCambiarCorreo} className="space-y-6 bg-slate-550/5 p-6 border border-slate-200/50 rounded-2xl">
                <div>
                  <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2">
                    <i className="fas fa-envelope"></i> Correo de Recuperación
                  </h3>
                  <p className="text-slate-500 text-xs mt-1.5 font-medium">Actualiza tu correo para recibir los enlaces de restablecimiento de contraseña.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-600 block">Nuevo Correo Real</label>
                  <input 
                    type="email" 
                    value={nuevoCorreo}
                    onChange={(e) => setNuevoCorreo(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    required 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-600 block">Contraseña para Confirmar</label>
                  <div className="relative flex w-full">
                    <input 
                      type={verClaveCorreo ? "text" : "password"} 
                      value={claveParaCorreo}
                      onChange={(e) => setClaveParaCorreo(e.target.value)}
                      required 
                      placeholder="Contraseña actual..."
                      className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-neon-purple transition-all duration-200 font-semibold"
                    />
                    <button 
                      type="button" 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                      onClick={() => setVerClaveCorreo(!verClaveCorreo)}
                    >
                      <EyeIcon visible={verClaveCorreo} />
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 transform cursor-pointer text-white hover:shadow-neon-purple" 
                  disabled={cargandoCorreo}
                >
                  {cargandoCorreo ? "Actualizando..." : "Actualizar Correo"}
                </button>
              </form>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

