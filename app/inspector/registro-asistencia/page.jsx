"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { 
  collection, query, where, getDocs, addDoc, 
  updateDoc, doc, serverTimestamp, onSnapshot, orderBy, deleteDoc 
} from "firebase/firestore";

export default function RegistroAsistencia() {
  const router = useRouter();
  const inputRef = useRef(null);

  const [identificador, setIdentificador] = useState("");
  const [filtro, setFiltro] = useState("");
  const [asistenciasHoy, setAsistenciasHoy] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [fechaHoy, setFechaHoy] = useState("");

  const MASTER_PIN = "1234"; 

  // --- LÓGICA DE TIEMPO ---
  const obtenerHora24 = () => {
    return new Date().toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const convertirAMinutos = (horaStr) => {
    if (!horaStr) return 0;
    const [hrs, mins] = horaStr.split(":").map(Number);
    return (hrs * 60) + mins;
  };

  useEffect(() => {
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    setFechaHoy(new Date().toLocaleDateString('es-ES', opciones).toUpperCase());

    // CAMBIO 1: Quitamos el filtro de "inicioHoy" para que el personal nocturno 
    // que entró ayer aparezca en la lista del inspector como "Sin Salida".
    const q = query(
      collection(db, "asistencias"),
      orderBy("fechaHora", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAsistenciasHoy(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const mantenerFoco = () => inputRef.current?.focus();
    const interval = setInterval(mantenerFoco, 500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // LIMPIAR BASE DE DATOS PARA PRUEBAS
  const handleLimpiarBase = async () => {
    const pin = prompt("MODO DESARROLLADOR: Ingrese PIN para vaciar asistencias de hoy:");
    if (pin === MASTER_PIN) {
      setCargando(true);
      try {
        const snapshot = await getDocs(collection(db, "asistencias"));
        const promesas = snapshot.docs.map(d => deleteDoc(doc(db, "asistencias", d.id)));
        await Promise.all(promesas);
      } catch (error) {
        console.error("Error al limpiar:", error);
      }
      setCargando(false);
    }
  };

  // PROCESAR REGISTRO AUTOMÁTICO
  const procesarRegistro = useCallback(async () => {
    const valor = identificador.trim();
    if (!valor || cargando) return;

    setCargando(true);
    setIdentificador(""); 

    try {
      const personalRef = collection(db, "personal");
      let q = query(personalRef, where("ficha", "==", valor));
      let snap = await getDocs(q);

      if (snap.empty) {
        q = query(personalRef, where("cedula", "==", valor));
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        const trabajador = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const horaActual = obtenerHora24();
        
        // CAMBIO 2: La búsqueda del "existe" ahora encontrará al trabajador 
        // aunque su entrada sea de ayer, siempre y cuando no tenga salida marcada.
        const existe = asistenciasHoy.find(a => a.ficha === trabajador.ficha && !a.salida);

        if (existe) {
          // REGISTRAR SALIDA (Funciona para Diurnos y Nocturnos)
          await updateDoc(doc(db, "asistencias", existe.id), {
            salida: horaActual,
            estado: "FINALIZADO" 
          });
        } else {
          // REGISTRAR ENTRADA
          const minM = convertirAMinutos(horaActual);
          const minT = convertirAMinutos(trabajador.horaEntrada || "07:00");
          const estatusCalculado = minM > (minT + 15) ? "RETRASO" : "PUNTUAL";

          await addDoc(collection(db, "asistencias"), {
            nombreCompleto: `${trabajador.nombres} ${trabajador.apellidos}`.toUpperCase(),
            ficha: trabajador.ficha,
            cedula: trabajador.cedula,
            cargo: trabajador.cargo || "OPERARIO",
            area: trabajador.area || "PLANTA", 
            tipoPersonal: trabajador.categoria || "INVECEM",
            entrada: horaActual,
            salida: null,
            estatus: estatusCalculado, 
            fechaHora: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setCargando(false);
    }
  }, [identificador, cargando, asistenciasHoy]);

  useEffect(() => {
    if (identificador.length >= 5) {
      const timeoutId = setTimeout(() => procesarRegistro(), 400);
      return () => clearTimeout(timeoutId);
    }
  }, [identificador, procesarRegistro]);

  return (
    <div className="main-wrapper">
      <div className="container">
        
        <div className="no-print nav-row">
          <button onClick={() => router.push("/inspector")} className="btn-back">← VOLVER AL PANEL</button>
          <div className="nav-actions">
            <button onClick={handleLimpiarBase} className="btn-clean">🧹 Limpiar Base</button>
            <button onClick={() => window.print()} className="btn-action btn-white">🖨️ Imprimir</button>
            <button onClick={() => window.print()} className="btn-action btn-red">📄 Descargar PDF</button>
          </div>
        </div>

        <div className="glass-card shadow-3d">
          <div className="accent-bar"></div>

          <header className="card-header">
            <div className="title-group">
              <h1>Asistencia de Personal</h1>
              <p className="badge-plant">INVECEM • Control de Acceso</p>
            </div>
            <div className="date-banner">{fechaHoy}</div>
          </header>

          <section className="scanner-section no-print">
            <div className="scanner-layout">
              <div className="info">
                <label>LECTOR DE IDENTIFICACIÓN</label>
                <p>Escanee la ficha para registro automático</p>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="ESPERANDO..."
                className="input-scan"
                autoComplete="off"
              />
            </div>
          </section>

          <div className="table-wrapper">
            <table className="asistencia-table">
              <thead>
                <tr>
                  <th>FICHA</th>
                  <th>COLABORADOR</th>
                  <th>ÁREA / DPTO</th>
                  <th>ENTRADA</th>
                  <th>SALIDA</th>
                  <th>ESTATUS</th>
                </tr>
              </thead>
              <tbody>
                {asistenciasHoy
                  .filter(a => (a.nombreCompleto || "").toLowerCase().includes(filtro.toLowerCase()))
                  .map(reg => (
                    <tr key={reg.id}>
                      <td className="ficha-col">{reg.ficha}</td>
                      <td className="name-col">
                        <strong>{reg.nombreCompleto}</strong>
                        <small>{reg.cargo}</small>
                      </td>
                      <td className="area-col">{reg.area}</td>
                      <td className="time-text">{reg.entrada}</td>
                      <td className="time-text">{reg.salida || "--:--"}</td>
                      <td>
                        <div className="status-container">
                          <span className={`status-pill ${(reg.estatus || "").toLowerCase()}`}>
                            {reg.estatus}
                          </span>
                          {reg.salida && <span className="label-finalizado">FINALIZADO</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .main-wrapper { 
          background-color: #f1f5f9; 
          background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
          background-size: 20px 20px;
          min-height: 100vh; padding: 40px 20px; font-family: 'Inter', sans-serif; 
        }
        .container { max-width: 1200px; margin: 0 auto; }
        
        .nav-row { display: flex; justify-content: space-between; margin-bottom: 25px; align-items: center; }
        .nav-actions { display: flex; gap: 12px; }
        .btn-back { background: #0f172a; color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
        
        .btn-clean { background: white; color: #e30613; border: 2px solid #e30613; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
        .btn-action { padding: 12px 25px; border-radius: 10px; font-weight: 800; cursor: pointer; border: none; font-size: 14px; }
        .btn-white { background: white; color: #0f172a; border: 1px solid #e2e8f0; }
        .btn-red { background: #e30613; color: white; }

        .glass-card { background: white; border-radius: 20px; overflow: hidden; }
        .shadow-3d { box-shadow: 0 10px 30px rgba(0,0,0,0.05), 10px 10px 0px #cbd5e1; }
        .accent-bar { height: 6px; background: #e30613; }

        .card-header { padding: 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .title-group h1 { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; }
        .badge-plant { background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; color: #475569; margin-top: 5px; display: inline-block; }
        .date-banner { background: #0f172a; color: white; padding: 15px 25px; border-radius: 12px; font-weight: 800; }

        .scanner-section { padding: 30px 40px; }
        .scanner-layout { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 15px; padding: 25px; display: flex; justify-content: space-between; align-items: center; }
        .info label { display: block; font-size: 11px; font-weight: 900; color: #94a3b8; }
        .info p { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
        .input-scan { width: 40%; padding: 15px; border: 3px solid #0f172a; border-radius: 12px; font-size: 22px; font-weight: 900; color: #e30613; text-align: center; }

        .asistencia-table { width: 100%; border-collapse: collapse; }
        .asistencia-table th { text-align: left; padding: 20px 40px; font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; }
        .asistencia-table td { padding: 20px 40px; border-bottom: 1px solid #f8fafc; font-size: 14px; }
        
        .ficha-col { font-weight: 900; color: #e30613; }
        .name-col strong { display: block; color: #0f172a; }
        .name-col small { color: #64748b; font-size: 11px; }
        .area-col { font-weight: 700; color: #475569; }
        .time-text { font-family: monospace; font-weight: 800; font-size: 16px; }

        .status-container { display: flex; flex-direction: column; gap: 4px; }
        .status-pill { padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; width: fit-content; text-align: center; }
        .puntual { background: #dcfce7; color: #166534; }
        .retraso { background: #fee2e2; color: #991b1b; }
        .label-finalizado { font-size: 9px; font-weight: 800; color: #94a3b8; margin-left: 2px; }

        @media print {
          .no-print { display: none !important; }
          .main-wrapper { padding: 0; background: white; }
          .glass-card { box-shadow: none; border: none; }
          .asistencia-table td, .asistencia-table th { border: 1px solid #eee; }
        }
      `}</style>
    </div>
  );
}