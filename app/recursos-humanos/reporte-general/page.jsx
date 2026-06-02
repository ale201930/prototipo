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

  useEffect(() => { setMounted(true); }, []);

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

  const ejecutarBusqueda = async () => {
    setLoading(true);
    try {
      const fechaElegida = new Date(fechaBusqueda + "T00:00:00");
      const inicioExtendido = new Date(fechaElegida.getTime() - (12 * 60 * 60 * 1000));
      const finDelDia = new Date(fechaBusqueda + "T23:59:59");

      const q = query(
        collection(db, "asistencias"),
        where("fechaHora", ">=", Timestamp.fromDate(inicioExtendido)),
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
        const fechaDoc = item.fechaHora.toDate().toISOString().split('T')[0];
        if (fechaDoc === fechaBusqueda) return true;
        return item.salida && item.salida !== "--:--";
      });

      if (filtroEmpresa !== "TODOS") {
        data = data.filter(item => {
          if (filtroEmpresa === "INCES") return item.tipoPersonal?.includes("INCES");
          return item.tipoPersonal === filtroEmpresa;
        });
      }

      if (filtroTurno !== "TODOS") {
        data = data.filter(item => {
          if (!item.entrada) return false;
          const [h] = item.entrada.split(":").map(Number);
          const esNocturno = h >= 18 || h < 7; 
          return filtroTurno === "DIURNO" ? !esNocturno : esNocturno;
        });
      }

      if (filtroArea !== "TODOS") {
        data = data.filter(item => item.area?.toUpperCase() === filtroArea);
      }

      if (busquedaManual.trim() !== "") {
        const b = busquedaManual.toLowerCase();
        data = data.filter(item => 
          item.nombreCompleto?.toLowerCase().includes(b) || 
          item.ficha?.toString().includes(b)
        );
      }

      setResultados(data);
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

    const areaTexto = filtroArea === "TODOS" ? "GENERAL" : filtroArea;
    const fechaLinda = formatearFechaVisual(fechaBusqueda);

    doc.setFillColor(30, 41, 59); doc.rect(0, 0, 300, 40, 'F'); 
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.text(`INVECEM - CONTROL DE ASISTENCIA ${areaTexto}`, 15, 20);
    doc.setFontSize(10);
    doc.text(`REGISTROS DEL DÃA: ${fechaLinda} | TURNO: ${filtroTurno}`, 15, 30);

    const filas = resultados.map(r => [
      r.ficha, 
      r.nombreCompleto?.toUpperCase(), 
      `${r.area?.toUpperCase() || "N/A"} - ${r.cargo?.toUpperCase() || ""}`, 
      formatAMPM(r.entrada),
      formatAMPM(r.salida),
      r.estatus || "PUNTUAL",
      r.tipoPersonal
    ]);

    doc.autoTable({
      startY: 45,
      head: [['FICHA', 'COLABORADOR', 'ÃREA / CARGO', 'ENTRADA', 'SALIDA', 'ESTATUS', 'TIPO']],
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

      {/* BARRA DE NAVEGACIÃ“N CORPORATIVA */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-building-columns text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/recursos-humanos")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
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

          {/* PANEL DE FILTRADO TÃ‰CNICO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            {/* Input Fecha */}
            <div className="flex flex-col gap-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_CONSULTA</label>
              <input 
                type="date" 
                value={fechaBusqueda} 
                onChange={(e) => setFechaBusqueda(e.target.value)}
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
                <option value="INCES">INCES</option>
                <option value="Pasante">PASANTES</option>
              </select>
            </div>

            {/* Selector de Ãrea */}
            <div className="flex flex-col gap-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">AREA_UNIDAD</label>
              <select 
                value={filtroArea} 
                onChange={(e) => setFiltroArea(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer uppercase"
              >
                <option value="TODOS">TODAS LAS ÃREAS</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="SEGURIDAD">SEGURIDAD</option>
                <option value="OPERACIONES">OPERACIONES</option>
                <option value="ADMINISTRACION">ADMINISTRACIÃ“N</option>
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

          {/* BARRA DE BÃšSQUEDA Y ACCIONES */}
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

            {/* Botones de acciÃ³n */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <button 
                onClick={ejecutarBusqueda} 
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
                onClick={descargarPDF}
                className="px-5 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-indigo-500/20 hover:shadow-neon-cyan"
              >
                <i className="fas fa-file-pdf"></i> Descargar PDF
              </button>

              <button 
                onClick={() => window.print()}
                className="px-5 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 hover:text-indigo-955 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
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
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÃREA / CARGO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ENTRADA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">SALIDA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">TIPO</th>
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400 font-bold italic text-sm font-mono">
                      {loading ? "Buscando registros..." : "Sin datos â€” seleccione criterios y genere el reporte"}
                    </td>
                  </tr>
                ) : (
                  resultados.map(r => (
                    <tr key={r.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition-all">
                      <td className="py-4 px-3 text-center font-black text-cyan-600 text-sm font-mono">
                        {r.ficha || "---"}
                      </td>
                      
                      <td className="py-4 px-3 text-left font-extrabold text-indigo-950 text-sm uppercase">
                        {r.nombreCompleto}
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
                        <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${r.estatus === "Retraso" ? "bg-orange-50 text-orange-605 border-orange-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                          {r.estatus || "PUNTUAL"}
                        </span>
                      </td>

                      <td className="py-4 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg text-[9px] font-black tracking-widest uppercase font-mono">
                          {r.tipoPersonal}
                        </span>
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

