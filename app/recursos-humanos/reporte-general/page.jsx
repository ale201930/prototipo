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
    <div className="main-wrapper">
      <header className="invecem-header">
        <div className="logo-box">SYSTEM-CONTROL<span className="red-text"> INVECEM</span></div>
        <button className="btn-return" onClick={() => router.push("/recursos-humanos")}>VOLVER </button>
      </header>

      <div className="container">
        <div className="form-card-invecem">
          <div className="red-accent-bar"></div>
          <header className="form-top-info">
            <h1 className="company-name">REPORTE GENERAL</h1>
            <div className="badge-status">Control de Asistencia</div>
          </header>

          <div className="table-container shadow-relief">
            <div className="table-actions no-print">
               <div className="input-group" style={{flex: 1}}>
                  <input type="date" value={fechaBusqueda} onChange={(e) => setFechaBusqueda(e.target.value)} />
               </div>
               <select className="area-select" value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
                  <option value="TODOS">TODOS (EMPRESA)</option>
                  <option value="INVECEM">INVECEM</option>
                  <option value="INCES">INCES</option>
                  <option value="Pasante">PASANTES</option>
               </select>
               <select className="area-select" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
                  <option value="TODOS">TODAS LAS ÁREAS</option>
                  <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                  <option value="SEGURIDAD">SEGURIDAD</option>
                  <option value="OPERACIONES">OPERACIONES</option>
                  <option value="ADMINISTRACION">ADMINISTRACIÓN</option>
               </select>
               <select className="area-select" value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)}>
                  <option value="TODOS">TODOS LOS TURNOS</option>
                  <option value="DIURNO">DIURNO</option>
                  <option value="NOCTURNO">NOCTURNO</option>
               </select>
            </div>
            
            <div className="table-actions no-print">
                <input type="text" className="search-input" placeholder="Buscar por ficha o nombre..." value={busquedaManual} onChange={(e) => setBusquedaManual(e.target.value)} />
                <button className="btn-print" onClick={ejecutarBusqueda} disabled={loading} style={{background: '#0f172a'}}>
                   {loading ? "CARGANDO..." : "GENERAR"}
                </button>
                <button className="btn-print" onClick={descargarPDF}>📥 PDF</button>
                <button className="btn-print" onClick={() => window.print()}>🖨️ IMPRIMIR</button>
            </div>

            <table className="asistencia-table">
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
                    <td className="ficha-cell">{r.ficha}</td>
                    <td className="nombre-cell">{r.nombreCompleto}</td>
                    <td>
                        <div className="cargo-text">{r.area}</div>
                        <div className="area-text">{r.cargo}</div>
                    </td>
                    <td className="hora-cell">{formatAMPM(r.entrada)}</td>
                    <td className="hora-cell">{formatAMPM(r.salida)}</td>
                    <td>
                      <span className={`badge ${r.estatus === "Retraso" ? "falta" : "puntual"}`}>
                        {r.estatus || "PUNTUAL"}
                      </span>
                    </td>
                    <td><div className="area-text">{r.tipoPersonal}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* --- ESTILOS EXACTOS DEL MODELO --- */
        .invecem-header { background: #0f172a; color: white; padding: 12px 25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #e30613; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .logo-box { font-weight: 900; font-size: 20px; letter-spacing: -1px; }
        .red-text { color: #e30613; }
        .btn-return { background: #e30613; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        
        .main-wrapper { background-color: #f0f4f8; background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px); background-size: 24px 24px; min-height: 100vh; padding-bottom: 40px; font-family: 'Inter', sans-serif; }
        .container { max-width: 1400px; margin: 0 auto; padding-top: 20px; }
        .form-card-invecem { background: rgba(255, 255, 255, 0.98); border-radius: 24px; position: relative; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); padding: 50px; }
        .red-accent-bar { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #e30613, #b8050f); border-radius: 24px 24px 0 0; }
        .company-name { font-size: 38px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -2px; }
        .badge-status { background: #f8fafc; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display: inline-block; border: 1px solid #e2e8f0; margin-top: 8px; margin-bottom: 20px; }
        
        .table-container { background: white; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; }
        .shadow-relief { box-shadow: 10px 10px 0px #e30613; }
        .table-actions { display: flex; gap: 15px; margin-bottom: 20px; }
        .search-input, .area-select, .input-group input { padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; font-weight: 600; flex: 1; }
        .btn-print { background: #e30613; color: white; border: none; padding: 0 20px; border-radius: 10px; font-weight: 800; cursor: pointer; height: 48px; }
        
        .asistencia-table { width: 100%; border-collapse: collapse; }
        .asistencia-table th { text-align: left; padding: 15px; color: #94a3b8; font-size: 11px; border-bottom: 3px solid #f1f5f9; font-weight: 900; text-transform: uppercase; }
        .asistencia-table td { padding: 18px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .ficha-cell { font-weight: 900; color: #0f172a; }
        .nombre-cell { font-weight: 700; text-transform: uppercase; color: #1e293b; }
        .cargo-text { font-weight: 800; color: #e30613; font-size: 12px; }
        .area-text { font-weight: 600; color: #94a3b8; font-size: 10px; text-transform: uppercase; }
        .hora-cell { font-family: monospace; font-weight: 900; color: #1e293b; font-size: 15px; }
        .badge { padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; display: inline-block; }
        .puntual { background: #22c55e; color: white; }
        .falta { background: #ef4444; color: white; }
        
        @media print { .no-print { display: none !important; } .main-wrapper { background: white; padding: 0; } .shadow-relief { box-shadow: none; border: 1px solid #000; } }
      `}</style>
    </div>
  );
}