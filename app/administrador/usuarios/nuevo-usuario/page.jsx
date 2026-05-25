"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase"; 
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
      const userCredential = await createUserWithEmailAndPassword(auth, formData.correo, formData.clave);
      const uid = userCredential.user.uid;

      // 4. Preparar datos para Firestore
      const { clave, ...datosParaGuardar } = formData;

      // 5. Guardar en la colección de usuarios
      await setDoc(doc(db, "usuarios", uid), {
        uid,
        ...datosParaGuardar,
        estado: "Activo",
        fechaRegistro: new Date().toISOString()
      });

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
    <div className="layout">
      
      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav">
        <div className="logo">
          SYSTEM-CONTROL <span className="red-text"> INVECEM </span>
        </div>
        <button className="btn-panel" onClick={() => router.push("/administrador/usuarios")}>
          ← VOLVER
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="content">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="report-header">
          <h1 className="report-title">REGISTROS DE USUARIOS</h1>
          <p className="subtitle-header">Módulo de Ingreso </p>
        </header>

        {/* TARJETA CON SOMBRA SÓLIDA INDUSTRIAL */}
        <form onSubmit={handleGuardar} className="sislexi-card shadow-relief">
          
          {/* SECCIÓN 1: CREDENCIALES */}
          <section className="form-section">
            <h3 className="section-title">Credenciales de Acceso</h3>
            <div className="row">
              <div className="field">
                <label>CORREO INSTITUCIONAL</label>
                <input name="correo" type="email" placeholder="ejemplo@invecem.com" onChange={handleChange} required />
              </div>
              <div className="field">
                <label>CONTRASEÑA TEMPORAL</label>
                <input name="clave" type="password" placeholder="********" onChange={handleChange} required />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: INFO PERSONAL */}
          <section className="form-section">
            <h3 className="section-title">Información Personal</h3>
            <div className="row">
              <div className="field">
                <label>NOMBRES Y APELLIDOS</label>
                <input name="nombres" type="text" placeholder="Ej: Juan Pérez" onChange={handleChange} required />
              </div>
              <div className="field">
                <label>CÉDULA DE IDENTIDAD</label>
                <input name="cedula" type="text" placeholder="Ej: V-12345678" onChange={handleChange} required />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>TELÉFONO</label>
                <input name="telefono" type="text" placeholder="Ej: 04121234567" onChange={handleChange} />
              </div>
              <div className="field">
                <label>FECHA NACIMIENTO</label>
                <input name="fechaNac" type="date" onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: FICHA LABORAL */}
          <section className="form-section">
            <h3 className="section-title">Ficha Laboral de Planta</h3>
            <div className="row">
              <div className="field">
                <label>N° DE FICHA</label>
                <input name="ficha" type="text" placeholder="Ej: 554433" onChange={handleChange} required />
              </div>
              <div className="field">
                <label>ROL DE SISTEMA</label>
                <select name="rol" onChange={handleChange} value={formData.rol}>
                  <option value="Inspector">Inspector</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Proteccion Fisica">Protección Física</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>CARGO</label>
                <input name="cargo" type="text" placeholder="Ej: Analista de Seguridad" onChange={handleChange} />
              </div>
              <div className="field">
                <label>DEPARTAMENTO</label>
                <input name="departamento" type="text" placeholder="Ej: Operaciones" onChange={handleChange} />
              </div>
            </div>
            
            {/* CAMPO: FECHA DE INGRESO */}
            <div className="row">
              <div className="field">
                <label>FECHA DE INGRESO A LA EMPRESA</label>
                <input 
                  name="fechaIngreso" 
                  type="date" 
                  onChange={handleChange} 
                  required 
                />
              </div>
            </div>
          </section>

          <button type="submit" className="btn-submit" disabled={cargando}>
            {cargando ? "Registrando..." : "Registrar en el Sistema"}
          </button>
        </form>
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

        /* --- CONTENEDOR DE CONTENIDO --- */
        .content { padding: 30px; max-width: 850px; margin: 0 auto; position: relative; z-index: 1; }

        /* --- ENCABEZADO ESTILO INMÓVIL --- */
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

        /* --- TARJETA PRINCIPAL (SHADOW RELIEF) --- */
        .sislexi-card { 
          background: white; 
          padding: 35px; 
          border-radius: 24px; 
          border: 1px solid #e2e8f0;
          border-top: 8px solid #e30613; 
          box-shadow: 12px 12px 0px #0f172a; 
        }

        /* --- TÍTULOS DE SECCIÓN INTERNOS --- */
        .section-title { 
          color: #e30613; 
          font-size: 11px; 
          font-weight: 900;
          text-transform: uppercase; 
          border-bottom: 2px solid #f1f5f9; 
          padding-bottom: 5px; 
          margin: 30px 0 15px; 
          letter-spacing: 0.5px;
        }

        /* --- DISEÑO DE FILAS Y CAMPOS --- */
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        
        label { 
          font-size: 10px; 
          font-weight: 800; 
          color: #0f172a; 
          text-transform: uppercase; 
        }

        input, select { 
          padding: 12px; 
          border: 2px solid #f1f5f9; 
          border-radius: 10px; 
          font-size: 0.85rem;
          font-weight: 600;
          color: #1e293b;
          outline: none;
          transition: 0.3s;
          background: #f8fafc;
        }
        
        input:focus, select:focus { 
          border-color: #e30613; 
          background: white;
          box-shadow: 0 4px 12px rgba(227, 6, 19, 0.05);
        }

        /* --- BOTÓN DE ENVÍO 3D --- */
        .btn-submit { 
          width: 100%; 
          background: #e30613; 
          color: white; 
          padding: 16px; 
          border: none; 
          border-radius: 12px; 
          font-weight: 900; 
          font-size: 13px;
          text-transform: uppercase;
          cursor: pointer; 
          margin-top: 30px; 
          transition: 0.2s;
          box-shadow: 0 4px 0px #b8050f;
        }
        
        .btn-submit:hover { 
          transform: translateY(2px); 
          box-shadow: 0 2px 0px #8a040b; 
        }

        .btn-submit:active {
          transform: translateY(4px);
          box-shadow: none;
        }
        .btn-submit:disabled {
          background: #cbd5e1;
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }

        /* --- RESPONSIVO --- */
        @media (max-width: 600px) {
          .row { grid-template-columns: 1fr; gap: 15px; }
          .sislexi-card { padding: 20px; box-shadow: 8px 8px 0px #0f172a; }
          .content { padding: 15px; }
          .report-title { font-size: 26px; }
        }
      `}</style>
    </div>
  );
}