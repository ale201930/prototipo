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

  // Función para mostrar la fecha en formato DD/MM/AAAA
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
      // AJUSTE PARA TURNO NOCTURNO:
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

      // 1. FILTRO DE SEGURIDAD EXCLUSIVO DE RRHH:
      // Excluye radicalmente contratistas o contratas del Reporte General
      data = data.filter(item => {
        const tipo = item.tipoPersonal?.toUpperCase() || "";
        return !tipo.includes("CONTRATA") && !tipo.includes("CONTRATISTA");
      });

      // Filtro de seguridad: Solo mostramos registros que pertenecen al día de hoy,
      // O registros de ayer cuya salida fue hoy (después de las 00:00).
      data = data.filter(item => {
        const fechaDoc = item.fechaHora.toDate().toISOString().split('T')[0];
        if (fechaDoc === fechaBusqueda) return true;
        
        // Si el registro es de "ayer", lo mostramos solo si tiene salida (porque indica que terminó hoy)
        // O si no tiene salida aún pero es del turno nocturno esperado.
        return item.salida && item.salida !== "--:--";
      });

      // Filtros por Categoría (Fijo, Inces, Pasante)
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
    doc.text(`REGISTROS DEL DÍA: ${fechaLinda} | TURNO: ${filtroTurno}`, 15, 30);

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
      head: [['FICHA', 'COLABORADOR', 'ÁREA / CARGO', 'ENTRADA', 'SALIDA', 'ESTATUS', 'TIPO']],
      body: filas,
      headStyles: { fillColor: [227, 6, 19] },
      styles: { fontSize: 8 }
    });
    
    doc.save(`Reporte_${areaTexto}_${fechaLinda.replace(/\//g, '-')}.pdf`);
  };

  if (!mounted) return null;

  return (
    <div className="container">
      <div className="print-only">
        <h1 style={{fontSize: '20px', marginBottom: '5px'}}>INVECEM - CONTROL DE ASISTENCIA</h1>
        <h2 style={{fontSize: '16px', color: '#666'}}>ÁREA: {filtroArea === "TODOS" ? "GENERAL" : filtroArea}</h2>
        <p style={{fontWeight: 'bold'}}>FECHA: {formatearFechaVisual(fechaBusqueda)}</p>
        <hr />
      </div>

      <div className="header no-print">
        <button className="btn-back" onClick={() => router.push("/recursos-humanos")}>← VOLVER</button>
        <h1 className="title">Reportes <span className="text-red">INVECEM</span></h1>
      </div>

      <div className="search-box shadow-relief no-print">
        <div className="grid-filters">
          <div className="input-group">
            <label>Fecha de Consulta</label>
            <input type="date" value={fechaBusqueda} onChange={(e) => setFechaBusqueda(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Categoría</label>
            <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
              <option value="TODOS">TODOS</option>
              <option value="INVECEM">INVECEM</option>
              <option value="INCES">INCES</option>
              <option value="Pasante">PASANTES</option>
            </select>
          </div>
          <div className="input-group">
            <label>Departamento</label>
            <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
              <option value="TODOS">TODAS LAS ÁREAS</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="SEGURIDAD">SEGURIDAD</option>
              <option value="OPERACIONES">OPERACIONES</option>
              <option value="ADMINISTRACION">ADMINISTRACIÓN</option>
            </select>
          </div>
          <div className="input-group">
            <label>Turno</label>
            <select value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)}>
              <option value="TODOS">TODOS</option>
              <option value="DIURNO">DIURNO</option>
              <option value="NOCTURNO">NOCTURNO</option>
            </select>
          </div>
        </div>

        <div className="extra-filters">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por ficha o nombre..."
            value={busquedaManual}
            onChange={(e) => setBusquedaManual(e.target.value)}
          />
          <button className="btn-search" onClick={ejecutarBusqueda} disabled={loading}>
            {loading ? "PROCESANDO..." : "GENERAR REPORTE"}
          </button>
        </div>
      </div>

      {resultados.length > 0 ? (
        <div className="results-container animate-in">
          <div className="results-header no-print">
            <div className="stats">
              Registros del <b className="text-red">{formatearFechaVisual(fechaBusqueda)}</b>: <b className="text-turquesa">{resultados.length}</b>
            </div>
            <div className="btn-group">
               <button className="btn-pdf" onClick={descargarPDF}>📥 EXPORTAR PDF</button>
               <button className="btn-print" onClick={() => window.print()}>🖨️ IMPRIMIR LISTADO</button>
            </div>
          </div>
          
          <div className="table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th>FICHA</th>
                  <th>COLABORADOR</th>
                  <th>ÁREA / CARGO</th>
                  <th>ENTRADA</th>
                  <th>SALIDA</th>
                  <th>ESTATUS</th>
                  <th>TIPO</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(r => (
                  <tr key={r.id}>
                    <td className="ficha-num">{r.ficha}</td>
                    <td className="bold">{r.nombreCompleto}</td>
                    <td className="area-td">
                        <div className="main-area">{r.area}</div>
                        <div className="sub-cargo">{r.cargo}</div>
                    </td>
                    <td className="hora">{formatAMPM(r.entrada)}</td>
                    <td className="hora">{formatAMPM(r.salida)}</td>
                    <td>
                      <span className={`badge ${r.estatus === "Retraso" ? "bg-red" : "bg-turquesa"}`}>
                        {r.estatus || "PUNTUAL"}
                      </span>
                    </td>
                    <td className="tipo-tag">{r.tipoPersonal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !loading && <div className="no-data no-print">No hay registros para {formatearFechaVisual(fechaBusqueda)}.</div>
      )}

      <style jsx>{`
        /* ESTILO INTEGRAL INVECEM - REPORTE GENERAL */
        .container { 
          padding: 40px; 
          max-width: 1400px; 
          margin: 0 auto; 
          background-color: #f0f4f8;
          background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px);
          background-size: 24px 24px;
          min-height: 100vh; 
          font-family: 'Inter', sans-serif; 
        }

        .print-only { display: none; }

        .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; }
        
        .btn-back { 
          background: white; 
          border: 1px solid #e2e8f0; 
          padding: 10px 16px; 
          border-radius: 10px; 
          font-weight: 800; 
          color: #64748b; 
          cursor: pointer; 
          transition: 0.3s; 
        }
        .btn-back:hover { color: #e30613; transform: translateX(-5px); }

        .title { font-size: 28px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -1px; }
        .text-red { color: #e30613; }

        /* CAJA DE BÚSQUEDA ESTILO INVECEM */
        .search-box { 
          background: #0f172a; 
          padding: 30px; 
          border-radius: 24px; 
          margin-bottom: 40px; 
          color: white; 
          position: relative;
          border: 1px solid #1e293b;
          box-shadow: 10px 10px 0px #e30613; 
        }

        .grid-filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
        
        .input-group label { 
          display: block; 
          font-size: 10px; 
          font-weight: 900; 
          color: #94a3b8; 
          margin-bottom: 8px; 
          text-transform: uppercase; 
          letter-spacing: 1px;
        }

        .input-group input, .input-group select { 
          width: 100%; 
          padding: 12px; 
          border-radius: 12px; 
          border: none; 
          font-weight: 800; 
          color: #0f172a; 
          background: white; 
        }

        .extra-filters { 
          display: flex; 
          gap: 15px; 
          border-top: 1px solid #1e293b; 
          padding-top: 20px; 
        }

        .search-input { 
          flex: 1; 
          padding: 15px; 
          border-radius: 12px; 
          border: 2px solid #e30613; 
          font-weight: 700; 
          color: #0f172a !important; 
          background: white !important; 
          outline: none; 
        }

        .btn-search { 
          background: #e30613; 
          color: white; 
          border: none; 
          padding: 0 35px; 
          border-radius: 12px; 
          font-weight: 900; 
          cursor: pointer; 
          transition: 0.3s;
          box-shadow: 0 4px 0px #b8050f;
        }
        .btn-search:hover { transform: translateY(2px); box-shadow: 0 2px 0px #8a040b; }

        .results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        
        .stats { font-weight: 800; color: #64748b; font-size: 14px; }
        .text-turquesa { color: #e30613; }

        .btn-pdf { 
          background: #0f172a; 
          color: white; 
          border: none; 
          padding: 12px 20px; 
          border-radius: 10px; 
          font-weight: 800; 
          cursor: pointer; 
          transition: 0.3s;
        }

        .btn-print { 
          background: #e30613; 
          color: white; 
          border: none; 
          padding: 12px 20px; 
          border-radius: 10px; 
          font-weight: 800; 
          cursor: pointer; 
          transition: 0.3s;
          box-shadow: 0 4px 0px #b8050f;
        }

        .table-wrapper { 
          background: white; 
          border-radius: 24px; 
          overflow: hidden; 
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
        }

        .report-table { width: 100%; border-collapse: collapse; }
        
        .report-table th { 
          background: #f8fafc; 
          padding: 20px; 
          text-align: left; 
          font-size: 11px; 
          font-weight: 900; 
          color: #94a3b8; 
          border-bottom: 3px solid #f1f5f9; 
          text-transform: uppercase;
        }

        .report-table td { padding: 18px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; }
        
        .main-area { font-weight: 900; color: #0f172a; font-size: 12px; text-transform: uppercase; }
        .sub-cargo { font-size: 11px; color: #e30613; font-weight: 800; text-transform: uppercase; }
        
        .ficha-num { font-weight: 900; color: #0f172a; font-family: 'Inter', sans-serif; font-size: 16px; }
        .bold { font-weight: 800; text-transform: uppercase; color: #1e293b; }
        .hora { font-family: monospace; font-weight: 900; color: #0f172a; font-size: 15px; }

        .badge { padding: 6px 14px; border-radius: 8px; font-size: 10px; font-weight: 900; color: white; text-transform: uppercase; }
        .bg-red { background: #e30613; }
        .bg-turquesa { background: #22c55e; }

        .tipo-tag { font-weight: 800; color: #64748b; font-size: 11px; }

        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; margin-bottom: 15px; text-align: center; }
          .container { padding: 0; background: white; }
          .table-wrapper { box-shadow: none; border: 1px solid #000; border-radius: 0; }
          .report-table th { background: #f0f0f0 !important; color: black; border: 1px solid #000; }
          .report-table td { border: 1px solid #000; }
        }
      `}</style>
    </div>
  );
}