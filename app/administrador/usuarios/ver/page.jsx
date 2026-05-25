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

  if (!user) return <div className="cargando">Cargando datos del personal...</div>;

  return (
    <div className="layout">
      
      {/* BARRA DE NAVEGACIÓN SUPERIOR UNIFICADA */}
      <nav className="top-nav">
        <div className="logo">
          SYSTEM-CONTROL <span className="red-text">INVECEM</span>
        </div>
        <button className="btn-panel" onClick={() => router.push("/administrador/usuarios")}>
          ← VOLVER
        </button>
      </nav>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <div className="content">
        
        {/* ENCABEZADO DE REPORTE TÉCNICO */}
        <header className="report-header">
          <h1 className="report-title">Expediente Digital</h1>
          <p className="subtitle-header">Visualización detallada de datos maestros y credenciales del Usuario </p>
        </header>

        {/* TARJETA PRINCIPAL EN TARJETA SHADOW-RELIEF */}
        <div className="card shadow-relief mt-20">
          <div className="sislexi-card">
            
            {/* ESTATUS EN LA PARTE SUPERIOR DE LA TARJETA */}
            <div style={{ marginBottom: "25px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={`status-pill ${user.estado === "Activo" ? "active" : "inactive"}`}>
                ● {user.estado || "Activo"}
              </span>
              <span className="role-tag">{user.rol}</span>
            </div>

            {/* SECCIÓN 1: DATOS PERSONALES */}
            <section className="form-section">
              <h3 className="section-title">Datos Personales</h3>
              <div className="row">
                <div className="field">
                  <label>Nombres y Apellidos</label>
                  <input type="text" value={user.nombres || user.usuario || ""} disabled className="disabled-input" />
                </div>
                <div className="field">
                  <label>Cédula de Identidad</label>
                  <input type="text" value={user.cedula || ""} disabled className="disabled-input" />
                </div>
              </div>
              
              <div className="row">
                <div className="field">
                  <label>Nacionalidad</label>
                  <input type="text" value={user.nacionalidad || "No registrada"} disabled className="disabled-input" />
                </div>
                <div className="field">
                  <label>Fecha de Nacimiento</label>
                  <input type="text" value={user.fechaNac || "No registrada"} disabled className="disabled-input" />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label>Teléfono de Contacto</label>
                  <input type="text" value={user.telefono || "No registrado"} disabled className="disabled-input" />
                </div>
                <div className="field">
                  <label>Correo Institucional</label>
                  <input type="text" value={user.correo || ""} disabled className="disabled-input" />
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: INFORMACIÓN LABORAL */}
            <section className="form-section">
              <h3 className="section-title">Información Laboral</h3>
              <div className="row">
                <div className="field">
                  <label>N° de Ficha</label>
                  <input type="text" value={user.ficha || "N/A"} disabled className="disabled-input" style={{ color: "#e30613", fontWeight: "800" }} />
                </div>
                <div className="field">
                  <label>Cargo / Puesto</label>
                  <input type="text" value={user.cargo || "Sin cargo asignado"} disabled className="disabled-input" />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label>Departamento / Unidad</label>
                  <input type="text" value={user.departamento || "Sin unidad asignada"} disabled className="disabled-input" />
                </div>
                <div className="field">
                  <label>Fecha de Ingreso</label>
                  <input type="text" value={user.fechaIngreso || "No registrada"} disabled className="disabled-input" />
                </div>
              </div>
            </section>

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

        /* --- ENCABEZADO DE REPORTE --- */
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

        /* --- TARJETA PRINCIPAL NEOMÓRFICA INDUSTRIAL (SHADOW RELIEF) --- */
        .card { 
          background: white; 
          border-radius: 24px; 
          overflow: hidden;
          margin-top: 20px;
        }

        .shadow-relief {
          border: 1px solid #e2e8f0;
          border-top: 8px solid #e30613; 
          box-shadow: 12px 12px 0px #0f172a; 
        }

        .sislexi-card {
          padding: 45px;
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

        input { 
          padding: 13px; 
          border: 2px solid #f1f5f9; 
          border-radius: 10px; 
          font-size: 0.88rem;
          font-weight: 600;
          color: #1e293b;
          outline: none;
        }

        /* ESTADO DESHABILITADO / SOLO LECTURA */
        .disabled-input { 
          background: #f1f5f9; 
          color: #475569; 
          cursor: not-allowed; 
          border-style: solid;
        }

        .role-tag {
          background: #f1f5f9;
          color: #334155;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          border: 1px solid #e2e8f0;
          display: inline-block;
        }

        /* --- CAPSULAS DE ESTATUS --- */
        .status-pill { 
          padding: 5px 12px; 
          border-radius: 8px; 
          font-size: 10px; 
          font-weight: 900; 
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .active { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .inactive { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

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
          .sislexi-card { padding: 25px; }
          .card.shadow-relief { box-shadow: 8px 8px 0px #0f172a; }
          .content { padding: 15px; }
          .report-title { font-size: 26px; }
        }
      `}</style>
    </div>
  );
}