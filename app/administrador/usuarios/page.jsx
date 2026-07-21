"use client";

import React, { useState, useEffect } from "react";

import { useRouter } from "next/navigation";
import { db, registrarAccion } from "../../lib/firebase"; 
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc
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

  const toggleEstado = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "Activo" ? "Inactivo" : "Activo";
    try {
      await updateDoc(doc(db, "usuarios", id), { estado: nuevoEstado });
      const targetUser = usuarios.find(u => u.id === id);
      const targetName = targetUser ? (targetUser.nombres || targetUser.usuario) : id;
      const targetRol = targetUser ? targetUser.rol : "Desconocido";
      registrarAccion(null, null, `Estatus de usuario cambiado: ${targetName} (${targetRol}) a ${nuevoEstado}`, "Control de Usuarios");
    } catch (error) {
      console.error("Error:", error);
    }
  };

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
          onClick={() => router.push("/administrador")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <div className="max-w-6xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE TÉCNICO */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            Gestión de Usuarios
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Administración, control de estatus y asignación de roles para el personal de planta
          </p>
        </header>

        {/* BARRA DE ACCIONES (BÚSQUEDA Y REGISTRO) */}
        <div className="p-4 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-xl shadow-slate-200/20">
          <div className="relative w-full md:flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500">
              <i className="fas fa-search"></i>
            </span>
            <input 
              type="text" 
              placeholder="Buscar por Nombre, Ficha, Cédula, Rol..." 
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold shadow-sm"
            />
          </div>
          <button 
            className="w-full md:w-auto px-6 py-3.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-purple transition-all duration-200 transform cursor-pointer flex items-center justify-center gap-2"
            onClick={() => router.push("/administrador/usuarios/nuevo-usuario")}
          >
            <i className="fas fa-plus"></i> Registrar Nuevo
          </button>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white/85 backdrop-blur-lg border border-slate-200/60 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/20 p-4 md:p-6 relative shadow-neon-cyan">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          <div className="overflow-x-auto w-full no-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-center">ESTATUS</th>
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-center">FICHA</th>
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-center">CÉDULA</th>
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-left">NOMBRES Y APELLIDOS</th>
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-left">CARGO / DEPARTAMENTO</th>
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-center">ROL</th>
                  <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-3 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500 font-bold italic text-sm">No se encontraron usuarios en los registros.</td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                      <td className="py-4 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${user.estado === "Activo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                          ● {user.estado || "Activo"}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-center font-black text-cyan-600 text-sm font-mono">{user.ficha || "---"}</td>
                      <td className="py-4 px-3 text-center font-bold text-slate-600 text-sm">{user.cedula}</td>
                      <td className="py-4 px-3 text-left font-extrabold text-slate-800 text-sm uppercase">{user.nombres || user.usuario}</td>
                      <td className="py-4 px-3 text-left">
                        <div className="font-extrabold text-indigo-600 text-xs uppercase">{user.cargo || "Sin cargo"}</div>
                        <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5">{user.departamento || "Sin unidad"}</div>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">{user.rol}</span>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          <button 
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 p-2 rounded-xl text-xs transition-all active:scale-90 cursor-pointer flex items-center justify-center w-8 h-8" 
                            title="Ver Perfil"
                            onClick={() => router.push(`/administrador/usuarios/ver?id=${user.id}`)}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 p-2 rounded-xl text-xs transition-all active:scale-90 cursor-pointer flex items-center justify-center w-8 h-8" 
                            title="Editar"
                            onClick={() => router.push(`/administrador/usuarios/editar?id=${user.id}`)}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 p-2 rounded-xl text-xs transition-all active:scale-90 cursor-pointer flex items-center justify-center w-8 h-8" 
                            onClick={() => toggleEstado(user.id, user.estado)}
                            title="Bloquear/Activar"
                          >
                            <i className="fas fa-ban"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

