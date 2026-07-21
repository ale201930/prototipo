"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase"; 
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function RecordFuncionalAsistencia() {
  const router = useRouter();
  const [personal, setPersonal] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS"); 
  const [vista, setVista] = useState("semanal");
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 30;

  const nombresDiasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const nombresMesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const [showAnualDropdown, setShowAnualDropdown] = useState(false);
  const [modalSeleccionMes, setModalSeleccionMes] = useState({ open: false, mesIndex: null });
  const [tempFecha, setTempFecha] = useState("");

  const nombresMesesLargos = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const abrirModalMes = (mesIndex) => {
    const anio = fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime())
      ? fechaReferencia.getFullYear()
      : new Date().getFullYear();
    const mesStr = String(mesIndex + 1).padStart(2, "0");
    setTempFecha(`${anio}-${mesStr}-01`);
    setModalSeleccionMes({ open: true, mesIndex });
  };

  useEffect(() => {
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snap) => {
      setPersonal(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAsist = onSnapshot(query(collection(db, "asistencias"), orderBy("fechaHora", "desc")), (snap) => {
      setAsistencias(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubFeriados = onSnapshot(collection(db, "feriados"), (snap) => {
      setFeriados(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubPersonal(); unsubAsist(); unsubFeriados(); };
  }, []);

  // Reiniciar paginación al cambiar filtros o tipo de vista
  useEffect(() => {
    setPaginaActual(1);
  }, [filtro, filtroTipo, vista, fechaReferencia]);

  // Mapa optimizado O(1) de asistencias
  const asistenciasMap = React.useMemo(() => {
    const map = {};
    asistencias.forEach(a => {
      const fA = a.fechaHora?.toDate ? a.fechaHora.toDate() : (a.fechaHora ? new Date(a.fechaHora) : null);
      if (fA && a.ficha) {
        const key = `${a.ficha}_${fA.getFullYear()}_${fA.getMonth()}_${fA.getDate()}`;
        map[key] = a;
      }
    });
    return map;
  }, [asistencias]);

  const listaFiltrada = personal.filter(p => {
    // Excluir personal inactivo
    if (p.estatus === "Inactivo") return false;

    // Excluir pasantes cuya pasantía haya culminado
    if (p.tipoPersonal === "Pasante" && p.fechaEgreso) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const [anio, mes, dia] = p.fechaEgreso.split("-").map(Number);
      const fechaCulminacion = new Date(anio, mes - 1, dia, 23, 59, 59, 999);
      if (hoy > fechaCulminacion) return false;
    }

    const coincideTexto = p.nombres?.toLowerCase().includes(filtro.toLowerCase()) || 
                          p.ficha?.toLowerCase().includes(filtro.toLowerCase());

    const pTipoUpper = (p.tipoPersonal || "").toUpperCase();
    const coincideTipo = (filtroTipo === "TODOS") || 
                         (filtroTipo === "INVECEM" && (pTipoUpper === "INVECEM" || !p.tipoPersonal)) || 
                         (filtroTipo.includes("INCES") && pTipoUpper.includes("INCES")) || 
                         (filtroTipo.includes("PASANTE") && pTipoUpper.includes("PASANTE"));
    
    return coincideTexto && coincideTipo;
  });

  const obtenerTituloFecha = () => {
    const ref = (fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime())) ? fechaReferencia : new Date();
    if (vista === 'anual') {
      return `AÑO ${ref.getFullYear()}`;
    }
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
    const { ficha, regimenLaboral, fechaInicioCiclo } = p; 
    const key = `${ficha}_${anio}_${mes}_${dia}`;
    const registro = asistenciasMap[key];

    if (registro) {
        let hExtra = 0;
        if (registro.salida && registro.salida !== "--:--" && registro.entrada) {
            const horaEntradaNum = parseInt(registro.entrada.split(":")[0], 10);
            const esNocturno = (horaEntradaNum >= 18 || horaEntradaNum < 5);
            const horaSalidaOficial = (registro.horaSalida && registro.horaSalida.includes(":")) 
                ? parseInt(registro.horaSalida.split(":")[0], 10) 
                : (esNocturno ? 7 : 16);
            const [hS, mS] = registro.salida.replace(/AM|PM/gi, '').trim().split(":").map(Number);
            let minutosSalidaReal = (hS * 60) + mS;
            if (esNocturno && hS < 12) minutosSalidaReal += 1440; 
            const minutosSalidaOficial = (horaSalidaOficial * 60) + (esNocturno ? 1440 : 0);
            const diff = minutosSalidaReal - minutosSalidaOficial;
            if (diff > 0) hExtra = Math.floor(diff / 60);
        }
        return { clase: "status-presente", extra: hExtra, label: "ASISTENCIA" };
    }

    const fechaActual = new Date(anio, mes, dia);
    const diaSemana = fechaActual.getDay();

    const parseLocalDate = (dateStr) => {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    };

    const dClean = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate());
    const feriado = feriados.find(f => {
      if (!f.fechaInicio || !f.fechaRegreso) return false;
      const start = parseLocalDate(f.fechaInicio);
      const end = parseLocalDate(f.fechaRegreso);
      return start && end && dClean >= start && dClean < end;
    });

    if (feriado) {
      if (feriado.tipo === "TODOS" || (feriado.tipo === "PARCIAL" && feriado.trabajadoresLibran?.includes(p.id))) {
        return { clase: "status-feriado", extra: 0, label: "FERIADO" };
      }
    }

    if (regimenLaboral === "TURNO_4X4") {
        // Usar la fecha de inicio de ciclo propia del trabajador;
        // si no tiene, usar el 1 de enero de 2026 como fallback global.
        let fechaBase;
        if (fechaInicioCiclo) {
            const [y, m, d] = fechaInicioCiclo.split("-").map(Number);
            fechaBase = new Date(y, m - 1, d);
        } else {
            fechaBase = new Date(2026, 0, 1);
        }
        const diffTime = fechaActual - fechaBase;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        // Módulo siempre positivo para manejar fechas anteriores a la base
        const ciclo = ((diffDays % 8) + 8) % 8;
        if (ciclo >= 4) return { clase: "status-descanso", extra: 0, label: "DESCANSO" };
    } else {
        if (diaSemana === 0 || diaSemana === 6) return { clase: "status-descanso", extra: 0, label: "DESCANSO" };
    }
    return { clase: "status-ausente", extra: 0, label: "FALTA" };
  };

  const obtenerAcumuladoMensual = (p, mes, anio) => {
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    let asistenciasCount = 0;
    let faltasCount = 0;
    let descansosCount = 0;
    let extraSum = 0;

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const info = obtenerDatosReales(p, dia, mes, anio);
      if (info.label === "ASISTENCIA") {
        asistenciasCount++;
        extraSum += info.extra;
      } else if (info.label === "DESCANSO" || info.label === "FERIADO") {
        descansosCount++;
      } else {
        faltasCount++;
      }
    }
    return { asistencias: asistenciasCount, faltas: faltasCount, descansos: descansosCount, extra: extraSum };
  };

  const badgeStyles = {
    "status-presente": "bg-cyan-50 text-cyan-600 border-cyan-200",
    "status-descanso": "bg-slate-100 text-slate-500 border-slate-200/60",
    "status-feriado": "bg-emerald-50 text-emerald-600 border-emerald-200 font-bold",
    "status-ausente": "bg-red-50 text-red-650 border-red-200"
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
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
              Récord operacional y acumulación de horas de la nómina de planta
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
                {vista === "anual" ? (
                  <select
                    key="select-anio"
                    value={fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime()) ? fechaReferencia.getFullYear() : new Date().getFullYear()}
                    onChange={(e) => {
                      const anio = parseInt(e.target.value);
                      const nuevaFecha = new Date(fechaReferencia);
                      nuevaFecha.setFullYear(anio);
                      setFechaReferencia(nuevaFecha);
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer uppercase font-mono"
                  >
                    {Array.from({ length: 11 }, (_, i) => {
                      const y = new Date().getFullYear() - 5 + i;
                      return <option key={y} value={y}>Año {y}</option>;
                    })}
                  </select>
                ) : (
                  <input 
                    key="input-fecha"
                    type="date" 
                    max={new Date().toISOString().split("T")[0]}
                    value={fechaReferencia instanceof Date && !isNaN(fechaReferencia.getTime()) ? `${fechaReferencia.getFullYear()}-${String(fechaReferencia.getMonth() + 1).padStart(2, "0")}-${String(fechaReferencia.getDate()).padStart(2, "0")}` : ""}
                    onChange={(e) => {
                      const todayStr = new Date().toISOString().split("T")[0];
                      const val = e.target.value > todayStr ? todayStr : e.target.value;
                      setFechaReferencia(val ? new Date(val + "T12:00:00") : new Date());
                    }} 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer" 
                  />
                )}
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

              {/* Vista Semanal / Mensual / Anual */}
              <div className="flex bg-slate-50 p-1 border border-slate-200 rounded-xl relative">
                <button 
                  className={`py-1.5 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 cursor-pointer ${vista === 'semanal' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-950'}`} 
                  onClick={() => { setVista('semanal'); setShowAnualDropdown(false); }}
                >
                  Semanal
                </button>
                <button 
                  className={`py-1.5 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 cursor-pointer ${vista === 'mensual' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-950'}`} 
                  onClick={() => { setVista('mensual'); setShowAnualDropdown(false); }}
                >
                  Mensual
                </button>
                
                <div className="relative">
                  <button 
                    className={`py-1.5 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1 ${vista === 'anual' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-950'}`} 
                    onClick={() => {
                      setVista('anual');
                      setShowAnualDropdown(!showAnualDropdown);
                    }}
                  >
                    Anual <i className="fas fa-chevron-down text-[8px]" />
                  </button>

                  {showAnualDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200/80 rounded-2xl shadow-2xl p-4 z-[999] animate-fade-in text-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 pb-1 border-b border-slate-100 font-mono">
                        OPCIONES DE VISTA ANUAL
                      </div>
                      
                      <button
                        className="w-full text-left py-2 px-3 hover:bg-slate-50 rounded-xl text-xxs font-black uppercase tracking-wider text-indigo-950 transition-colors flex items-center gap-2 mb-3 cursor-pointer"
                        onClick={() => {
                          setVista('anual');
                          setShowAnualDropdown(false);
                        }}
                      >
                        <i className="fas fa-table text-cyan-500" /> Ver Resumen Anual
                      </button>

                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 font-mono">
                        SELECCIONAR MES (MENSUAL)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {nombresMesesCortos.map((m, i) => (
                          <button
                            key={i}
                            className="py-1 px-1 bg-slate-50 hover:bg-cyan-50 hover:text-cyan-600 border border-slate-200/60 hover:border-cyan-200 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer font-mono"
                            onClick={() => {
                              abrirModalMes(i);
                              setShowAnualDropdown(false);
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Búsqueda de personal */}
            <div className="relative w-full lg:flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                <i className="fas fa-search"></i>
              </span>
              <input 
                type="text" 
                placeholder="Buscar por Nombre o N° Ficha..." 
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
          
          <div className="overflow-x-auto w-full max-h-[600px] overflow-y-auto mb-4">
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
                    : vista === 'mensual'
                      ? obtenerDiasMes().map((d, i) => (
                          <th key={i} className="text-slate-500 font-bold text-[9px] tracking-wider uppercase py-4 px-1 text-center min-w-[55px]">
                            <span className="block text-slate-500 text-[8px] font-bold font-mono">{d.nombre}</span>
                            <span className="text-xs font-extrabold text-slate-800 font-mono">{d.dia}</span>
                          </th>
                        ))
                      : nombresMesesLargos.map((m, i) => (
                          <th key={i} className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center min-w-[110px] font-mono">
                            <button
                              onClick={() => abrirModalMes(i)}
                              className="text-xs font-black text-slate-850 hover:text-cyan-600 transition-colors uppercase cursor-pointer flex items-center justify-center gap-1 mx-auto"
                              title={`Haga clic para ver el reporte mensual de ${nombresMesesLargos[i]}`}
                            >
                              {m} <i className="fas fa-search text-[8px] opacity-40" />
                            </button>
                          </th>
                        ))
                  }
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center min-w-[80px] border-l border-slate-200/60 font-mono">HORAS EXTRAS</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={vista === 'semanal' ? 9 : vista === 'mensual' ? 40 : 14} className="py-8 text-center text-slate-400 font-bold italic text-sm font-mono">
                      Sin registros encontrados
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina) || 1;
                    const indexInicio = (paginaActual - 1) * itemsPorPagina;
                    const indexFin = paginaActual * itemsPorPagina;
                    const trabajadoresPaginados = listaFiltrada.slice(indexInicio, indexFin);

                    return trabajadoresPaginados.map((p) => {
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
                            vista === 'mensual' ?
                            obtenerDiasMes().map((d, i) => {
                              const info = obtenerDatosReales(p, d.dia, d.mes, d.anio);
                              acumuladoExtra += info.extra;
                              return (
                                <td key={i} className="py-3 px-1 text-center">
                                  <span 
                                    className={`px-1.5 py-0.5 text-[8px] font-black tracking-tighter uppercase rounded border inline-block w-10 text-center ${badgeStyles[info.clase] || "bg-slate-100 text-slate-500"}`}
                                    title={info.label}
                                  >
                                    {info.label === "ASISTENCIA" ? "ASIST" : info.label === "DESCANSO" ? "DESC" : info.label === "FERIADO" ? "FERI" : "FALT"}
                                  </span>
                                </td>
                              );
                            }) :
                            Array.from({ length: 12 }, (_, mes) => {
                              const info = obtenerAcumuladoMensual(p, mes, fechaReferencia.getFullYear());
                              acumuladoExtra += info.extra;
                              return (
                                <td key={mes} className="py-3 px-1 text-center">
                                  <button
                                    onClick={() => abrirModalMes(mes)}
                                    className="inline-flex flex-col items-center justify-center p-1 bg-slate-50 hover:bg-cyan-50 border border-slate-200/60 hover:border-cyan-200 rounded w-12 text-center shadow-sm cursor-pointer transition-colors"
                                    title={`Haga clic para ver el reporte mensual detallado de ${nombresMesesLargos[mes]}`}
                                  >
                                    <span className="text-[9px] font-black text-emerald-600 block">A: {info.asistencias}</span>
                                    <span className="text-[9px] font-black text-red-500 block">F: {info.faltas}</span>
                                  </button>
                                </td>
                              );
                            })
                          }

                          {/* Celda de acumulación final */}
                          <td className="py-3 px-3 text-center border-l border-slate-200/60">
                            <span className={`px-2 py-0.5 rounded text-xxs font-black tracking-wider uppercase inline-block ${acumuladoExtra > 0 ? "bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-md shadow-cyan-100/50" : "text-slate-400"}`}>
                              {acumuladoExtra}h
                            </span>
                          </td>

                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {listaFiltrada.length > itemsPorPagina && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/60 print:hidden">
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest font-mono">
                Mostrando {((paginaActual - 1) * itemsPorPagina) + 1} - {Math.min(paginaActual * itemsPorPagina, listaFiltrada.length)} de {listaFiltrada.length} colaboradores
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                  disabled={paginaActual === 1}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center gap-1"
                >
                  <i className="fas fa-chevron-left text-cyan-500"></i> Anterior
                </button>
                {(() => {
                  const totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina) || 1;
                  return Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(pag => pag === 1 || pag === totalPaginas || Math.abs(pag - paginaActual) <= 1)
                    .map((pag, index, arr) => {
                      const showEllipsis = index > 0 && pag - arr[index - 1] > 1;
                      return (
                        <React.Fragment key={pag}>
                          {showEllipsis && <span className="text-slate-400 font-bold self-center px-1">...</span>}
                          <button
                            onClick={() => setPaginaActual(pag)}
                            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xxs font-black transition-all cursor-pointer ${
                              paginaActual === pag
                                ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow shadow-cyan-500/20'
                                : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-650'
                            }`}
                          >
                            {pag}
                          </button>
                        </React.Fragment>
                      );
                    });
                })()}
                <button
                  onClick={() => {
                    const totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina) || 1;
                    setPaginaActual(prev => Math.min(prev + 1, totalPaginas));
                  }}
                  disabled={paginaActual === (Math.ceil(listaFiltrada.length / itemsPorPagina) || 1)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center gap-1"
                >
                  Siguiente <i className="fas fa-chevron-right text-cyan-500"></i>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL DE SELECCIÓN DE FECHA POR MES */}
      {modalSeleccionMes.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in no-print">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl space-y-6 relative shadow-neon-cyan/20">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

            <h2 className="text-lg font-black uppercase text-indigo-955 tracking-tight flex items-center gap-2">
              <i className="fas fa-calendar-alt text-cyan-600"></i> Consultar {nombresMesesLargos[modalSeleccionMes.mesIndex]}
            </h2>
            
            <p className="text-xs text-slate-500 font-medium">
              Por favor, selecciona la fecha exacta dentro de este mes para consultar la asistencia:
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_CONSULTA</label>
                <input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={tempFecha}
                  onChange={(e) => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    setTempFecha(e.target.value > todayStr ? todayStr : e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalSeleccionMes({ open: false, mesIndex: null })}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-xs tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (tempFecha) {
                    setFechaReferencia(new Date(tempFecha + "T12:00:00"));
                    setVista("mensual");
                  }
                  setModalSeleccionMes({ open: false, mesIndex: null });
                }}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1"
              >
                <i className="fas fa-search"></i> Consultar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

