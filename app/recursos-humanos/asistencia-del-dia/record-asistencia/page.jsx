"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase"; 
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function RecordFuncionalAsistencia() {
  const router = useRouter();
  const [personal, setPersonal] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS"); 
  const [vista, setVista] = useState("semanal");
  const [fechaReferencia, setFechaReferencia] = useState(new Date());

  const nombresDiasCortos = ["Dom", "Lun", "Mar", "MiÃ©", "Jue", "Vie", "SÃ¡b"];

  useEffect(() => {
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snap) => {
      setPersonal(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAsist = onSnapshot(query(collection(db, "asistencias"), orderBy("fechaHora", "desc")), (snap) => {
      setAsistencias(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubPersonal(); unsubAsist(); };
  }, []);

  const listaFiltrada = personal.filter(p => {
    const coincideTexto = p.nombres?.toLowerCase().includes(filtro.toLowerCase()) || 
                          p.ficha?.toLowerCase().includes(filtro.toLowerCase());

    const coincideTipo = (filtroTipo === "TODOS") || 
                         (filtroTipo === "INVECEM" && p.tipoPersonal === "INVECEM") || 
                         (filtroTipo === "INCES" && p.tipoPersonal?.includes("INCES")) || 
                         (filtroTipo === "PASANTES" && p.tipoPersonal === "Pasante");
    
    return coincideTexto && coincideTipo;
  });

  const obtenerTituloFecha = () => {
    const ref = (fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime())) ? fechaReferencia : new Date();
    const titulo = ref.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return titulo.charAt(0).toUpperCase() + titulo.slice(1);
  };

  const obtenerDiasSemana = () => {
    const ref = (fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime())) ? fechaReferencia : new Date();
    const inicio = new Date(ref);
    const diaSemana = inicio.getDay();
    const diferencia = inicio.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    inicio.setDate(diferencia);
    
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      return { nombre: nombresDiasCortos[fecha.getDay()], dia: fecha.getDate(), mes: fecha.getMonth(), anio: fecha.getFullYear() };
    });
  };

  const obtenerDiasMes = () => {
    const ref = (fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime())) ? fechaReferencia : new Date();
    const anio = ref.getFullYear();
    const mes = ref.getMonth();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    return Array.from({ length: diasEnMes }, (_, i) => ({ dia: i + 1, mes, anio, nombre: nombresDiasCortos[new Date(anio, mes, i + 1).getDay()] }));
  };

  const obtenerDatosReales = (p, dia, mes, anio) => {
    const { ficha, regimenLaboral } = p; 
    const fechaActual = new Date(anio, mes, dia);
    const diaSemana = fechaActual.getDay();

    const registro = asistencias.find(a => {
      const fA = a.fechaHora?.toDate();
      return fA && fA.getDate() === dia && fA.getMonth() === mes && fA.getFullYear() === anio && a.ficha === ficha;
    });

    if (registro) {
        let hExtra = 0;
        if (registro.salida && registro.salida !== "--:--" && registro.entrada) {
            const horaEntradaNum = parseInt(registro.entrada.split(":")[0]);
            const esNocturno = (horaEntradaNum >= 18 || horaEntradaNum < 5);
            const horaSalidaOficial = esNocturno ? 7 : 16;
            const [hS, mS] = registro.salida.replace(/AM|PM/gi, '').trim().split(":").map(Number);
            let minutosSalidaReal = (hS * 60) + mS;
            if (esNocturno && hS < 12) minutosSalidaReal += 1440; 
            const minutosSalidaOficial = (horaSalidaOficial * 60) + (esNocturno ? 1440 : 0);
            const diff = minutosSalidaReal - minutosSalidaOficial;
            if (diff > 0) hExtra = Math.floor(diff / 60);
        }
        return { clase: "status-presente", extra: hExtra, label: "ASISTENCIA" };
    }

    if (regimenLaboral === "TURNO_4X4") {
        const fechaBase = new Date(2026, 0, 1); 
        const diffTime = fechaActual - fechaBase;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
        const ciclo = diffDays % 8; 
        if (ciclo >= 4) return { clase: "status-descanso", extra: 0, label: "DESCANSO" };
    } else {
        if (diaSemana === 0 || diaSemana === 6) return { clase: "status-descanso", extra: 0, label: "DESCANSO" };
    }
    return { clase: "status-ausente", extra: 0, label: "FALTA" };
  };

  const badgeStyles = {
    "status-presente": "bg-cyan-50 text-cyan-600 border-cyan-200",
    "status-descanso": "bg-slate-100 text-slate-500 border-slate-200/60",
    "status-ausente": "bg-red-50 text-red-600 border-red-200"
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÃ“N CORPORATIVA */}
      <nav className="top-nav bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-building-columns text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.back()}
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
              Control de Asistencia
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
              RÃ©cord operacional y acumulaciÃ³n de horas de la nÃ³mina de planta
            </p>
          </div>
          <div className="px-4 py-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl text-sm font-black text-cyan-600 uppercase self-start sm:self-auto shadow-md font-mono">
            {obtenerTituloFecha()}
          </div>
        </header>

        {/* ACCIONES Y FILTROS */}
        <div className="p-4 bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl flex flex-col gap-4 mb-8 shadow-xl shadow-slate-200/10 relative">
          {/* Tech Corners */}
          <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              {/* Selector de fecha */}
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer" 
                  onChange={(e) => setFechaReferencia(e.target.value ? new Date(e.target.value + "T12:00:00") : new Date())} 
                />
              </div>

              {/* Selector de tipo */}
              <div>
                <select 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer uppercase" 
                  onChange={(e) => setFiltroTipo(e.target.value)}
                >
                  <option value="TODOS">TODOS LOS TIPOS</option>
                  <option value="INVECEM">INVECEM</option>
                  <option value="INCES">ESTUDIANTES INCES</option>
                  <option value="PASANTES">PASANTES</option>
                </select>
              </div>

              {/* Vista Semanal / Mensual */}
              <div className="flex bg-slate-50 p-1 border border-slate-200 rounded-xl">
                <button 
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 cursor-pointer ${vista === 'semanal' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-900'}`} 
                  onClick={() => setVista('semanal')}
                >
                  Semanal
                </button>
                <button 
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 cursor-pointer ${vista === 'mensual' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-900'}`} 
                  onClick={() => setVista('mensual')}
                >
                  Mensual
                </button>
              </div>
            </div>

            {/* BÃºsqueda de personal */}
            <div className="relative w-full lg:flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                <i className="fas fa-search"></i>
              </span>
              <input 
                type="text" 
                placeholder="Buscar por Nombre o NÂ° Ficha..." 
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
              />
            </div>
          </div>
        </div>

        {/* TABLA DE GRID DE ASISTENCIA */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl overflow-hidden shadow-2xl p-4 md:p-6 shadow-slate-200/20 relative shadow-neon-cyan">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          <div className="overflow-x-auto w-full no-scrollbar max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse text-slate-800">
              <thead>
                <tr className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left min-w-[200px] sticky left-0 bg-white z-30 border-r border-slate-200/60 font-mono">COLABORADOR</th>
                  {vista === 'semanal' 
                    ? obtenerDiasSemana().map((d, i) => (
                        <th key={i} className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center min-w-[80px]">
                          <span className="block text-slate-500 text-[10px] font-extrabold font-mono">{d.nombre}</span>
                          <span className="text-sm font-black text-slate-800 font-mono">{d.dia}</span>
                        </th>
                      ))
                    : obtenerDiasMes().map((d, i) => (
                        <th key={i} className="text-slate-500 font-bold text-[9px] tracking-wider uppercase py-4 px-1 text-center min-w-[55px]">
                          <span className="block text-slate-500 text-[8px] font-bold font-mono">{d.nombre}</span>
                          <span className="text-xs font-extrabold text-slate-800 font-mono">{d.dia}</span>
                        </th>
                      ))
                  }
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center min-w-[80px] border-l border-slate-200/60 font-mono">OVERTIME</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={vista === 'semanal' ? 9 : 40} className="py-8 text-center text-slate-400 font-bold italic text-sm font-mono">
                      Sin registros encontrados
                    </td>
                  </tr>
                ) : (
                  listaFiltrada.map((p) => {
                    let acumuladoExtra = 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 border-b border-slate-100/60 transition-colors">
                        
                        {/* Celda fija a la izquierda */}
                        <td className="py-3 px-3 text-left sticky left-0 bg-white/95 backdrop-blur-md z-10 border-r border-slate-200/80">
                          <div className="font-extrabold text-indigo-950 text-xs uppercase truncate max-w-[190px]">
                            {p.nombres} {p.apellidos}
                          </div>
                          <div className="text-[9px] font-black text-cyan-600 uppercase mt-0.5 tracking-wider font-mono">
                            FICHA: {p.ficha || "---"}
                          </div>
                        </td>

                        {/* Celdas de asistencia */}
                        {vista === 'semanal' ? 
                          obtenerDiasSemana().map((d, i) => {
                            const info = obtenerDatosReales(p, d.dia, d.mes, d.anio);
                            acumuladoExtra += info.extra;
                            return (
                              <td key={i} className="py-3 px-1 text-center">
                                <span className={`px-2 py-1 text-[9px] font-black tracking-widest uppercase rounded border inline-block w-16 text-center ${badgeStyles[info.clase] || "bg-slate-100 text-slate-500"}`}>
                                  {info.label}
                                </span>
                              </td>
                            );
                          }) : 
                          obtenerDiasMes().map((d, i) => {
                            const info = obtenerDatosReales(p, d.dia, d.mes, d.anio);
                            acumuladoExtra += info.extra;
                            return (
                              <td key={i} className="py-3 px-1 text-center">
                                <span 
                                  className={`px-1.5 py-0.5 text-[8px] font-black tracking-tighter uppercase rounded border inline-block w-10 text-center ${badgeStyles[info.clase] || "bg-slate-100 text-slate-500"}`}
                                  title={info.label}
                                >
                                  {info.label === "ASISTENCIA" ? "ASIST" : info.label === "DESCANSO" ? "DESC" : "FALT"}
                                </span>
                              </td>
                            );
                          })
                        }

                        {/* Celda de acumulaciÃ³n final */}
                        <td className="py-3 px-3 text-center border-l border-slate-200/60">
                          <span className={`px-2 py-0.5 rounded text-xxs font-black tracking-wider uppercase inline-block ${acumuladoExtra > 0 ? "bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-md shadow-cyan-100/50" : "text-slate-400"}`}>
                            {acumuladoExtra}h
                          </span>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

