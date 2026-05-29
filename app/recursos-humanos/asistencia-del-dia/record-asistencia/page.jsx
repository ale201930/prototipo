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

  const hoy = new Date();
  const nombresDiasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  useEffect(() => {
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snap) => {
      setPersonal(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAsist = onSnapshot(query(collection(db, "asistencias"), orderBy("fechaHora", "desc")), (snap) => {
      setAsistencias(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubPersonal(); unsubAsist(); };
  }, []);

  // --- LÓGICA DE FILTRADO CORREGIDA ---
  const listaFiltrada = personal.filter(p => {
    const coincideTexto = p.nombres?.toLowerCase().includes(filtro.toLowerCase()) || 
                          p.ficha?.toLowerCase().includes(filtro.toLowerCase());

    // Usamos la misma lógica del módulo de asistencia que ya te funciona:
    const coincideTipo = (filtroTipo === "TODOS") || 
                         (filtroTipo === "INVECEM" && p.tipoPersonal === "INVECEM") || 
                         (filtroTipo === "INCES" && p.tipoPersonal?.includes("INCES")) || 
                         (filtroTipo === "PASANTES" && p.tipoPersonal === "Pasante");
    
    return coincideTexto && coincideTipo;
  });
  // ------------------------------------

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

  return (
    <div className="layout">
      <nav className="top-nav">
        <div className="logo">SYSTEM-CONTROL <span className="red-text">INVECEM</span></div>
        <button className="btn-return" onClick={() => router.back()}>VOLVER</button>
      </nav>

      <div className="content">
        <header className="report-header">
          <h1 className="report-title">Control de Asistencia</h1>
          <div className="date-display">{obtenerTituloFecha()}</div>
        </header>

        <div className="action-bar shadow-relief">
          <div className="search-container">
            <input type="date" className="date-input" onChange={(e) => setFechaReferencia(e.target.value ? new Date(e.target.value + "T12:00:00") : new Date())} />
            
            <select className="type-select" onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="TODOS">TODOS</option>
                <option value="INVECEM">INVECEM</option>
                <option value="INCES">ESTUDIANTES INCES</option>
                <option value="PASANTES">PASANTES</option>
            </select>

            <div className="tabs">
              <button className={vista === 'semanal' ? 'active' : ''} onClick={() => setVista('semanal')}>SEMANAL</button>
              <button className={vista === 'mensual' ? 'active' : ''} onClick={() => setVista('mensual')}>MENSUAL</button>
            </div>
          </div>
          <div className="search-container" style={{flex: 1}}>
             <input type="text" placeholder="Buscar personal..." onChange={(e) => setFiltro(e.target.value)} />
          </div>
        </div>

        <div className="card shadow-relief">
          <div className="table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th style={{minWidth: '200px'}}>PERSONAL</th>
                  {vista === 'semanal' 
                    ? obtenerDiasSemana().map((d, i) => <th key={i}>{d.nombre}<br/>{d.dia}</th>)
                    : obtenerDiasMes().map((d, i) => <th key={i} className="mini-th">{d.nombre}<br/>{d.dia}</th>)
                  }
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((p) => {
                  let acumuladoExtra = 0;
                  return (
                    <tr key={p.id}>
                      <td className="sticky-col">
                        <div className="worker-name">{p.nombres} {p.apellidos}</div>
                        <div className="worker-ficha">FICHA: {p.ficha}</div>
                      </td>
                      {vista === 'semanal' ? 
                        obtenerDiasSemana().map((d, i) => {
                            const info = obtenerDatosReales(p, d.dia, d.mes, d.anio);
                            acumuladoExtra += info.extra;
                            return <td key={i}><div className={`status-badge ${info.clase}`}>{info.label}</div></td>;
                        }) : 
                        obtenerDiasMes().map((d, i) => {
                            const info = obtenerDatosReales(p, d.dia, d.mes, d.anio);
                            acumuladoExtra += info.extra;
                            return <td key={i}><div className={`status-badge ${info.clase}`}>{info.label}</div></td>;
                        })
                      }
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
        .layout { background-color: #f0f4f8; background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px); background-size: 24px 24px; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .top-nav { background: #0f172a; color: white; padding: 12px 25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #e30613; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .logo { font-weight: 900; font-size: 20px; }
        .red-text { color: #e30613; }
        .btn-return { background: #e30613; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; text-transform: uppercase; transition: 0.3s; }
        .content { padding: 30px; max-width: 1200px; margin: 0 auto; }
        .report-header { margin-bottom: 35px; border-left: 6px solid #0f172a; padding-left: 20px; }
        .report-title { font-size: 38px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -2px; }
        .date-display { font-size: 20px; font-weight: 900; color: #e30613; text-transform: capitalize; margin-top: 5px; }
        .action-bar { display: flex; gap: 15px; margin-bottom: 25px; padding: 20px; background: white; border-radius: 18px; align-items: center; }
        .shadow-relief { border: 1px solid #e2e8f0; border-top: 8px solid #e30613; box-shadow: 12px 12px 0px #0f172a; }
        .search-container input, .date-input, .type-select { padding: 12px; border: 2px solid #f1f5f9; border-radius: 12px; font-weight: 600; outline: none; }
        .type-select { background: white; cursor: pointer; color: #0f172a; }
        .tabs { background: #f1f5f9; padding: 4px; border-radius: 12px; display: flex; }
        .tabs button { border: none; padding: 8px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; background: transparent; color: #64748b; }
        .tabs button.active { background: white; color: #e30613; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card { background: white; border-radius: 24px; overflow: hidden; padding: 20px; }
        .table-wrapper { overflow-x: auto; }
        .user-table { width: 100%; border-collapse: collapse; }
        .user-table th { padding: 15px; font-size: 11px; color: #64748b; border-bottom: 3px solid #e30613; text-align: center; }
        .mini-th { font-size: 9px !important; }
        .user-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center; }
        .sticky-col { position: sticky; left: 0; background: white; text-align: left !important; min-width: 200px; border-right: 2px solid #f1f5f9; }
        .worker-name { font-weight: 800; color: #0f172a; }
        .worker-ficha { font-size: 10px; color: #e30613; font-weight: 900; }
        .status-badge { padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; color: white; display: inline-block; white-space: nowrap; }
        .status-presente { background: #22c55e; }
        .status-ausente { background: #e11d48; } 
        .status-descanso { background: #64748b; } 
        .extra-total { font-weight: 900; color: #e30613; background: #fff1f2; }
      `}</style>
    </div>
  );
}