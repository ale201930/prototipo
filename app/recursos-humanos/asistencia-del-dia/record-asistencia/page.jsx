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
  const [vista, setVista] = useState("semanal");
  const [fechaReferencia, setFechaReferencia] = useState(new Date());

  // Configuración de días
  const nombresDias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  useEffect(() => {
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snap) => {
      setPersonal(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAsist = onSnapshot(query(collection(db, "asistencias"), orderBy("fechaHora", "desc")), (snap) => {
      setAsistencias(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubPersonal(); unsubAsist(); };
  }, []);

  // Obtener las fechas de la semana seleccionada
  const obtenerDiasSemana = () => {
    const inicio = new Date(fechaReferencia);
    const diaSemana = inicio.getDay();
    const diferencia = inicio.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    inicio.setDate(diferencia);

    return nombresDias.map((nombre, i) => {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      return { nombre, fecha: fecha.getDate(), mes: fecha.getMonth(), fullDate: fecha };
    });
  };

  // Obtener los días del mes seleccionado
  const obtenerDiasMes = () => {
    const anio = fechaReferencia.getFullYear();
    const mes = fechaReferencia.getMonth();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    return Array.from({ length: diasEnMes }, (_, i) => i + 1);
  };

  const obtenerDatosReales = (ficha, dia, mes, anio) => {
    const registro = asistencias.find(a => {
      const fA = a.fechaHora?.toDate();
      return fA && fA.getDate() === dia && fA.getMonth() === mes && fA.getFullYear() === anio && a.ficha === ficha;
    });

    if (!registro) return { clase: "status-ausente", extra: 0 };
    
    let hExtra = 0;
    if (registro.salida && registro.horaSalidaProgramada) {
      const [hS, mS] = registro.salida.split(":").map(Number);
      const [hP, mP] = registro.horaSalidaProgramada.split(":").map(Number);
      const diff = (hS * 60 + mS) - (hP * 60 + mP);
      if (diff > 0) hExtra = Math.floor(diff / 60);
    }
    return { clase: "status-presente", extra: hExtra };
  };

  const exportarPDF = () => window.print();

  const listaFiltrada = personal.filter(p => 
    p.nombres?.toLowerCase().includes(filtro.toLowerCase()) || p.ficha?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="main-wrapper">
      <div className="container">
        <div className="nav-header no-print">
          <button className="btn-back" onClick={() => router.back()}>← VOLVER</button>
          
          <div className="controls-group">
            <input 
              type="date" 
              className="date-selector"
              onChange={(e) => setFechaReferencia(new Date(e.target.value + "T12:00:00"))}
            />
            <div className="tabs-selector">
              <button className={vista === 'semanal' ? 'active' : ''} onClick={() => setVista('semanal')}>SEMANAL</button>
              <button className={vista === 'mensual' ? 'active' : ''} onClick={() => setVista('mensual')}>MENSUAL</button>
            </div>
          </div>

          <button className="btn-export" onClick={exportarPDF}>GENERAR REPORTE PDF</button>
        </div>

        <div className="glass-container">
          <div className="accent-line"></div>
          <header className="header-info">
            <div>
              <h2>Récord de Asistencia y Horas Extra</h2>
              <p>INVECEM - Período: {fechaReferencia.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
            </div>
            <input type="text" placeholder="Buscar ficha o nombre..." className="search-box no-print" onChange={(e) => setFiltro(e.target.value)} />
          </header>

          <div className="table-overflow">
            <table className="db-table">
              <thead>
                <tr>
                  <th className="sticky-col">DATOS DEL PERSONAL</th>
                  {vista === 'semanal' ? (
                    obtenerDiasSemana().map(d => (
                      <th key={d.fecha}>{d.nombre.substring(0, 2)} <br/> <small>{d.fecha}</small></th>
                    ))
                  ) : (
                    obtenerDiasMes().map(d => <th key={d}>{d}</th>)
                  )}
                  <th className="total-col">TOTAL EXTRA</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((p) => {
                  let acumuladoExtra = 0;
                  return (
                    <tr key={p.id}>
                      <td className="sticky-col worker-info">
                        <strong>{p.nombres} {p.apellidos}</strong>
                        <span>FICHA: {p.ficha}</span>
                      </td>
                      {vista === 'semanal' ? (
                        obtenerDiasSemana().map(d => {
                          const info = obtenerDatosReales(p.ficha, d.fecha, d.mes, d.fullDate.getFullYear());
                          acumuladoExtra += info.extra;
                          return <td key={d.fecha} className="dot-cell"><div className={`dot ${info.clase}`}></div></td>;
                        })
                      ) : (
                        obtenerDiasMes().map(d => {
                          const info = obtenerDatosReales(p.ficha, d, fechaReferencia.getMonth(), fechaReferencia.getFullYear());
                          acumuladoExtra += info.extra;
                          return <td key={d} className="dot-cell"><div className={`dot ${info.clase}`}></div></td>;
                        })
                      )}
                      <td className="extra-total">{acumuladoExtra}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .main-wrapper { background: #f1f5f9; min-height: 100vh; padding: 40px; font-family: 'Inter', sans-serif; }
        .container { max-width: 1400px; margin: 0 auto; }
        .nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; gap: 15px; }
        
        .controls-group { display: flex; gap: 15px; align-items: center; }
        .date-selector { padding: 10px; border-radius: 10px; border: 2px solid #cbd5e1; font-weight: bold; }
        
        .tabs-selector { background: #e2e8f0; padding: 4px; border-radius: 12px; display: flex; }
        .tabs-selector button { border: none; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; color: #64748b; background: none; }
        .tabs-selector button.active { background: white; color: #e30613; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }

        .glass-container { background: white; border-radius: 20px; border: 1px solid #e2e8f0; position: relative; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.05); }
        .accent-line { position: absolute; top: 0; width: 100%; height: 6px; background: #e30613; }
        .header-info { padding: 25px; display: flex; justify-content: space-between; align-items: center; }
        .header-info h2 { margin: 0; font-weight: 900; }
        
        .db-table { width: 100%; border-collapse: collapse; }
        .db-table th { padding: 12px 5px; font-size: 10px; color: #94a3b8; border-bottom: 1px solid #f1f5f9; }
        .db-table td { padding: 10px 5px; border-bottom: 1px solid #f1f5f9; text-align: center; }
        .sticky-col { position: sticky; left: 0; background: white; z-index: 5; text-align: left !important; min-width: 200px; padding-left: 20px !important; border-right: 2px solid #f1f5f9; }
        
        .worker-info strong { display: block; font-size: 12px; color: #0f172a; }
        .worker-info span { font-size: 10px; color: #e30613; font-weight: 900; }

        .dot { width: 10px; height: 10px; border-radius: 50%; margin: 0 auto; }
        .status-presente { background: #22c55e !important; }
        .status-ausente { background: #e2e8f0 !important; }
        .extra-total { font-weight: 900; color: #0f172a; background: #fff1f2 !important; }
        .total-col { background: #0f172a !important; color: white !important; }

        .btn-export { background: #e30613; color: white; border: none; padding: 12px 25px; border-radius: 12px; font-weight: 800; cursor: pointer; }
        .btn-back { background: #0f172a; color: white; border: none; padding: 12px 25px; border-radius: 12px; font-weight: 800; cursor: pointer; }

        @media print {
          @page { size: landscape; margin: 5mm; }
          .no-print { display: none !important; }
          .main-wrapper { padding: 0; background: white; }
          .glass-container { border: none; }
          .db-table { font-size: 8px; } /* Achicamos la letra para que quepa el mes */
          .dot { width: 7px; height: 7px; }
          .sticky-col { position: static !important; border-right: 1px solid #ddd; }
          -webkit-print-color-adjust: exact;
        }
      `}</style>
    </div>
  );
}