"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const router = useRouter();

  useEffect(() => {
    Cookies.remove("user_session");
    Cookies.remove("user_role");
    Cookies.remove("user_name");

    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setError("âš ï¸ Debe iniciar sesiÃ³n para acceder a este mÃ³dulo.");
    }
  }, []);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setError(""); 
    setLoading(true);

    try {
      const nombreLimpio = usuario.trim().toLowerCase().replace(/\s+/g, '');
      const correoParaAuth = usuario.includes("@") ? usuario : `${nombreLimpio}@invecem.com`;

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, correoParaAuth, clave.trim());
      } catch (authError) {
        console.log("Fallo Auth:", authError.message);
        setError("Usuario o contraseÃ±a incorrectos");
        setLoading(false);
        return;
      }

      const user = userCredential.user;

      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        if (userData.estado === "Inactivo") {
          setError("ðŸš« Usuario desactivado por administraciÃ³n.");
          setLoading(false);
          return;
        }

        iniciarSesionExitosa(userData.rol, userData.usuario);
      } else {
        setError("âš ï¸ Error de perfil: El usuario no tiene datos asignados.");
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
      setError("Rol no vÃ¡lido: " + rol);
    }
  };

  return (
    <div className="min-h-screen w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* â”€â”€ PANEL IZQUIERDO â€” BRANDING â”€â”€ */}
      <div className="hidden lg:flex lg:w-1/2 login-panel-left flex-col items-center justify-center p-12 relative">
        
        {/* DecoraciÃ³n geomÃ©trica */}
        <div className="absolute top-8 left-8 w-32 h-32 border border-cyan-500/10 rounded-3xl rotate-12 pointer-events-none" />
        <div className="absolute bottom-16 right-12 w-20 h-20 border border-blue-500/10 rounded-2xl -rotate-6 pointer-events-none" />
        <div className="absolute top-1/3 right-8 w-3 h-3 bg-cyan-500/40 rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/3 left-10 w-2 h-2 bg-blue-400/40 rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '0.8s' }} />

        {/* Logo y branding */}
        <div className="relative z-10 text-center animate-slide-up">

          {/* Ãcono corporativo */}
          <div className="mx-auto mb-8 w-24 h-24 rounded-2xl flex items-center justify-center animate-glow-ring"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', boxShadow: '0 0 40px rgba(6,182,212,0.3)' }}>
            <i className="fas fa-building-columns text-white text-4xl" />
          </div>

          <h1 className="text-5xl font-black tracking-tight text-white mb-2">
            INVECEM
          </h1>
          <div className="w-16 h-1 mx-auto rounded-full mb-6"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }} />
          
          <p className="text-slate-300 text-base font-medium leading-relaxed max-w-xs mx-auto">
            Sistema integrado de control de asistencia y gestiÃ³n de personal de planta
          </p>

          {/* MÃ³dulos disponibles */}
          <div className="mt-10 grid grid-cols-2 gap-3 max-w-xs mx-auto">
            {[
              { icon: 'fa-user-tie', label: 'AdministraciÃ³n', color: 'text-cyan-400' },
              { icon: 'fa-user-shield', label: 'Inspector', color: 'text-blue-400' },
              { icon: 'fa-users', label: 'Recursos Humanos', color: 'text-sky-400' },
              { icon: 'fa-shield-halved', label: 'ProtecciÃ³n FÃ­sica', color: 'text-indigo-400' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <i className={`fas ${m.icon} ${m.color} text-sm`} />
                <span className="text-slate-300 text-xs font-semibold">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer branding */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-slate-600 text-xs font-mono tracking-wider">PLANTA INDUSTRIAL Â· ACCESO SEGURO</p>
        </div>
      </div>

      {/* â”€â”€ PANEL DERECHO â€” FORMULARIO â”€â”€ */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--bg-main)' }}>
        
        <div className="w-full max-w-md animate-fade-in">

          {/* Header mÃ³vil (visible solo en mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <i className="fas fa-building-columns text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">INVECEM</h1>
            <p className="text-slate-500 text-sm mt-1">Sistema de GestiÃ³n de Planta</p>
          </div>

          {/* Card de login */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10"
            style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.1), 0 1px 3px rgba(15,23,42,0.05)' }}>

            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Iniciar SesiÃ³n</h2>
              <p className="text-slate-500 text-sm mt-1.5 font-medium">Ingresa tus credenciales para acceder al sistema</p>
            </div>

            <form onSubmit={manejarLogin} className="space-y-5">

              {/* Campo usuario */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
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
                    className="w-full px-4 py-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 font-semibold text-sm"
                    style={{ '--tw-ring-color': 'rgba(6,182,212,0.4)' }}
                    onFocus={e => { e.target.style.borderColor='var(--cyan)'; e.target.style.boxShadow='0 0 0 3px rgba(6,182,212,0.15)'; e.target.style.background='var(--bg-card)'; }}
                    onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; e.target.style.background='var(--navy-soft)'; }}
                  />
                  <i className="fas fa-at absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                </div>
              </div>

              {/* Campo contraseÃ±a */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-key text-cyan-500 text-[11px]" />
                  ContraseÃ±a
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-200 font-semibold text-sm"
                    onFocus={e => { e.target.style.borderColor='var(--cyan)'; e.target.style.boxShadow='0 0 0 3px rgba(6,182,212,0.15)'; e.target.style.background='var(--bg-card)'; }}
                    onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; e.target.style.background='var(--navy-soft)'; }}
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

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl animate-shake"
                  style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                  <i className="fas fa-triangle-exclamation text-rose-500 text-sm flex-shrink-0" />
                  <p className="text-rose-700 text-xs font-semibold">{error}</p>
                </div>
              )}

              {/* BotÃ³n */}
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
                <p className="text-slate-400 text-xs font-mono tracking-wider">ACCESO SEGURO Â· PLANTA OFICIAL</p>
              </div>

            </form>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6 font-medium">
            INVECEM Â© {new Date().getFullYear()} Â· Sistema de Control de Personal
          </p>
        </div>
      </div>
    </div>
  );
}
