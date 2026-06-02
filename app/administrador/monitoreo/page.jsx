"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase'; 
import { collection, query, onSnapshot, orderBy, limit, getCountFromServer } from 'firebase/firestore';

export default function MonitoreoPage() {
  const router = useRouter();
  
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [alertasSeguridad, setAlertasSeguridad] = useState(0);
  const [eventos, setEventos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const obtenerConteoUsuarios = async () => {
      const coll = collection(db, "usuarios");
      const snapshot = await getCountFromServer(coll);
      setTotalUsuarios(snapshot.data().count);
    };

    const q = query(
      collection(db, "auditoria"), 
      orderBy("fecha", "desc"), 
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const datos = snapshot.docs.map(doc => {
        const data = doc.data();
        const fechaReal = data.fecha?.toDate();
        const fechaFormateada = fechaReal ? fechaReal.toLocaleString('es-VE', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : 'Cargando...';

        return {
          id: doc.id,
          ...data,
          fechaFormateada
        };
      });

      setEventos(datos.filter(d => 
        d.accion.toLowerCase().includes("fallido") || 
        d.accion.toLowerCase().includes("ingreso") ||
        d.accion.toLowerCase().includes("sesiÃ³n")
      ));
      
      setAuditoria(datos);

      const fallidos = datos.filter(d => d.accion.toLowerCase().includes("fallido")).length;
      setAlertasSeguridad(fallidos);
      
      setLoading(false);
    });

    obtenerConteoUsuarios();
    return () => unsubscribe();
  }, []);

  const imprimirReporte = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-black uppercase tracking-widest text-red-500 animate-pulse">
          <i className="fas fa-spinner fa-spin mr-2"></i> Conectando al nÃºcleo de monitoreo...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÃ“N SUPERIOR UNIFICADA */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-building-columns text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <div className="flex gap-3">
          <button 
            onClick={imprimirReporte}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-indigo-950 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <i className="fas fa-print"></i> Reporte PDF
          </button>
          <button 
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white flex items-center gap-2 hover:shadow-neon-cyan"
            onClick={() => router.back()}
          >
            <i className="fas fa-arrow-left"></i> Volver
          </button>
        </div>
      </nav>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE TÃ‰CNICO */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            Monitoreo del Sistema
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Logs de auditorÃ­a en tiempo real y telemetrÃ­a de eventos de seguridad
          </p>
        </header>

        {/* WIDGETS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* CARD: USUARIOS */}
          <div className="p-6 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl shadow-slate-200/10 shadow-neon-cyan/5 hover:shadow-neon-cyan/20">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute right-6 top-6 text-cyan-600/10 text-5xl group-hover:text-cyan-600/20 transition-all duration-300">
              <i className="fas fa-users-cog"></i>
            </div>
            <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-2">Usuarios Registrados</span>
            <p className="text-4xl font-black text-indigo-950">{totalUsuarios}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
              <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-mono">DATABASE_STATUS: OK</span>
            </div>
          </div>

          {/* CARD: ALERTAS */}
          <div className="p-6 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-red-200 transition-all duration-300 shadow-xl shadow-slate-200/10 shadow-neon-red/5 hover:shadow-neon-red/20">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute right-6 top-6 text-red-650/10 text-5xl group-hover:text-red-650/20 transition-all duration-300">
              <i className="fas fa-shield-alt"></i>
            </div>
            <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-2 font-mono">SEC_ALERTS // INTRUSIONS</span>
            <p className="text-4xl font-black text-red-600">{alertasSeguridad}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${alertasSeguridad > 0 ? "bg-red-500 animate-ping" : "bg-emerald-500"}`}></span>
              <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-mono">THREAT_LEVEL: {alertasSeguridad > 5 ? "HIGH" : alertasSeguridad > 0 ? "WARN" : "NONE"}</span>
            </div>
          </div>

          {/* CARD: SERVIDOR */}
          <div className="p-6 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl shadow-slate-200/10 shadow-neon-cyan/5 hover:shadow-neon-cyan/20">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute right-6 top-6 text-emerald-650/10 text-5xl group-hover:text-emerald-600/20 transition-all duration-300">
              <i className="fas fa-server"></i>
            </div>
            <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-2">Estado del Sistema</span>
            <p className="text-4xl font-black text-emerald-600">EN LÃNEA</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-mono">CORE_LATENCY: 12MS</span>
            </div>
          </div>

        </div>

        {/* MAIN GRID TABLES */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* TABLA: EVENTOS RECIENTES */}
          <section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-2xl shadow-neon-cyan/5 relative">
            {/* Tech Corners */}
            <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <h3 className="text-sm font-black uppercase text-indigo-950 tracking-wider border-b border-slate-200/60 pb-3 flex items-center gap-2 mb-6">
              <i className="fas fa-stream text-cyan-500 shadow-neon-cyan/40"></i> Eventos Recientes del Sistema
            </h3>
            
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-left font-mono">EVENT</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-left font-mono">MODULE</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-center font-mono">STATUS</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-right font-mono">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400 font-bold italic text-xs font-mono">NO_EVENTS_LOGGED</td>
                    </tr>
                  ) : (
                    eventos.map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-50/50 border-b border-slate-100/60 transition-colors">
                        <td className="py-3.5 text-xs font-semibold text-slate-800 uppercase">{ev.accion}</td>
                        <td className="py-3.5 text-xxs font-bold text-indigo-650 uppercase tracking-wider font-mono">{ev.modulo}</td>
                        <td className="py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase border ${ev.accion.toLowerCase().includes("fallido") ? "bg-red-55/80 text-red-600 border-red-200" : "bg-cyan-50 text-cyan-600 border-cyan-200"}`}>
                            {ev.accion.toLowerCase().includes("fallido") ? "FAIL" : "SUCCESS"}
                          </span>
                        </td>
                        <td className="py-3.5 text-right text-xxs font-bold text-slate-450 font-mono">{ev.fechaFormateada}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* TABLA: AUDITORÃA DETALLADA */}
          <section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-2xl shadow-neon-cyan/5 relative">
            {/* Tech Corners */}
            <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <h3 className="text-sm font-black uppercase text-indigo-950 tracking-wider border-b border-slate-200/60 pb-3 flex items-center gap-2 mb-6">
              <i className="fas fa-history text-indigo-500 shadow-neon-purple/40"></i> AuditorÃ­a Detallada de Acciones
            </h3>
            
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-left font-mono">OPERATOR</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-left font-mono">ROLE</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-left font-mono">ACTION</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase pb-3 text-right font-mono">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400 font-bold italic text-xs font-mono">NO_AUDIT_LOGS</td>
                    </tr>
                  ) : (
                    auditoria.map(audit => (
                      <tr key={audit.id} className="hover:bg-slate-50/50 border-b border-slate-100/60 transition-colors">
                        <td className="py-3.5 text-xs font-bold text-slate-800 uppercase">{audit.usuario}</td>
                        <td className="py-3.5 text-xxs font-bold text-cyan-600 uppercase tracking-wider font-mono">{audit.rol}</td>
                        <td className="py-3.5 text-xs text-slate-600 font-semibold">{audit.accion}</td>
                        <td className="py-3.5 text-right text-xxs font-bold text-slate-450 font-mono">{audit.fechaFormateada}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}

