"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  getCountFromServer 
} from "firebase/firestore";

export default function AsistenciaContratas() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("TODAS");
  const [asistencias, setAsistencias] = useState([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState([]);
  const [fechaHoyStr, setFechaHoyStr] = useState("");
  const [resumen, setResumen] = useState({ presentes: 0, totalNomina: 0 });

  useEffect(() => {
    setMounted(true);
    
    const ahora = new Date();
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    setFechaHoyStr(ahora.toLocaleDateString('es-ES', opciones).toUpperCase());

    // 1. Obtener el total de contratistas registrados en el sistema
    const obtenerTotalContratas = async () => {
      try {
        const coll = collection(db, "contratistas");
        const snapshot = await getCountFromServer(coll);
        setResumen(prev => ({ ...prev, totalNomina: snapshot.data().count }));
      } catch (error) { console.error(error); }
    };
    obtenerTotalContratas();

    // 2. Escuchar asistencias de HOY
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "asistencias"),
      where("fechaHora", ">=", inicioHoy),
      where("tipoPersonal", "==", "CONTRATISTA"), 
      orderBy("fechaHora", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAsistencias(lista);

      const empresasSet = new Set(lista.map(a => a.nombreContrata || "Sin Empresa"));
      setEmpresasDisponibles(Array.from(empresasSet).sort());

      const adentro = lista.filter(a => a.entrada && !a.salida).length;
      setResumen(prev => ({ ...prev, presentes: adentro }));
    });

    return () => unsubscribe();
  }, []);

  const jsonFiltrada = asistencias.filter(a => {
    const texto = filtro.toLowerCase();
    const cumpleTexto = (a.nombreCompleto?.toLowerCase() || "").includes(texto) ||
                        (a.cedula?.toLowerCase() || "").includes(texto);
    const cumpleEmpresa = filtroEmpresa === "TODAS" || a.nombreContrata === filtroEmpresa;
    return cumpleTexto && cumpleEmpresa;
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÃ“N */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-building-columns text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded-lg text-xxs font-black tracking-wider uppercase text-cyan-600 animate-pulse flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> Monitoreo en Vivo
          </div>
          <button 
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
            onClick={() => router.push("/proteccion-fisica")}
          >
            <i className="fas fa-arrow-left mr-2"></i> Volver
          </button>
        </div>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
              Control de Acceso
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
              Reporte diario de personal externo y contratas
            </p>
          </div>
          <div className="px-4 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-black text-cyan-600 uppercase self-start sm:self-auto shadow-md font-mono">
            {fechaHoyStr}
          </div>
        </header>

        {/* METRICS RESUMEN */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 print:hidden">
          
          <div className="p-6 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl flex items-center justify-between shadow-neon-cyan/5">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div>
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-1">Personal en Planta</span>
              <p className="text-4xl font-black text-indigo-950">{resumen.presentes}</p>
            </div>
            <div className="text-cyan-500/10 text-5xl group-hover:text-cyan-500/25 transition-colors">
              <i className="fas fa-sign-in-alt"></i>
            </div>
          </div>

          <div className="p-6 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl flex items-center justify-between shadow-neon-purple/5">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div>
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-1">Total Registrados</span>
              <p className="text-4xl font-black text-cyan-600">{resumen.totalNomina}</p>
            </div>
            <div className="text-indigo-500/10 text-5xl group-hover:text-indigo-500/25 transition-colors">
              <i className="fas fa-id-card"></i>
            </div>
          </div>

        </section>

        {/* TABLA ACCIONES */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl overflow-hidden shadow-2xl p-4 md:p-6 space-y-6 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          <div className="p-4 bg-white/90 border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 print:hidden shadow-sm">
            <div className="relative w-full md:flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                <i className="fas fa-search"></i>
              </span>
              <input 
                type="text" 
                placeholder="Buscar por Nombre o CÃ©dula..." 
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
              />
            </div>
            
            <div className="flex w-full md:w-auto gap-3">
              <select 
                value={filtroEmpresa} 
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="w-full md:w-56 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold cursor-pointer uppercase"
              >
                <option value="TODAS">TODAS LAS EMPRESAS</option>
                {empresasDisponibles.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>

              <button 
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-indigo-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <i className="fas fa-print"></i> PDF / Imprimir
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full no-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">IDENTIFICACIÃ“N</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">PERSONAL EXTERNO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">EMPRESA / CONTRATA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÃREA DE TRABAJO</th> 
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ENTRADA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">SALIDA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {jsonFiltrada.length > 0 ? (
                  jsonFiltrada.map((reg) => (
                    <tr key={reg.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-3 text-center font-bold text-slate-600 text-sm font-mono">
                        {reg.cedula}
                      </td>
                      <td className="py-4 px-3 text-left font-extrabold text-indigo-950 text-sm uppercase">
                        {reg.nombreCompleto}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className="px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">
                          {reg.nombreContrata}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-left text-xs font-semibold text-slate-500">
                        {reg.area || "No especificada"}
                      </td>
                      <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                        {reg.entrada ? (
                          <span className="flex items-center justify-center gap-1">
                            <i className="fas fa-sign-in-alt text-emerald-600 text-xxs"></i> {reg.entrada}
                          </span>
                        ) : (
                          <span className="text-slate-400">--:--</span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                        {reg.salida ? (
                          <span className="flex items-center justify-center gap-1">
                            <i className="fas fa-sign-out-alt text-red-500 text-xxs"></i> {reg.salida}
                          </span>
                        ) : (
                          <span className="text-slate-400">--:--</span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${!reg.salida ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          â— {!reg.salida ? "EN PLANTA" : "RETIRADO"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 font-bold italic text-sm font-mono">
                      Sin registros para hoy
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}

