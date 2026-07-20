"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase"; 
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp 
} from "firebase/firestore";

export default function ReportesGenerales() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  const [fechaBusqueda, setFechaBusqueda] = useState(new Date().toISOString().split('T')[0]);
  const [filtroEmpresa, setFiltroEmpresa] = useState("TODOS"); 
  const [filtroTurno, setFiltroTurno] = useState("TODOS"); 
  const [filtroArea, setFiltroArea] = useState("TODOS");
  const [busquedaManual, setBusquedaManual] = useState("");

  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 30;

  useEffect(() => {
    setPaginaActual(1);
  }, [fechaBusqueda, filtroEmpresa, filtroTurno, filtroArea, busquedaManual]);

  const limpiarFiltros = () => {
    setFechaBusqueda(new Date().toISOString().split('T')[0]);
    setFiltroEmpresa("TODOS");
    setFiltroArea("TODOS");
    setFiltroTurno("TODOS");
    setBusquedaManual("");
    setResultados([]);
    setPaginaActual(1);
  };

  useEffect(() => { 
    setMounted(true);
  }, []);

  const formatearFechaVisual = (fechaISO) => {
    if (!fechaISO) return "";
    const [anio, mes, dia] = fechaISO.split('-');
    return `${dia}/${mes}/${anio}`;
  };

  const formatAMPM = (hora24) => {
    if (!hora24 || hora24 === "--:--" || hora24 === "") return "--:--";
    let limpia = hora24.replace(/AM|PM/gi, '').trim();
    let [horas, minutos] = limpia.split(':');
    let h = parseInt(horas);
    if (isNaN(h)) return "--:--";
    const ampm = h >= 12 ? ' PM' : ' AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutos}${ampm}`;
  };

  const obtenerEstatusFinal = (r) => {
    if (r.estatus === "ABANDONO DE TRABAJO") return "ABANDONO DE TRABAJO";
    
    // Calcular abandono dinámico de almuerzo si no ha retornado y ya pasó la hora de salida
    if (r.entrada && r.salidaAlmuerzo && !r.entradaAlmuerzo && !r.salida && r.horaSalida) {
      const ahora = new Date();
      const fechaDoc = r.fechaHora?.toDate ? r.fechaHora.toDate() : (r.fechaHora ? new Date(r.fechaHora) : null);
      if (fechaDoc) {
        const hoy = new Date();
        const esHoy = fechaDoc.getFullYear() === hoy.getFullYear() &&
                      fechaDoc.getMonth() === hoy.getMonth() &&
                      fechaDoc.getDate() === hoy.getDate();
        
        if (esHoy) {
          const [hrsSalida, minsSalida] = r.horaSalida.split(":").map(Number);
          const shiftEnd = new Date(fechaDoc);
          shiftEnd.setHours(hrsSalida, minsSalida, 0, 0);

          const entradaProg = r.horaEntrada || "07:00";
          const convertirAMinutos = (horaStr) => {
            if (!horaStr) return 0;
            const [hrs, mins] = horaStr.split(":").map(Number);
            return (hrs * 60) + mins;
          };
          if (convertirAMinutos(r.horaSalida) < convertirAMinutos(entradaProg)) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
          }

          if (ahora >= shiftEnd) {
            return "ABANDONO DE TRABAJO";
          }
        } else {
          return "ABANDONO DE TRABAJO";
        }
      }
    }

    if (r.tipoSalida === "ANTICIPADA") {
      return "SALIDA ANTICIPADA";
    }

    return r.estatus || "PUNTUAL";
  };

  const ejecutarBusqueda = async (
    pFecha = fechaBusqueda,
    pEmpresa = filtroEmpresa,
    pArea = filtroArea,
    pTurno = filtroTurno,
    pBusqueda = busquedaManual
  ) => {
    setLoading(true);
    try {
      const fechaElegida = new Date(pFecha + "T00:00:00");
      const finDelDia = new Date(pFecha + "T23:59:59");

      const q = query(
        collection(db, "asistencias"),
        where("fechaHora", ">=", Timestamp.fromDate(fechaElegida)),
        where("fechaHora", "<=", Timestamp.fromDate(finDelDia)),
        orderBy("fechaHora", "asc")
      );

      const snap = await getDocs(q);
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      data = data.filter(item => {
        const tipo = item.tipoPersonal?.toUpperCase() || "";
        return !tipo.includes("CONTRATA") && !tipo.includes("CONTRATISTA");
      });

      data = data.filter(item => {
        if (!item.fechaHora) return false;
        const fechaDoc = item.fechaHora.toDate().toISOString().split('T')[0];
        return fechaDoc === pFecha;
      });

      if (pEmpresa !== "TODOS") {
        data = data.filter(item => {
          if (pEmpresa === "INCES") return item.tipoPersonal?.includes("INCES");
          return item.tipoPersonal === pEmpresa;
        });
      }

      if (pTurno !== "TODOS") {
        data = data.filter(item => {
          if (!item.entrada) return false;
          const [h] = item.entrada.split(":").map(Number);
          const esNocturno = h >= 18 || h < 7; 
          return pTurno === "DIURNO" ? !esNocturno : esNocturno;
        });
      }

      if (pArea !== "TODOS") {
        data = data.filter(item => item.area?.toUpperCase() === pArea);
      }

      if (pBusqueda && pBusqueda.trim() !== "") {
        const b = pBusqueda.toLowerCase();
        data = data.filter(item => 
          item.nombreCompleto?.toLowerCase().includes(b) || 
          item.ficha?.toString().includes(b)
        );
      }

      setResultados(data);
      setPaginaActual(1);
    } catch (error) {
      console.error("Error:", error);
      alert("Error en la base de datos.");
    }
    setLoading(false);
  };

  const descargarPDF = async () => {
    if (resultados.length === 0) return alert("No hay datos para exportar.");
    const loadJS = (src) => new Promise(r => {
      const s = document.createElement("script"); s.src = src; s.onload = r; document.head.appendChild(s);
    });
    await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    const loadImage = (url) => new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });

    const imgLogo = await loadImage('/logo.png');

    const areaTexto = filtroArea === "TODOS" ? "GENERAL" : filtroArea;
    const fechaLinda = formatearFechaVisual(fechaBusqueda);

    doc.setFillColor(248, 250, 252); doc.rect(0, 0, 300, 40, 'F');
    doc.setDrawColor(226, 232, 240); doc.line(0, 40, 300, 40);
    
    if (imgLogo) {
      doc.addImage(imgLogo, 'PNG', 15, 5, 30, 30);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18); doc.text(`INVECEM - CONTROL DE ASISTENCIA ${areaTexto}`, 50, 20);
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(10);
      doc.text(`REGISTROS DEL DÍA: ${fechaLinda} | TURNO: ${filtroTurno}`, 50, 30);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18); doc.text(`INVECEM - CONTROL DE ASISTENCIA ${areaTexto}`, 15, 20);
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(10);
      doc.text(`REGISTROS DEL DÍA: ${fechaLinda} | TURNO: ${filtroTurno}`, 15, 30);
    }

    const filas = resultados.map(r => {
      const observaciones = [];
      const estatusFinal = obtenerEstatusFinal(r);
      if (estatusFinal === "ABANDONO DE TRABAJO") {
        observaciones.push("ABANDONO DE TRABAJO: NO RETORNÓ DE ALMUERZO");
      } else if (r.tipoSalida === "ANTICIPADA") {
        observaciones.push(`SALIDA ANTICIPADA: ${r.observacionAcceso?.toUpperCase() || "SIN MOTIVO"}`);
      }
      if (r.minutosAlmuerzoTarde > 0) {
        observaciones.push(`DEMORA RETORNO ALMUERZO: +${r.minutosAlmuerzoTarde}MIN`);
      }
      
      return [
        r.ficha, 
        r.nombreCompleto?.toUpperCase(), 
        `${r.area?.toUpperCase() || "N/A"} - ${r.cargo?.toUpperCase() || ""}`, 
        formatAMPM(r.entrada),
        formatAMPM(r.salida),
        r.estatus || "PUNTUAL",
        r.tipoPersonal,
        observaciones.join(" | ") || "--"
      ];
    });

    doc.autoTable({
      startY: 45,
      head: [['FICHA', 'COLABORADOR', 'ÁREA / CARGO', 'ENTRADA', 'SALIDA', 'ESTATUS', 'TIPO', 'OBSERVACIONES']],
      body: filas,
      headStyles: { fillColor: [6, 182, 212] },
      styles: { fontSize: 8 }
    });
    
    doc.save(`Reporte_${areaTexto}_${fechaLinda.replace(/\//g, '-')}.pdf`);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/recursos-humanos")}
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
              <h1 className="text-2xl font-black uppercase text-indigo-950 tracking-tight">INVECEM</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reporte General de Asistencias</p>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-slate-500">
            <div>Fecha Consulta: {formatearFechaVisual(fechaBusqueda)}</div>
            <div>Turno: {filtroTurno} | Área: {filtroArea}</div>
          </div>
        </div>

        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5 print:hidden">
          <h1 className="text-3xl font-black tracking-tight text-indigo-955 uppercase">
            Reporte General de Asistencias
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Consulta consolidada de accesos diarios, horarios y estatus nominal
          </p>
        </header>

        {/* TARJETA DE CONTROL PRINCIPAL */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          {/* PANEL DE FILTRADO TÉCNICO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            {/* Input Fecha */}
            <div className="flex flex-col gap-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_CONSULTA</label>
              <input 
                type="date" 
                max={new Date().toISOString().split("T")[0]}
                value={fechaBusqueda} 
                onChange={(e) => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  setFechaBusqueda(e.target.value > todayStr ? todayStr : e.target.value);
                }}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer"
              />
            </div>

            {/* Selector de Empresa */}
            <div className="flex flex-col gap-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">EMPRESA_RELACION</label>
              <select 
                value={filtroEmpresa} 
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer uppercase"
              >
                <option value="TODOS">TODOS (EMPRESA)</option>
                <option value="INVECEM">INVECEM</option>
                <option value="Estudiante INCES">ESTUDIANTES INCES</option>
                <option value="Pasante">PASANTES</option>
              </select>
            </div>

            {/* Selector de Área */}
            <div className="flex flex-col gap-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">AREA_UNIDAD</label>
              <select 
                value={filtroArea} 
                onChange={(e) => setFiltroArea(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer uppercase"
              >
                <option value="TODOS">TODAS LAS ÁREAS</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="ALMACÉN">ALMACÉN</option>
                <option value="PRODUCCIÓN">PRODUCCIÓN</option>
                <option value="PROTECCIÓN FÍSICA">PROTECCIÓN FÍSICA</option>
                <option value="COMPRAS">COMPRAS</option>
                <option value="FINANZAS">FINANZAS</option>
                <option value="TECNOLOGIA">TECNOLOGÍA</option>
                <option value="AUTOMATIZACION">AUTOMATIZACIÓN</option>
                <option value="CENTRO DE FORMACION">CENTRO DE FORMACIÓN</option>
                <option value="OAC">OAC</option>
                <option value="RECURSOS HUMANOS">RECURSOS HUMANOS</option>
                <option value="LOGISTICA">LOGÍSTICA</option>
                <option value="SEGURIDAD">SEGURIDAD</option>
                <option value="OPERACIONES">OPERACIONES</option>
                <option value="ADMINISTRACION">ADMINISTRACIÓN</option>
              </select>
            </div>

            {/* Selector de Turno */}
            <div className="flex flex-col gap-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">TURNO_ASISTENCIA</label>
              <select 
                value={filtroTurno} 
                onChange={(e) => setFiltroTurno(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer uppercase"
              >
                <option value="TODOS">TODOS LOS TURNOS</option>
                <option value="DIURNO">DIURNO</option>
                <option value="NOCTURNO">NOCTURNO</option>
              </select>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA Y ACCIONES */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between print:hidden border-t border-slate-200/60 pt-4">
            
            {/* Input buscar */}
            <div className="relative w-full md:flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                <i className="fas fa-search"></i>
              </span>
              <input 
                type="text" 
                placeholder="Buscar por ficha o nombre..." 
                value={busquedaManual} 
                onChange={(e) => setBusquedaManual(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
              />
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <button 
                onClick={() => ejecutarBusqueda(fechaBusqueda, filtroEmpresa, filtroArea, filtroTurno, busquedaManual)} 
                disabled={loading}
                className="px-5 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Generando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync-alt text-cyan-500 animate-spin-slow"></i> Generar
                  </>
                )}
              </button>

              <button 
                onClick={limpiarFiltros}
                type="button"
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                title="Limpiar todos los filtros"
              >
                <i className="fas fa-undo text-amber-500"></i> Limpiar Filtrado
              </button>

              <button 
                onClick={descargarPDF}
                className="px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-red-500/20 hover:shadow-neon-red"
              >
                <i className="fas fa-file-pdf"></i> Descargar PDF
              </button>

              <button 
                onClick={() => window.print()}
                className="px-5 py-3 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-600 hover:text-red-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              >
                <i className="fas fa-print"></i> Imprimir
              </button>
            </div>

          </div>

          {/* TABLA DE RESULTADOS */}
          <div className="overflow-x-auto w-full no-scrollbar pt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center w-24 font-mono">FICHA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">COLABORADOR</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÁREA / CARGO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ENTRADA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">SALIDA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">TIPO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-slate-400 font-bold italic text-sm font-mono">
                      {loading ? "Buscando registros..." : "Sin datos — seleccione criterios y genere el reporte"}
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const totalPaginas = Math.ceil(resultados.length / itemsPorPagina) || 1;
                    const indexInicio = (paginaActual - 1) * itemsPorPagina;
                    const indexFin = paginaActual * itemsPorPagina;
                    const itemsPaginados = resultados.slice(indexInicio, indexFin);

                    return itemsPaginados.map(r => (
                      <tr key={r.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition-all">
                        <td className="py-4 px-3 text-center font-black text-cyan-600 text-sm font-mono">
                          {r.ficha || "---"}
                        </td>
                        
                        <td className="py-4 px-3 text-left">
                          <strong className="text-sm font-extrabold text-indigo-950 uppercase block">{r.nombreCompleto}</strong>
                          {r.salidaAlmuerzo && (
                            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                                🍱 Almuerzo: {r.salidaAlmuerzo} a {r.entradaAlmuerzo || "--:--"}
                              </span>
                            </div>
                          )}
                        </td>
                        
                        <td className="py-4 px-3 text-left">
                          <div className="font-extrabold text-cyan-700 text-xs uppercase">{r.area || "N/A"}</div>
                          <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">{r.cargo}</div>
                        </td>
                        
                        <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                          {formatAMPM(r.entrada)}
                        </td>
                        
                        <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                          {formatAMPM(r.salida)}
                        </td>
                        
                        <td className="py-4 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${
                            r.estatus === "Retraso" || r.estatus === "RETRASO"
                              ? "bg-orange-50 text-orange-605 border-orange-200"
                              : r.estatus === "BENEFICIO"
                              ? "bg-cyan-50 text-cyan-600 border-cyan-200"
                              : "bg-emerald-50 text-emerald-600 border-emerald-200"
                          }`}>
                            {r.estatus || "PUNTUAL"}
                          </span>
                        </td>

                        <td className="py-4 px-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg text-[9px] font-black tracking-widest uppercase font-mono">
                            {r.tipoPersonal}
                          </span>
                        </td>

                        <td className="py-4 px-3 text-left max-w-[220px]">
                          {(() => {
                            const estatusFinal = obtenerEstatusFinal(r);
                            const badges = [];
                            
                            if (estatusFinal === "ABANDONO DE TRABAJO") {
                              badges.push(
                                <span key="abandono" className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-650 rounded text-[9px] font-black uppercase tracking-wider font-mono animate-pulse block mb-1 text-center w-full">
                                  🚨 Abandono: No retornó de almuerzo
                                </span>
                              );
                            } else if (r.tipoSalida === "ANTICIPADA") {
                              badges.push(
                                <span key="anticipada" className="px-1.5 py-0.5 bg-amber-50 border border-amber-250 text-amber-700 rounded text-[9px] font-black uppercase tracking-wider font-mono block mb-1 w-full text-center">
                                  🚪 Anticipada: {r.observacionAcceso || "Sin motivo"}
                                </span>
                              );
                            }
                            
                            if (r.minutosAlmuerzoTarde > 0) {
                              badges.push(
                                <span key="retraso-almuerzo" className="px-1.5 py-0.5 bg-red-50 border border-red-250 text-red-650 rounded text-[9px] font-black uppercase tracking-wider font-mono block text-center w-full">
                                  ⚠️ Retorno Almuerzo: +{r.minutosAlmuerzoTarde}m
                                </span>
                              );
                            }
                            
                            return badges.length > 0 ? (
                              <div className="flex flex-col gap-1 w-full">{badges}</div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">--</span>
                            );
                          })()}
                        </td>
                      </tr>
                    ));
                  })()
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {resultados.length > itemsPorPagina && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/60 print:hidden">
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest font-mono">
                Mostrando {((paginaActual - 1) * itemsPorPagina) + 1} - {Math.min(paginaActual * itemsPorPagina, resultados.length)} de {resultados.length} registros
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
                  const totalPaginas = Math.ceil(resultados.length / itemsPorPagina) || 1;
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
                    const totalPaginas = Math.ceil(resultados.length / itemsPorPagina) || 1;
                    setPaginaActual(prev => Math.min(prev + 1, totalPaginas));
                  }}
                  disabled={paginaActual === (Math.ceil(resultados.length / itemsPorPagina) || 1)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center gap-1"
                >
                  Siguiente <i className="fas fa-chevron-right text-cyan-500"></i>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

