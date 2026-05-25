"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase"; 
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc,
  deleteDoc
} from "firebase/firestore";

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState("");
  const router = useRouter();

  // 1. CARGA EN TIEMPO REAL
  useEffect(() => {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef); 
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setUsuarios(docs);
    }, (error) => {
      console.error("Error en Snapshot:", error);
    });
    
    return () => unsubscribe();
  }, []);

  // 2. FILTRADO PARA LA BARRA DE BÚSQUEDA
  const usuariosFiltrados = usuarios.filter(u => 
    u.nombres?.toLowerCase().includes(filtro.toLowerCase()) ||
    u.ficha?.includes(filtro) ||
    u.cedula?.includes(filtro) ||
    u.rol?.toLowerCase().includes(filtro.toLowerCase())
  );

  const eliminarUsuario = async (id, nombreUser) => {
    if (confirm(`¿Eliminar a ${nombreUser}?\nEsta acción borrará sus datos de la base de datos.`)) {
      try {
        await deleteDoc(doc(db, "usuarios", id));
      } catch (error) {
        console.error("Error:", error);
      }
    }
  };

  const toggleEstado = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "Activo" ? "Inactivo" : "Activo";
    try {
      await updateDoc(doc(db, "usuarios", id), { estado: nuevoEstado });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="layout">
      
      {/* BARRA DE NAVEGACIÓN SUPERIOR UNIFICADA */}
      <nav className="top-nav">
        <div className="logo">
          SYSTEM-CONTROL <span className="red-text">INVECEM</span>
        </div>
        <button className="btn-panel" onClick={() => router.push("/administrador")}>
          ← VOLVER
        </button>
      </nav>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <div className="content">
        
        {/* ENCABEZADO DE REPORTE TÉCNICO */}
        <header className="report-header">
          <h1 className="report-title">Gestión de Usuarios</h1>
          <p className="subtitle-header">Administración, control de estatus y asignación de roles para el personal de planta</p>
        </header>

        {/* BARRA DE ACCIONES (BÚSQUEDA Y REGISTRO) */}
        <div className="action-bar shadow-relief">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por Nombre, Ficha, Cédula, Rol..." 
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <button className="btn-registrar" onClick={() => router.push("/administrador/usuarios/nuevo-usuario")}>
            + Registrar Nuevo
          </button>
        </div>

        {/* TABLA PRINCIPAL EN TARJETA SHADOW-RELIEF */}
        <div className="card shadow-relief mt-20">
          <div className="table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>ESTATUS</th>
                  <th>FICHA</th>
                  <th>CÉDULA</th>
                  <th>NOMBRES Y APELLIDOS</th>
                  <th>CARGO / DEPARTAMENTO</th>
                  <th>ROL</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-message">No se encontraron usuarios en los registros.</td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span className={`status-pill ${user.estado === "Activo" ? "active" : "inactive"}`}>
                          ● {user.estado || "Activo"}
                        </span>
                      </td>
                      <td className="bold-blue">{user.ficha || "N/A"}</td>
                      <td className="bold-text">{user.cedula}</td>
                      <td className="name-text">{user.nombres || user.usuario}</td>
                      <td>
                        <div className="cargo-main">{user.cargo || "Sin cargo"}</div>
                        <div className="unidad-sub">{user.departamento || "Sin unidad"}</div>
                      </td>
                      <td>
                        <span className="role-tag">{user.rol}</span>
                      </td>
                      <td className="actions-cell">
                        <button 
                          className="btn-icon view" 
                          title="Ver Perfil"
                          onClick={() => router.push(`/administrador/usuarios/ver?id=${user.id}`)}
                        >
                          👁️
                        </button>
                        <button 
                          className="btn-icon edit" 
                          title="Editar"
                          onClick={() => router.push(`/administrador/usuarios/editar?id=${user.id}`)}
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-icon block" 
                          onClick={() => toggleEstado(user.id, user.estado)}
                          title="Bloquear/Activar"
                        >
                          🚫
                        </button>
                        <button 
                          className="btn-icon delete" 
                          onClick={() => eliminarUsuario(user.id, user.nombres)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
        .content { padding: 30px; max-width: 1200px; margin: 0 auto; }

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

        /* --- BARRA DE ACCIÓN INTERMEDIA --- */
        .action-bar { 
          display: flex; 
          justify-content: space-between; 
          gap: 15px; 
          margin-bottom: 25px; 
          padding: 20px; 
          background: white;
          border-radius: 18px;
          align-items: center;
        }

        .search-container { position: relative; flex: 1; display: flex; align-items: center; }
        .search-icon { position: absolute; left: 15px; color: #94a3b8; font-size: 14px; }
        .search-container input { 
          width: 100%; 
          padding: 12px 12px 12px 45px; 
          border: 2px solid #f1f5f9; 
          border-radius: 12px; 
          font-weight: 600;
          font-size: 0.9rem;
          outline: none;
          background: #f8fafc;
          transition: 0.3s;
        }
        .search-container input:focus {
          border-color: #e30613;
          background: white;
        }

        .btn-registrar { 
          background: #e30613; 
          color: white; 
          border: none; 
          padding: 12px 25px; 
          border-radius: 12px; 
          font-weight: 900; 
          font-size: 12px;
          text-transform: uppercase;
          cursor: pointer; 
          transition: 0.2s;
          box-shadow: 0 4px 0px #b8050f;
          white-space: nowrap;
        }
        .btn-registrar:hover { transform: translateY(2px); box-shadow: 0 2px 0px #8a040b; }
        .btn-registrar:active { transform: translateY(4px); box-shadow: none; }

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

        .table-wrapper { overflow-x: auto; }
        
        /* --- ESTILOS DE LA TABLA --- */
        .user-table { width: 100%; border-collapse: collapse; }
        .user-table th { 
          background: #f8fafc; 
          padding: 18px; 
          font-size: 11px; 
          color: #64748b; 
          text-transform: uppercase; 
          font-weight: 900;
          border-bottom: 3px solid #e30613; 
          text-align: center;
          letter-spacing: 0.5px;
        }

        .user-table td { 
          padding: 16px 18px; 
          border-bottom: 1px solid #f1f5f9; 
          font-size: 0.88rem; 
          color: #334155;
          text-align: center;
          vertical-align: middle;
        }
        .user-table tr:hover td { background-color: #f8fafc; }

        /* --- DETALLES DE CELDAS --- */
        .bold-blue { color: #e30613; font-weight: 800; font-size: 0.9rem; }
        .bold-text { font-weight: 700; color: #0f172a; }
        .name-text { font-weight: 700; color: #1e293b; text-align: left !important; }
        
        .cargo-main { font-weight: 700; color: #0f172a; font-size: 0.85rem; }
        .unidad-sub { font-weight: 600; color: #64748b; font-size: 0.75rem; text-transform: uppercase; margin-top: 2px; }

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

        /* --- BOTONES DE ACCIÓN EN CELDAS --- */
        .actions-cell { display: flex; gap: 8px; justify-content: center; align-items: center; }
        .btn-icon { 
          background: white; 
          border: 1px solid #cbd5e1; 
          padding: 8px; 
          border-radius: 10px; 
          cursor: pointer; 
          font-size: 14px;
          transition: 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-icon:hover { transform: scale(1.1); background: #f8fafc; color: #0f172a; border-color: #0f172a; }
        .btn-icon.delete:hover { background: #fee2e2; border-color: #ef4444; }

        .empty-message { padding: 40px !important; color: #64748b; font-weight: 600; font-style: italic; }

        /* --- RESPONSIVO --- */
        @media (max-width: 768px) {
          .content { padding: 15px; }
          .report-title { font-size: 28px; }
          .action-bar { flex-direction: column; align-items: stretch; }
          .btn-registrar { width: 100%; text-align: center; }
          .card.shadow-relief { box-shadow: 8px 8px 0px #0f172a; }
        }
      `}</style>
    </div>
  );
}