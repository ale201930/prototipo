"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase"; 
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  updateDoc 
} from "firebase/firestore";

const ESTADOS_ACCESO = [
  "Activo (Acceso Permitido)",
  "Suspendido",
  "Inactivo"
];

export default function UsuariosContratas() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const q = query(collection(db, "contratistas"), orderBy("fechaRegistro", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsuarios(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEliminar = async (id, nombre) => {
    if (window.confirm(`Â¿Eliminar a ${nombre} de la base de datos de contratas?`)) {
      try {
        await deleteDoc(doc(db, "contratistas", id));
      } catch (error) {
        alert("Error: " + error.message);
      }
    }
  };

  const cambiarEstatus = async (id, nuevoEstatus) => {
    try {
      await updateDoc(doc(db, "contratistas", id), { estadoNominal: nuevoEstatus });
    } catch {
      alert("No se pudo actualizar el estatus.");
    }
  };

  const irAEditar = (id) => {
    if (!id) return;
    router.push(`/proteccion-fisica/registro-de-contratas?edit=${id}`);
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const texto = busqueda.toLowerCase();
    return (
      u.nombres?.toLowerCase().includes(texto) ||
      u.apellidos?.toLowerCase().includes(texto) ||
      u.cedula?.includes(texto) ||
      u.nombreContrata?.toLowerCase().includes(texto)
    );
  });

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÃ“N */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-building-columns text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-655 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/proteccion-fisica")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">

        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
              Base de Datos de Contratas
            </h1>
            <div className="mt-2 inline-flex px-3 py-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 rounded-xl text-xxs font-black tracking-wider uppercase">
              Total: {usuariosFiltrados.length}
            </div>
          </div>
        </header>

        {/* FILTROS Y ACCIONES */}
        <div className="p-4 bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-2xl print:hidden relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          <div className="relative w-full md:flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              <i className="fas fa-search"></i>
            </span>
            <input 
              type="text" 
              placeholder="Buscar por Nombre, CÃ©dula, Empresa..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
            />
          </div>

          <button 
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-655 hover:text-indigo-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95 w-full md:w-auto shadow-sm"
          >
            <i className="fas fa-print"></i> Imprimir Lista
          </button>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl overflow-hidden shadow-2xl p-4 md:p-6 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          {loading ? (
            <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-red-500 animate-pulse font-sans">
              <i className="fas fa-spinner fa-spin mr-2"></i> Conectando con la base de datos... Cargando contratistas...
            </div>
          ) : (
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">CÃ‰DULA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">NOMBRES Y APELLIDOS</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">CONTRATA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÃREA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS ACCESO</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center no-print font-mono">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-450 font-bold italic text-sm font-sans">
                        No se encontraron contratistas registrados.
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 border-b border-slate-100/60 transition-colors">
                        
                        {/* CÃ©dula */}
                        <td className="py-4 px-3 text-center font-bold text-slate-600 text-sm font-mono">
                          {user.cedula}
                        </td>

                        {/* Nombre Completo */}
                        <td className="py-4 px-3 text-left font-extrabold text-indigo-950 text-sm uppercase">
                          {user.nombres} {user.apellidos}
                        </td>

                        {/* Contrata */}
                        <td className="py-4 px-3 text-center">
                          <span className="px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">
                            {user.nombreContrata}
                          </span>
                        </td>

                        {/* Ãrea */}
                        <td className="py-4 px-3 text-left text-xs font-semibold text-slate-500">
                          {user.areaTrabajo || "No especificada"}
                        </td>

                        {/* Estatus dropdown */}
                        <td className="py-4 px-3 text-center">
                          <div className="relative inline-block w-48">
                            <select 
                              className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xxs font-black uppercase tracking-wider cursor-pointer focus:outline-none transition-all ${user.estadoNominal?.includes('Activo') ? 'border-emerald-500/40 text-emerald-600' : 'border-red-500/40 text-red-600'}`}
                              value={user.estadoNominal || "Activo (Acceso Permitido)"}
                              onChange={(e) => cambiarEstatus(user.id, e.target.value)}
                            >
                              {ESTADOS_ACCESO.map((est) => (
                                <option key={est} value={est} className="bg-white text-slate-700">
                                  {est}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-4 px-3 text-center no-print">
                          <div className="flex gap-2 justify-center items-center">
                            
                            <button 
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-950 p-2 rounded-xl text-xxs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer h-8 px-3 flex items-center justify-center gap-1 shadow-sm"
                              onClick={() => irAEditar(user.id)}
                            >
                              <i className="fas fa-edit"></i> Editar
                            </button>

                            <button 
                              className="bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 p-2 rounded-xl text-xxs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer w-8 h-8 flex items-center justify-center shadow-sm"
                              onClick={() => handleEliminar(user.id, user.nombres)}
                            >
                              <i className="fas fa-trash-alt text-red-500"></i>
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

