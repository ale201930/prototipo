"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../../../lib/firebase"; 
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

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 2. GUARDAR LOS CAMBIOS EN FIRESTORE
  const handleActualizar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const docRef = doc(db, "usuarios", userId);
      await updateDoc(docRef, formData);
      alert("✅ Expediente actualizado correctamente");
      router.push("/administrador/usuarios");
    } catch (error) {
      console.error("Error al actualizar:", error);
      alert("Error al actualizar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  if (!formData) return <div className="cargando">Cargando datos del personal...</div>;

  return (
    <div className="layout">
      
      {/* BARRA DE NAVEGACIÓN SUPERIOR UNIFICADA */}
      <nav className="top-nav">
        <div className="logo">
         SYSTEM-CONTROL <span className="red-text">INVECEM</span>
        </div>
        <button className="btn-panel" onClick={() => router.back()}>
          ← VOLVER
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="content">
        
        {/* ENCABEZADO DE REPORTE TÉCNICO */}
        <header className="report-header">
          <h1 className="report-title">Modificar Expediente</h1>
          <p className="subtitle-header">Actualización de datos maestros del colaborador en el sistema de planta</p>
        </header>

        {/* TARJETA EN SHADOW RELIEF / SCONTRALUZ SÓLIDO */}
        <form onSubmit={handleActualizar} className="sislexi-card shadow-relief">
          
          {/* SECCIÓN 1: CREDENCIALES (Lectura) */}
          <section className="form-section">
            <h3 className="section-title">Credenciales de Acceso</h3>
            <div className="row">
              <div className="field">
                <label>CORREO INSTITUCIONAL</label>
                <input name="correo" type="email" value={formData.correo} disabled className="disabled-input" />
              </div>
              <div className="field">
                <label>UID DE SISTEMA</label>
                <input value={userId} disabled className="disabled-input" />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: INFO PERSONAL */}
          <section className="form-section">
            <h3 className="section-title">Información Personal</h3>
            <div className="row">
              <div className="field">
                <label>NOMBRES Y APELLIDOS</label>
                <input name="nombres" type="text" value={formData.nombres || ""} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>CÉDULA DE IDENTIDAD</label>
                <input name="cedula" type="text" value={formData.cedula || ""} onChange={handleChange} required />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>TELÉFONO</label>
                <input name="telefono" type="text" value={formData.telefono || ""} onChange={handleChange} />
              </div>
              <div className="field">
                <label>FECHA NACIMIENTO</label>
                <input name="fechaNac" type="date" value={formData.fechaNac || ""} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: FICHA LABORAL */}
          <section className="form-section">
            <h3 className="section-title">Ficha Laboral de Planta</h3>
            <div className="row">
              <div className="field">
                <label>N° DE FICHA</label>
                <input name="ficha" type="text" value={formData.ficha || ""} onChange={handleChange} required />
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
                <input name="cargo" type="text" value={formData.cargo || ""} onChange={handleChange} />
              </div>
              <div className="field">
                <label>DEPARTAMENTO</label>
                <input name="departamento" type="text" value={formData.departamento || ""} onChange={handleChange} />
              </div>
            </div>

            {/* FECHA DE INGRESO */}
            <div className="row">
              <div className="field">
                <label>FECHA DE INGRESO A LA EMPRESA</label>
                <input 
                  name="fechaIngreso" 
                  type="date" 
                  value={formData.fechaIngreso || ""} 
                  onChange={handleChange} 
                  required 
                />
              </div>
            </div>
          </section>

          <button type="submit" className="btn-submit" disabled={cargando}>
            {cargando ? "Actualizando..." : "Guardar Cambios en el Expediente"}
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
        .content { padding: 30px; max-width: 850px; margin: 0 auto; }

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
        }

        /* --- TARJETA PRINCIPAL (SHADOW RELIEF) --- */
        .sislexi-card { 
          background: white; 
          padding: 45px; 
          border-radius: 24px; 
        }

        .shadow-relief {
          border: 1px solid #e2e8f0;
          border-top: 8px solid #e30613; /* Rojo Institucional */
          box-shadow: 12px 12px 0px #0f172a; /* Sombra sólida neomórfica */
        }

        /* --- TÍTULOS DE SECCIÓN INTERNOS --- */
        .section-title { 
          color: #e30613; 
          font-size: 11px; 
          font-weight: 900;
          text-transform: uppercase; 
          border-bottom: 2px solid #f1f5f9; 
          padding-bottom: 8px; 
          margin: 35px 0 20px; 
          letter-spacing: 0.5px;
        }

        /* --- DISEÑO DE FILAS Y CAMPOS --- */
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 15px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        
        label { 
          font-size: 10px; 
          font-weight: 800; 
          color: #0f172a; 
          text-transform: uppercase; 
        }

        input, select { 
          padding: 13px; 
          border: 2px solid #f1f5f9; 
          border-radius: 10px; 
          font-size: 0.88rem;
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

        /* ESTADO DESHABILITADO POR SEGURIDAD */
        .disabled-input { 
          background: #f1f5f9; 
          color: #94a3b8; 
          cursor: not-allowed; 
          border-style: dashed;
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
          margin-top: 35px; 
          transition: 0.2s;
          box-shadow: 0 4px 0px #b8050f;
          letter-spacing: 0.5px;
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

        /* --- PANTALLA DE CARGA GLOBAL --- */
        .cargando { 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          font-weight: 900; 
          font-size: 12px;
          color: #0f172a; 
          text-transform: uppercase;
          letter-spacing: 2px;
          background: #f0f4f8;
        }

        /* --- RESPONSIVO --- */
        @media (max-width: 600px) {
          .row { grid-template-columns: 1fr; gap: 15px; }
          .sislexi-card { padding: 25px; box-shadow: 8px 8px 0px #0f172a; }
          .content { padding: 15px; }
          .report-title { font-size: 26px; }
        }
      `}</style>
    </div>
  );
}