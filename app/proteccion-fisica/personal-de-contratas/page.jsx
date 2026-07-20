"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, registrarAccion } from "@/app/lib/firebase"; 
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
  "Inactivo"
];

export default function PersonalContratas() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [modalEliminar, setModalEliminar] = useState({ open: false, id: null, nombre: "" });

  useEffect(() => {
    setIsClient(true);
    const q = query(collection(db, "contratistas"), orderBy("fechaRegistro", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        const cedulaClean = (data.cedula || "").replace(/\D/g, "");
        const idAcceso5 = cedulaClean.length >= 5 ? cedulaClean.slice(-5) : (data.idAcceso || "-----");
        return {
          id: doc.id,
          ...data,
          idAcceso: idAcceso5
        };
      });
      setUsuarios(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEliminar = (id, nombre) => {
    setModalEliminar({ open: true, id, nombre });
  };

  const confirmarEliminar = async () => {
    const { id, nombre } = modalEliminar;
    setModalEliminar({ open: false, id: null, nombre: "" });
    try {
      await deleteDoc(doc(db, "contratistas", id));
      registrarAccion(
        null,
        null,
        `Contratista eliminado: ${nombre}`,
        "Gestión de Contratistas"
      );
    } catch (error) {
      console.error("Error:", error.message);
    }
  };

  const cambiarEstatus = async (id, nuevoEstatus) => {
    try {
      await updateDoc(doc(db, "contratistas", id), { estadoNominal: nuevoEstatus });
      const targetUser = usuarios.find(u => u.id === id);
      const targetName = targetUser ? `${targetUser.nombres} ${targetUser.apellidos}` : id;
      registrarAccion(
        null, 
        null, 
        `Estatus de acceso a planta de contratista cambiado: ${targetName} a ${nuevoEstatus}`, 
        "Gestión de Contratistas"
      );
    } catch {
      alert("No se pudo actualizar el estatus.");
    }
  };

  const irAEditar = (id) => {
    if (!id) return;
    router.push(`/proteccion-fisica/personal-de-contratas/registro-de-contratas?edit=${id}`);
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

      {/* MODAL DE CONFIRMACIÓN ELIMINAR */}
      {modalEliminar.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,15,30,0.65)', backdropFilter: 'blur(8px)' }}>
          <div
            className="relative w-full max-w-sm rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5"
            style={{ background: 'linear-gradient(145deg, #fff 0%, #f8fafc 100%)', border: '1px solid rgba(239,68,68,0.18)', boxShadow: '0 30px 80px rgba(239,68,68,0.15), 0 0 0 1px rgba(239,68,68,0.08)' }}
          >
            {/* Icono */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.15))', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="fas fa-trash-alt text-2xl text-red-500" />
            </div>

            {/* Texto */}
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">¿Eliminar registro?</h2>
              <p className="text-slate-500 text-sm mt-1 font-medium">Esta acción no se puede deshacer.</p>
              <p className="mt-3 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl text-red-600 font-black text-xs uppercase tracking-wider">
                {modalEliminar.nombre}
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setModalEliminar({ open: false, id: null, nombre: "" })}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all duration-200 active:scale-95"
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
                onMouseEnter={e => e.currentTarget.style.background='#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background='#f1f5f9'}
              >
                <i className="fas fa-times mr-1" /> Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white cursor-pointer transition-all duration-200 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 6px 20px rgba(239,68,68,0.5)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 14px rgba(239,68,68,0.35)'}
              >
                <i className="fas fa-trash-alt mr-1" /> Sí, eliminar
              </button>
            </div>

            {/* Decoración corner */}
            <div className="absolute top-3 left-3 font-mono text-[8px] text-red-300 select-none">[!]</div>
            <div className="absolute top-3 right-3 font-mono text-[8px] text-red-300 select-none">[!]</div>
          </div>
        </div>
      )}
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-655 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/proteccion-fisica")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">

        {/* ENCABEZADO DE IMPRESIÓN */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6 w-full">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo Invecem" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-black uppercase text-indigo-955 tracking-tight">INVECEM</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Listado de Personal de Contratas</p>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-slate-500">
            <div>Fecha Emisión: {new Date().toLocaleDateString()}</div>
            <div>Total: {usuariosFiltrados.length} contratistas</div>
          </div>
        </div>

        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-indigo-955 uppercase">
              Personal de Contratas
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
          
          {/* Buscador */}
          <div className="relative w-full md:flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              <i className="fas fa-search"></i>
            </span>
            <input 
              type="text" 
              placeholder="Buscar por Nombre, Cédula, Empresa..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            {/* Registrar Nuevo */}
            <button
              onClick={() => router.push("/proteccion-fisica/personal-de-contratas/registro-de-contratas")}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 w-full md:w-auto shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan"
            >
              <i className="fas fa-plus"></i> Registrar Nuevo
            </button>

            {/* Imprimir */}
            <button 
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-650 hover:text-red-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95 w-full md:w-auto shadow-sm border border-slate-200"
            >
              <i className="fas fa-print"></i> Imprimir Lista
            </button>
          </div>
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
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">CÉDULA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ID-ACCESO</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">NOMBRES Y APELLIDOS</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">CONTRATA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÁREA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS ACCESO</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center no-print font-mono">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-450 font-bold italic text-sm font-sans">
                        No se encontraron contratistas registrados.
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 border-b border-slate-100/60 transition-colors">
                        
                        {/* Cédula */}
                        <td className="py-4 px-3 text-center font-bold text-slate-600 dark:text-slate-300 text-sm font-mono">
                          {user.cedula}
                        </td>

                        {/* ID-Acceso */}
                        <td className="py-4 px-3 text-center font-extrabold text-cyan-600 dark:text-cyan-400 text-xs font-mono">
                          {user.idAcceso || (user.cedula ? user.cedula.slice(-5) : "-----")}
                        </td>

                        {/* Nombre Completo */}
                        <td className="py-4 px-3 text-left font-extrabold text-indigo-955 text-sm uppercase">
                          {user.nombres} {user.apellidos}
                        </td>

                        {/* Contrata */}
                        <td className="py-4 px-3 text-center">
                          <span className="px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-600 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">
                            {user.nombreContrata || user.empresaContratista || user.empresa || "NO ESPECIFICADA"}
                          </span>
                        </td>

                        {/* Área */}
                        <td className="py-4 px-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase">
                          {user.areaTrabajo || user.areaAsignada || user.area || "NO ESPECIFICADA"}
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
