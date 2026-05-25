"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function PerfilUsuario() {
  const [userData, setUserData] = useState(null);

  const [claveActual, setClaveActual] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");

  const [cargando, setCargando] = useState(false);

  // ESTADOS PARA CONTROLAR LA VISIBILIDAD DE LAS CONTRASEÑAS
  const [verClaveActual, setVerClaveActual] = useState(false);
  const [verNuevaClave, setVerNuevaClave] = useState(false);
  const [verConfirmarClave, setVerConfirmarClave] = useState(false);

  // VALIDACIONES EN TIEMPO REAL
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
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // VALIDACIÓN DINÁMICA
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

  const EyeIcon = ({ visible }) => {
    if (visible) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      );
    }
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  };

  if (!userData) return <div className="loading">Cargando perfil...</div>;

  return (
    <div className="layout">
      
      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav no-print">
        <div className="logo">
          INVECEM <span className="red-text">SYSTEM CONTROL</span>
        </div>
        <button className="btn-panel" onClick={() => router.back()}>
          ← VOLVER
        </button>
      </nav>

      {/* CONTENEDOR DE CONTENIDO DEL MÓDULO */}
      <div className="content">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="report-header">
          <h1 className="report-title">INVECEM - Perfil de Usuario</h1>
          <p className="subtitle-header">Consulta de datos de planta y actualización de credenciales</p>
        </header>

        {/* TARJETA EN SHADOW RELIEF / GLASSMORPHISM */}
        <div className="perfil-card shadow-relief">
          
          <div className="perfil-grid-content">
            
            {/* SECCIÓN IZQUIERDA: INFORMACIÓN EXTENDIDA (MÁS DATOS) */}
            <section className="user-info">
              
              <div className="info-section-group">
                <h4 className="info-group-title">Información Personal</h4>
                
                <div className="info-item">
                  <label>Nombres y Apellidos</label>
                  <p>{userData.nombres || "No registrado"}</p>
                </div>

                <div className="info-row-twin">
                  <div className="info-item">
                    <label>Cédula de Identidad</label>
                    <p>{userData.cedula || "No registrado"}</p>
                  </div>
                  <div className="info-item">
                    <label>Teléfono</label>
                    <p className="normal-case">{userData.telefono || "No registrado"}</p>
                  </div>
                </div>

                <div className="info-row-twin">
                  <div className="info-item">
                    <label>Correo Institucional</label>
                    <p className="email-text">{userData.correo || "No registrado"}</p>
                  </div>
                  <div className="info-item">
                    <label>Fecha Nacimiento</label>
                    <p>{userData.fechaNac || "No registrado"}</p>
                  </div>
                </div>
              </div>

              {/* GRUPO DE FICHA LABORAL */}
              <div className="info-section-group">
                <h4 className="info-group-title">Ficha Laboral de Planta</h4>
                
                <div className="info-row-twin">
                  <div className="info-item">
                    <label>N° de Ficha</label>
                    <p className="ficha-tag">{userData.ficha || "No registrado"}</p>
                  </div>
                  <div className="info-item">
                    <label>Rol de Sistema</label>
                    <div>
                      <span className="role-text">{userData.rol || "No registrado"}</span>
                    </div>
                  </div>
                </div>

                <div className="info-row-twin">
                  <div className="info-item">
                    <label>Cargo</label>
                    <p>{userData.cargo || "No registrado"}</p>
                  </div>
                  <div className="info-item">
                    <label>Departamento</label>
                    <p>{userData.departamento || "No registrado"}</p>
                  </div>
                </div>

                <div className="info-item">
                  <label>Fecha de Ingreso a la Empresa</label>
                  <p>{userData.fechaIngreso || "No registrado"}</p>
                </div>
              </div>

            </section>

            {/* DIVIDER VERTICAL */}
            <div className="vertical-divider"></div>

            {/* SECCIÓN DERECHA: FORMULARIO */}
            <form onSubmit={handleCambiarClave} className="clave-form">
              <h3 className="section-title">Seguridad y Contraseña</h3>
              <p className="subtitle">Actualiza tu clave de acceso al sistema INVECEM</p>

              <div className="input-group">
                <label>Contraseña Actual</label>
                <div className="input-password-container">
                  <input 
                    type={verClaveActual ? "text" : "password"} 
                    value={claveActual}
                    onChange={(e) => setClaveActual(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn-toggle-password"
                    onClick={() => setVerClaveActual(!verClaveActual)}
                    title={verClaveActual ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <EyeIcon visible={verClaveActual} />
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Nueva Contraseña</label>
                <div className="input-password-container">
                  <input 
                    type={verNuevaClave ? "text" : "password"} 
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn-toggle-password"
                    onClick={() => setVerNuevaClave(!verNuevaClave)}
                    title={verNuevaClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <EyeIcon visible={verNuevaClave} />
                  </button>
                </div>
              </div>

              {/* LISTA VISUAL REQUISITOS */}
              <div className="validaciones">
                <p className={validaciones.longitud ? "ok" : ""}>• Mínimo 8 caracteres</p>
                <p className={validaciones.mayuscula ? "ok" : ""}>• Al menos una mayúscula</p>
                <p className={validaciones.minuscula ? "ok" : ""}>• Al menos una minúscula</p>
                <p className={validaciones.numero ? "ok" : ""}>• Al menos un número</p>
              </div>

              <div className="input-group">
                <label>Confirmar Nueva Contraseña</label>
                <div className="input-password-container">
                  <input 
                    type={verConfirmarClave ? "text" : "password"} 
                    value={confirmarClave}
                    onChange={(e) => setConfirmarClave(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn-toggle-password"
                    onClick={() => setVerConfirmarClave(!verConfirmarClave)}
                    title={verConfirmarClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <EyeIcon visible={verConfirmarClave} />
                  </button>
                </div>
              </div>

              <p className={validaciones.coincide ? "ok" : "validation-pending"}>
                • Las contraseñas coinciden
              </p>

              <button type="submit" className="btn-confirmar" disabled={cargando}>
                {cargando ? "Procesando..." : "Actualizar Contraseña"}
              </button>
            </form>
          </div>

        </div>
      </div>

      <style jsx>{`
  /* --- ESTILOS GENERALES DEL LAYOUT UNIFICADO --- */
  .layout { 
    background-color: #f0f4f8;
    background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px);
    background-size: 24px 24px;
    min-height: 100vh; 
    font-family: 'Inter', system-ui, -apple-system, sans-serif; 
    color: #0f172a;
    position: relative;
  }

  /* --- BARRA DE NAVEGACIÓN SUPERIOR --- */
  .top-nav { 
    background: #0f172a; 
    color: white; 
    padding: 12px 25px; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 4px solid #e30613; 
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .logo { font-weight: 900; font-size: 20px; letter-spacing: -1px; }
  .red-text { color: #e30613; }
  
  .btn-panel { 
    background: #e30613; 
    color: white; 
    border: none; 
    padding: 8px 16px; 
    border-radius: 8px; 
    cursor: pointer; 
    font-size: 11px; 
    font-weight: 800; 
    text-transform: uppercase;
    transition: 0.3s;
  }
  .btn-panel:hover { background: #b8050f; transform: translateY(-2px); }

  /* --- CONTENEDOR DE CONTENIDO DE LA APP --- */
  .content { padding: 30px; max-width: 1250px; margin: 0 auto; position: relative; z-index: 1; }

  /* --- ENCABEZADO ESTILO MÓDULO CONTROL DE ACCESO --- */
  .report-header {
    margin-bottom: 35px;
    border-left: 6px solid #0f172a;
    padding-left: 20px;
  }
  .report-title {
    font-size: 38px;
    font-weight: 900;
    color: #0f172a;
    margin: 0;
    letter-spacing: -2px;
    line-height: 1;
    text-transform: uppercase;
  }
  .subtitle-header {
    font-size: 14px;
    font-weight: 700;
    color: #64748b;
    margin-top: 5px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0;
  }

  /* --- TARJETA ESTILO GLASSMORPHISM (SHADOW RELIEF) --- */
  .shadow-relief { 
    background: rgba(255, 255, 255, 0.94); 
    backdrop-filter: blur(10px);
    border-radius: 24px; 
    padding: 35px; 
    border: 1px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 20px 40px -12px rgba(15, 23, 42, 0.12);
    position: relative;
    overflow: hidden;
  }

  /* Indicadores de Títulos de Sección */
  .section-title { 
    margin: 0 0 10px 0; 
    font-size: 14px; 
    text-transform: uppercase; 
    font-weight: 900; 
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-title::before {
    content: ""; width: 8px; height: 8px; background: #e30613; border-radius: 2px;
  }

  /* --- GRID DE CONTENIDO INTERNO (DOS COLUMNAS) --- */
  .perfil-grid-content {
    display: grid;
    grid-template-columns: 1.2fr 2px 1fr; /* Más espacio para los datos extendidos */
    gap: 40px;
    align-items: start;
  }

  /* --- ORGANIZACIÓN DE SUBSECCIONES DE DATOS --- */
  .user-info { display: flex; flex-direction: column; gap: 25px; }
  
  .info-section-group {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .info-group-title {
    font-size: 11px;
    font-weight: 900;
    color: #e30613;
    text-transform: uppercase;
    margin: 0 0 5px 0;
    letter-spacing: 0.5px;
    border-bottom: 1px dashed #fee2e2;
    padding-bottom: 4px;
  }

  /* Filas de dos columnas internas para datos más cortos */
  .info-row-twin {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }
  
  .info-item label { 
    display: block; 
    font-size: 10px; 
    font-weight: 800; 
    color: #64748b; 
    text-transform: uppercase; 
    margin-bottom: 4px; 
    padding-left: 2px;
  }
  .info-item p { 
    margin: 0; 
    color: #0f172a; 
    font-weight: 800; 
    font-size: 0.95rem; 
    text-transform: uppercase;
  }
  .info-item .email-text { text-transform: none; color: #334155; font-size: 0.9rem; }
  .info-item .normal-case { text-transform: none; }
  .ficha-tag { color: #e30613; font-weight: 900; } 
  
  .role-text { 
    background: #0f172a; 
    padding: 3px 10px; 
    border-radius: 6px; 
    font-size: 0.75rem; 
    font-weight: 800;
    color: white;
    display: inline-block;
    text-transform: uppercase;
  }

  /* DIVIDER VERTICAL */
  .vertical-divider {
    background: #f1f5f9;
    height: 100%;
    min-height: 450px;
  }

  /* SECCIÓN DERECHA (FORMULARIO) */
  .clave-form { display: flex; flex-direction: column; }
  .subtitle { font-size: 0.75rem; color: #64748b; margin-top: 4px; margin-bottom: 20px; font-weight: 500; }
  
  .input-group { margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px; }
  .input-group label { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: block; padding-left: 4px; }
  
  .input-password-container { position: relative; display: flex; width: 100%; }
  .input-password-container input { width: 100%; padding-right: 45px; }

  .btn-toggle-password {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 0;
    display: flex; align-items: center; justify-content: center; user-select: none;
    color: #64748b; transition: color 0.2s;
  }
  .btn-toggle-password:hover { color: #e30613; }

  :global(.icon-svg) { width: 20px; height: 20px; }
  
  input { 
    width: 100%; padding: 12px; 
    border: 2px solid #f1f5f9; 
    border-radius: 12px; 
    font-size: 14px; 
    font-weight: 600; 
    background: #f8fafc; 
    transition: all 0.2s ease;
    outline: none;
  }
  input:focus { 
    border-color: #e30613; 
    background: white; 
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(227, 6, 19, 0.08);
  }

  /* VALIDACIONES */
  .validaciones { background: #f8fafc; padding: 12px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #f1f5f9; }
  .validaciones p { font-size: 0.75rem; color: #94a3b8; margin: 4px 0; font-weight: 600; }
  .validation-pending { font-size: 0.75rem; color: #94a3b8; margin: 4px 0; font-weight: 600; }
  .ok { color: #10b981 !important; }

  /* BOTÓN CONFIRMAR */
  .btn-confirmar { 
    width: 100%; 
    background: #e30613; 
    color: white; 
    border: none; 
    padding: 15px; 
    border-radius: 12px; 
    font-weight: 800; 
    cursor: pointer; 
    text-transform: uppercase; 
    margin-top: 10px; 
    font-size: 12px;
    box-shadow: 0 8px 16px rgba(227, 6, 19, 0.2);
    transition: 0.3s;
  }
  .btn-confirmar:hover { transform: translateY(-3px); box-shadow: 0 12px 20px rgba(227, 6, 19, 0.3); }
  .btn-confirmar:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; transform: none; }

  .loading { padding: 40px; text-align: center; font-weight: 900; color: #e30613; font-size: 1rem; }

  /* RESPONSIVIDAD */
  @media (max-width: 950px) {
    .perfil-grid-content { grid-template-columns: 1fr; gap: 30px; }
    .vertical-divider { display: none; }
  }
  @media (max-width: 480px) {
    .info-row-twin { grid-template-columns: 1fr; gap: 14px; }
  }
`}</style>
    </div>
  );
}