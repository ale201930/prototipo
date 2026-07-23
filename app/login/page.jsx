"use client";

import { useState, useEffect } from "react";
import { auth, db, registrarAccion } from "../lib/firebase"; 
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Link from "next/link";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [correoRecuperar, setCorreoRecuperar] = useState("");
  const [loadingRecuperar, setLoadingRecuperar] = useState(false);
  const [mensajeRecuperar, setMensajeRecuperar] = useState("");
  const [errorRecuperar, setErrorRecuperar] = useState("");

  const [pasoRecuperar, setPasoRecuperar] = useState(1); // 1: buscar usuario, 2: elegir opción, 3: ingresar nueva clave
  const [usuarioCargado, setUsuarioCargado] = useState(null);
  const [cedulaRecuperar, setCedulaRecuperar] = useState("");
  const [fichaRecuperar, setFichaRecuperar] = useState("");
  const [nuevaClaveRecuperar, setNuevaClaveRecuperar] = useState("");
  const [confirmarClaveRecuperar, setConfirmarClaveRecuperar] = useState("");
  const [verClaveRecuperar, setVerClaveRecuperar] = useState(false);

  const router = useRouter();

  useEffect(() => {
    Cookies.remove("user_session");
    Cookies.remove("user_role");
    Cookies.remove("user_name");

    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setError("⚠️ Debe iniciar sesión para acceder a este módulo.");
    }
  }, []);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setError(""); 
    setLoading(true);

    try {
      const nombreLimpio = usuario.trim().toLowerCase().replace(/\s+/g, '');
      let correoParaAuth = usuario.includes("@") ? usuario.trim().toLowerCase() : "";

      // Si no es un correo completo, buscar el username en Firestore
      if (!correoParaAuth) {
        try {
          const q = query(collection(db, "usuarios"), where("username", "==", nombreLimpio));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            correoParaAuth = querySnapshot.docs[0].data().correo;
          }
        } catch (dbErr) {
          console.warn("Fallo búsqueda de username en Firestore:", dbErr);
        }
      }

      // Fallback a correo ficticio si no se encontró correspondencia
      if (!correoParaAuth) {
        correoParaAuth = `${nombreLimpio}@invecem.com`;
      }

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, correoParaAuth, clave.trim());
      } catch (authError) {
        console.log("Fallo Auth:", authError.message);
        registrarAccion(usuario, "Invitado", "Intento de inicio de sesión fallido: Credenciales incorrectas", "Acceso");
        setError("Usuario o contraseña incorrectos");
        setLoading(false);
        return;
      }

      const user = userCredential.user;

      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        if (userData.estado === "Inactivo") {
          registrarAccion(userData.nombres || userData.correo, userData.rol, "Intento de inicio de sesión fallido: Cuenta desactivada", "Acceso");
          setError("🚫 Usuario desactivado por administración.");
          setLoading(false);
          return;
        }

        let finalCorreo = userData.correo;
        // Sincronizar el correo en Firestore si se cambió y verificó en Firebase Auth
        if (user.email && userData.correo !== user.email) {
          const emailLimpio = user.email.toLowerCase();
          const usernameExtracted = emailLimpio.split("@")[0];
          try {
            await updateDoc(docRef, {
              correo: emailLimpio,
              username: usernameExtracted
            });
            finalCorreo = emailLimpio;
          } catch (syncErr) {
            console.error("Error al sincronizar correo verificado en login:", syncErr);
          }
        }

        registrarAccion(userData.nombres || finalCorreo, userData.rol, "Inicio de sesión exitoso", "Acceso");
        iniciarSesionExitosa(userData.rol, userData.nombres || finalCorreo);
      } else {
        registrarAccion(usuario, "Invitado", "Intento de inicio de sesión fallido: Perfil sin datos en sistema", "Acceso");
        setError("⚠️ Error de perfil: El usuario no tiene datos asignados.");
        setLoading(false);
      }

    } catch (error) {
      console.error("Error general:", error);
      setError("Error al conectar con el sistema");
      setLoading(false);
    }
  };

  const iniciarSesionExitosa = (rolRaw, nombre) => {
    const rol = rolRaw.toLowerCase().trim();
    
    Cookies.set("user_session", "active", { expires: 1 }); 
    Cookies.set("user_role", rol, { expires: 1 });
    Cookies.set("user_name", nombre, { expires: 1 });

    const rutas = {
      administrador: "/administrador",
      inspector: "/inspector",
      "recursos humanos": "/recursos-humanos",
      "proteccion fisica": "/proteccion-fisica"
    };

    const ruta = rutas[rol];
    if (ruta) {
      router.push(ruta);
    } else {
      setError("Rol no válido: " + rol);
    }
  };

  const manejarBuscarUsuario = async (e) => {
    e.preventDefault();
    setErrorRecuperar("");
    setMensajeRecuperar("");
    setLoadingRecuperar(true);

    const inputLimpio = correoRecuperar.trim().toLowerCase();
    let userDoc = null;

    try {
      // Buscar en Firestore por correo o por username
      const qEmail = query(collection(db, "usuarios"), where("correo", "==", inputLimpio));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        userDoc = { uid: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
      } else {
        const qUser = query(collection(db, "usuarios"), where("username", "==", inputLimpio.replace(/\s+/g, '')));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          userDoc = { uid: snapUser.docs[0].id, ...snapUser.docs[0].data() };
        }
      }

      if (!userDoc) {
        setErrorRecuperar("❌ No se encontró ningún usuario con ese nombre o correo.");
        setLoadingRecuperar(false);
        return;
      }

      setUsuarioCargado(userDoc);
      setPasoRecuperar(2); // Avanzar a elegir opción
    } catch (err) {
      console.error("Error al buscar usuario:", err);
      setErrorRecuperar("❌ Error: " + err.message);
    } finally {
      setLoadingRecuperar(false);
    }
  };

  const manejarValidarYEnviarCorreo = async (e) => {
    e.preventDefault();
    setErrorRecuperar("");
    setMensajeRecuperar("");
    setLoadingRecuperar(true);

    const cedulaInput = cedulaRecuperar.trim().toUpperCase().replace(/\D/g, "");
    const fichaInput = fichaRecuperar.trim();

    const cedulaDB = (usuarioCargado.cedula || "").trim().toUpperCase().replace(/\D/g, "");
    const fichaDB = (usuarioCargado.ficha || "").trim();

    if (!cedulaInput || !fichaInput) {
      setErrorRecuperar("❌ Debe ingresar su Cédula y Ficha para verificar su identidad.");
      setLoadingRecuperar(false);
      return;
    }

    if (cedulaInput === cedulaDB && fichaInput === fichaDB) {
      try {
        await sendPasswordResetEmail(auth, usuarioCargado.correo);
      } catch (err) {
        console.warn("Advertencia SMTP:", err.message);
      }

      setMensajeRecuperar(`✅ ¡Datos de Cédula y Ficha validados con éxito! Se ha enviado el enlace para restablecer su contraseña al correo electrónico registrado: ${usuarioCargado.correo}. Por favor, revise su bandeja de entrada (o carpeta de SPAM).`);
      setLoadingRecuperar(false);
    } else {
      setErrorRecuperar("❌ Cédula o Número de Ficha incorrectos para este usuario.");
      setLoadingRecuperar(false);
    }
  };

  return (
    <div className="theme-dark dark min-h-screen w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── PANEL IZQUIERDO — BRANDING ── */}
      <div className="hidden lg:flex lg:w-1/2 login-panel-left flex-col items-center justify-center p-12 relative">
        
        {/* Decoración geométrica */}
        <div className="absolute top-8 left-8 w-32 h-32 border border-cyan-500/10 rounded-3xl rotate-12 pointer-events-none" />
        <div className="absolute bottom-16 right-12 w-20 h-20 border border-blue-500/10 rounded-2xl -rotate-6 pointer-events-none" />
        <div className="absolute top-1/3 right-8 w-3 h-3 bg-cyan-500/40 rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/3 left-10 w-2 h-2 bg-blue-400/40 rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '0.8s' }} />

        {/* Logo y branding */}
        <div className="relative z-10 text-center animate-slide-up">

          {/* Ícono corporativo */}
          <div className="mx-auto mb-8 w-24 h-24 rounded-2xl flex items-center justify-center animate-glow-ring"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', boxShadow: '0 0 40px rgba(6,182,212,0.3)' }}>
            <i className="fas fa-fingerprint text-white text-4xl" />
          </div>

          <h1 className="text-5xl font-black tracking-tight text-white mb-2">
            INVECEM
          </h1>
          <div className="w-16 h-1 mx-auto rounded-full mb-6"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }} />
          
          <p className="text-slate-300 text-base font-medium leading-relaxed max-w-xs mx-auto">
            Sistema integrado de control de asistencia y gestión de personal de planta
          </p>

          {/* Módulos disponibles (Decorativo - Solo íconos premium sin nombres de roles) */}
          <div className="mt-8 flex justify-center gap-6">
            {[
              { icon: 'fa-user-tie', color: '#06b6d4', glow: 'rgba(6,182,212,0.25)' },
              { icon: 'fa-user-shield', color: '#3b82f6', glow: 'rgba(59,130,246,0.25)' },
              { icon: 'fa-users', color: '#38bdf8', glow: 'rgba(56,189,248,0.25)' },
              { icon: 'fa-shield-halved', color: '#6366f1', glow: 'rgba(99,102,241,0.25)' },
            ].map((m, idx) => (
              <div
                key={idx}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: `0 0 15px ${m.glow}`,
                }}
              >
                <i className={`fas ${m.icon} text-lg`} style={{ color: m.color }} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer branding */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-slate-600 text-xs font-mono tracking-wider">PLANTA INDUSTRIAL · ACCESO SEGURO</p>
        </div>
      </div>

      {/* ── PANEL DERECHO — FORMULARIO ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--bg-main)' }}>
        
        <div className="w-full max-w-md animate-fade-in">

          {/* Header móvil (visible solo en mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <i className="fas fa-fingerprint text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-black text-white">INVECEM</h1>
            <p className="text-slate-400 text-sm mt-1">Sistema de Gestión de Planta</p>
          </div>

          {/* Card de login */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10"
            style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.1), 0 1px 3px rgba(15,23,42,0.05)' }}>



            <div className="mb-8">
              <h2 className="text-2xl font-black text-center text-white tracking-tight">Iniciar Sesión</h2>
              <p className="text-slate-400 text-center text-sm mt-1.5 font-medium">Ingresa tus credenciales para acceder al sistema</p>
            </div>

            <form onSubmit={manejarLogin} className="space-y-5">

              {/* Campo usuario */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-user text-cyan-500 text-[11px]" />
                  Usuario o Correo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="usuario o correo@invecem.com"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 pr-12 bg-slate-900/40 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-semibold text-sm"
                    style={{ '--tw-ring-color': 'rgba(6,182,212,0.4)' }}
                    onFocus={e => { e.target.style.borderColor='var(--cyan)'; e.target.style.boxShadow='0 0 0 3px rgba(6,182,212,0.15)'; e.target.style.background='rgba(15,23,42,0.6)'; }}
                    onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; e.target.style.background='rgba(15,23,42,0.4)'; }}
                  />
                  <i className="fas fa-at absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                </div>
              </div>

              {/* Campo contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-key text-cyan-500 text-[11px]" />
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••••"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 pr-12 bg-slate-900/40 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none transition-all duration-200 font-semibold text-sm"
                    onFocus={e => { e.target.style.borderColor='var(--cyan)'; e.target.style.boxShadow='0 0 0 3px rgba(6,182,212,0.15)'; e.target.style.background='rgba(15,23,42,0.6)'; }}
                    onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; e.target.style.background='rgba(15,23,42,0.4)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-500 transition-colors cursor-pointer"
                  >
                    <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                  </button>
                </div>
              </div>

              {/* Recuperación de Contraseña */}
              <div className="flex justify-center pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setErrorRecuperar("");
                    setMensajeRecuperar("");
                    setCorreoRecuperar("");
                    setMostrarRecuperar(true);
                  }}
                  className="font-bold text-cyan-400 hover:text-cyan-355 hover:underline cursor-pointer transition-all"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl animate-shake"
                  style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                  <i className="fas fa-triangle-exclamation text-rose-500 text-sm flex-shrink-0" />
                  <p className="text-rose-700 text-xs font-semibold">{error}</p>
                </div>
              )}

              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  boxShadow: '0 4px 20px rgba(6,182,212,0.35)',
                }}
                onMouseEnter={e => { if(!loading) { e.target.style.transform='translateY(-1px)'; e.target.style.boxShadow='0 8px 28px rgba(6,182,212,0.45)'; }}}
                onMouseLeave={e => { e.target.style.transform=''; e.target.style.boxShadow='0 4px 20px rgba(6,182,212,0.35)'; }}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin" />
                    Verificando acceso...
                  </>
                ) : (
                  <>
                    <i className="fas fa-shield-check" />
                    Ingresar al Sistema
                  </>
                )}
              </button>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 text-center">
                <p className="text-slate-400 text-xs font-mono tracking-wider">ACCESO SEGURO · PLANTA OFICIAL</p>
              </div>

            </form>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6 font-medium">
            INVECEM © {new Date().getFullYear()} · Sistema de Control de Personal
          </p>
        </div>
      </div>

      {/* ── MODAL RECUPERACIÓN DE CONTRASEÑA ── */}
      {mostrarRecuperar && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative">
            
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => {
                setMostrarRecuperar(false);
                setPasoRecuperar(1);
                setUsuarioCargado(null);
                setCorreoRecuperar("");
                setCedulaRecuperar("");
                setFichaRecuperar("");
                setNuevaClaveRecuperar("");
                setConfirmarClaveRecuperar("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <i className="fas fa-times text-lg" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <i className="fas fa-envelope-open-text text-cyan-400" />
                Recuperación de Contraseña
              </h3>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">
                {pasoRecuperar === 1 && "Paso 1: Ingrese su usuario (ej. maria) o su correo registrado para buscar su cuenta."}
                {pasoRecuperar === 2 && `Paso 2: Ingrese su Cédula y Ficha obligatorias para validar su identidad y recibir el correo.`}
              </p>
            </div>

            {/* PASO 1: BUSCAR USUARIO */}
            {pasoRecuperar === 1 && (
              <form onSubmit={manejarBuscarUsuario} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    USUARIO O CORREO REGISTRADO
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: maria o maria@invecem.com"
                    value={correoRecuperar}
                    onChange={(e) => setCorreoRecuperar(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-semibold text-sm"
                  />
                </div>

                {errorRecuperar && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-450 text-xs font-semibold">
                    {errorRecuperar}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarRecuperar(false);
                      setCorreoRecuperar("");
                      setCedulaRecuperar("");
                      setFichaRecuperar("");
                      setErrorRecuperar("");
                      setMensajeRecuperar("");
                    }}
                    className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loadingRecuperar}
                    className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:shadow-neon-cyan transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingRecuperar ? "Buscando..." : "Siguiente"}
                  </button>
                </div>
              </form>
            )}

            {/* PASO 2: VALIDAR CÉDULA Y FICHA + ENVIAR CORREO */}
            {pasoRecuperar === 2 && (
              <div>
                {!mensajeRecuperar ? (
                  <form onSubmit={manejarValidarYEnviarCorreo} className="space-y-4">
                    <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-cyan-300 text-xs font-semibold flex items-center gap-2 mb-2">
                      <i className="fas fa-user-check text-cyan-400" />
                      <span>Usuario: <strong>{usuarioCargado?.nombres || usuarioCargado?.username}</strong></span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          CÉDULA DE IDENTIDAD <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="Ej: 12345678 (Solo números)"
                          value={cedulaRecuperar}
                          onChange={(e) => setCedulaRecuperar(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          required
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-700 text-xs focus:outline-none focus:border-cyan-500 transition-all font-semibold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          NÚMERO DE FICHA <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 554433"
                          value={fichaRecuperar}
                          onChange={(e) => setFichaRecuperar(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-700 text-xs focus:outline-none focus:border-cyan-500 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {errorRecuperar && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-450 text-xs font-semibold text-center leading-relaxed">
                        {errorRecuperar}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPasoRecuperar(1);
                          setErrorRecuperar("");
                          setMensajeRecuperar("");
                        }}
                        className="py-3 px-4 bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        <i className="fas fa-arrow-left mr-1" /> Atrás
                      </button>

                      <button
                        type="submit"
                        disabled={loadingRecuperar}
                        className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:shadow-neon-cyan transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loadingRecuperar ? (
                          <>
                            <i className="fas fa-spinner fa-spin" /> Verificando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-paper-plane" /> Enviar a mi Correo
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-semibold leading-relaxed flex flex-col items-center gap-3">
                      <i className="fas fa-envelope-circle-check text-4xl text-emerald-400" />
                      <p>{mensajeRecuperar}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMostrarRecuperar(false);
                        setPasoRecuperar(1);
                        setUsuarioCargado(null);
                        setCorreoRecuperar("");
                        setCedulaRecuperar("");
                        setFichaRecuperar("");
                        setErrorRecuperar("");
                        setMensajeRecuperar("");
                      }}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer font-bold"
                    >
                      Entendido / Volver al Login
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
