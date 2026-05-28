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

  const [mostrarModalBeneficio, setMostrarModalBeneficio] = useState(false);
  const [trabajadorEspecial, setTrabajadorEspecial] = useState(null);

  const MASTER_PIN = "1234"; 

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

    const limiteAyer = new Date();
    limiteAyer.setDate(limiteAyer.getDate() - 1);
    limiteAyer.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "asistencias"),
      where("fechaHora", ">=", limiteAyer),
      orderBy("fechaHora", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAsistenciasHoy(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const mantenerFoco = () => {
      if (!mostrarModalBeneficio) {
        inputRef.current?.focus();
      }
    };
    const interval = setInterval(mantenerFoco, 500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [mostrarModalBeneficio]);

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

  const ejecutarEntradaExcepcional = async (trabajador) => {
    setCargando(true);
    try {
      const horaActual = obtenerHora24();
      await addDoc(collection(db, "asistencias"), {
        nombreCompleto: `${trabajador.nombres} ${trabajador.apellidos}`.toUpperCase(),
        ficha: trabajador.idAcceso || trabajador.ficha || "S/F",
        cedula: trabajador.cedula,
        cargo: trabajador.nombreContrata || trabajador.cargo || "OPERARIO",
        area: trabajador.areaTrabajo || trabajador.area || "PLANTA", 
        tipoPersonal: trabajador.tipoPersonal || "INVECEM",
        entrada: horaActual,
        salida: null,
        estatus: "BENEFICIO",
        fechaHora: serverTimestamp(),
        observacionAcceso: `INGRESO AUTORIZADO POR BENEFICIOS: Personal en ${trabajador.estatus.toUpperCase()}`
      });
      alert("✅ Acceso por entrega de beneficio registrado correctamente.");
    } catch (error) {
      console.error("Error al registrar entrada por beneficio:", error);
    } finally {
      setTrabajadorEspecial(null);
      setMostrarModalBeneficio(false);
      setCargando(false);
    }
  };

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

      let trabajador = null;
      let procedencia = "INVECEM";

      if (!snap.empty) {
        trabajador = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } else {
        const contratistasRef = collection(db, "contratistas");
        let qC = query(contratistasRef, where("idAcceso", "==", valor));
        let snapC = await getDocs(qC);

        if (snapC.empty) {
          qC = query(contratistasRef, where("cedula", "==", valor));
          snapC = await getDocs(qC);
        }

        if (!snapC.empty) {
          trabajador = { id: snapC.docs[0].id, ...snapC.docs[0].data() };
          procedencia = "CONTRATISTA";
        }
      }

      if (trabajador) {
        const horaActual = obtenerHora24();
        
        const existe = asistenciasHoy.find(a => 
          (a.cedula === trabajador.cedula || (trabajador.ficha && a.ficha === trabajador.ficha)) && !a.salida
        );

        if (!existe && (trabajador.estatus === "Vacaciones" || trabajador.estatus === "Reposo Médico")) {
          setTrabajadorEspecial(trabajador);
          setMostrarModalBeneficio(true);
          setCargando(false);
          return;
        }

        if (existe) {
          await updateDoc(doc(db, "asistencias", existe.id), {
            salida: horaActual,
            estado: "FINALIZADO" 
          });
        } else {
          const minM = convertirAMinutos(horaActual);
          const minT = convertirAMinutos(trabajador.horaEntrada || "07:00");
          const estatusCalculado = minM > (minT + 15) ? "RETRASO" : "PUNTUAL";

          await addDoc(collection(db, "asistencias"), {
            nombreCompleto: `${trabajador.nombres} ${trabajador.apellidos}`.toUpperCase(),
            ficha: trabajador.idAcceso || trabajador.ficha || "S/F",
            cedula: trabajador.cedula,
            cargo: trabajador.nombreContrata || trabajador.cargo || "OPERARIO",
            area: trabajador.areaTrabajo || trabajador.area || "PLANTA", 
            tipoPersonal: trabajador.tipoPersonal || procedencia,
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
    if (identificador.length >= 4) {
      const timeoutId = setTimeout(() => procesarRegistro(), 400);
      return () => clearTimeout(timeoutId);
    }
  }, [identificador, procesarRegistro]);

  return (
    <div className="main-wrapper">
      {/* NUEVA CABECERA INDUSTRIAL */}
       <header className="invecem-header">
        <div className="logo-box">
          SYSTEM-CONTROL<span className="red-text"> INVECEM</span>
        </div>
        <button className="btn-return" onClick={() => router.push("/inspector")}>VOLVER </button>
      </header>

      <div className="container" style={{ marginTop: '20px' }}>
        
        <div className="no-print nav-row">
          <div style={{width: '100px'}}></div> {/* Espaciador */}
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
                <label>IDENTIFICACIÓN</label>
                <p>Escriba la ficha para registro automático</p>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder={mostrarModalBeneficio ? "RESTRICCIÓN ACTIVA" : "ESPERANDO..."}
                className="input-scan"
                autoComplete="off"
                disabled={mostrarModalBeneficio}
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

      {mostrarModalBeneficio && (
        <div className="industrial-modal-overlay">
          <div className="industrial-modal-card">
            <div className="industrial-alert-header">
              <div className="warning-shield">⚠️</div>
              <h2>RESTRICCIÓN DE ACCESO LABORAL</h2>
            </div>
            
            <div className="industrial-modal-body">
              <p className="industrial-notice">
                El sistema detectó un bloqueo administrativo activo en la ficha de este trabajador. No tiene permitido el acceso para cumplir jornadas laborales ordinarias.
              </p>

              <div className="industrial-info-box">
                <div className="info-box-row">
                  <span>COLABORADOR:</span>
                  <strong>{trabajadorEspecial?.nombres} {trabajadorEspecial?.apellidos}</strong>
                </div>
                <div className="info-box-row">
                  <span>CÉDULA / FICHA:</span>
                  <strong className="text-red">{trabajadorEspecial?.cedula} / {trabajadorEspecial?.ficha || "S/F"}</strong>
                </div>
                <div className="info-box-row">
                  <span>ESTATUS LEGAL:</span>
                  <span className="industrial-status-badge">{trabajadorEspecial?.estatus?.toUpperCase()}</span>
                </div>
              </div>

              <p className="industrial-question">
                ¿El motivo del ingreso es únicamente para el <strong>RETIRO DE BENEFICIOS MENSUALES</strong> (Bolsa de Comida / Higiene)?
              </p>
            </div>

            <div className="industrial-modal-footer">
              <button 
                type="button" 
                className="btn-industrial-deny" 
                onClick={() => { setMostrarModalBeneficio(false); setTrabajadorEspecial(null); }}
              >
                ❌ DENEGAR ENTRADA
              </button>
              <button 
                type="button" 
                className="btn-industrial-allow" 
                onClick={() => ejecutarEntradaExcepcional(trabajadorEspecial)}
              >
                📦 PERMITIR ENTRADA (RETIRO)
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .invecem-header { 
          background: #0f172a; 
          color: white; 
          padding: 12px 25px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 4px solid #e30613; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .logo-box { font-weight: 900; font-size: 20px; letter-spacing: -1px; }
        .red-text { color: #e30613; }
        
        .btn-return { 
          background: #e30613; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 8px; 
          cursor: pointer; 
          font-size: 11px; 
          font-weight: 800; 
          text-transform: uppercase;
          transition: 0.3s;
        }
        .btn-return:hover { background: #b8050f; transform: translateY(-2px); }
        .main-wrapper { 
          background-color: #f1f5f9; 
          background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
          background-size: 20px 20px;
          min-height: 100vh; padding-bottom: 40px; font-family: 'Inter', sans-serif; 
        }
        .container { max-width: 1200px; margin: 0 auto; }
        
        .nav-row { display: flex; justify-content: space-between; margin-bottom: 25px; align-items: center; }
        .nav-actions { display: flex; gap: 12px; }
        
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
        .beneficio { background: #e0f2fe; color: #0369a1; }
        .label-finalizado { font-size: 9px; font-weight: 800; color: #94a3b8; margin-left: 2px; }

        .industrial-modal-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(15, 23, 42, 0.85); display: flex; justify-content: center;
          align-items: center; z-index: 9999; padding: 20px; backdrop-filter: blur(4px);
        }
        .industrial-modal-card {
          background: #ffffff; width: 100%; max-width: 600px; border-radius: 16px;
          overflow: hidden; border: 3px solid #0f172a; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: modalAppear 0.25s ease-out;
        }
        .industrial-alert-header {
          background: #0f172a; padding: 20px; display: flex; align-items: center; gap: 15px;
          border-bottom: 4px solid #e30613;
        }
        .warning-shield {
          font-size: 28px; background: #e30613; padding: 4px 10px; border-radius: 8px;
          animation: pulseIcon 1s infinite alternate;
        }
        .industrial-alert-header h2 {
          color: #ffffff; font-size: 18px; font-weight: 900; margin: 0; letter-spacing: 0.5px;
        }
        .industrial-modal-body { padding: 30px; background: #ffffff; }
        .industrial-notice {
          color: #475569; font-size: 13px; font-weight: 600; line-height: 1.5; margin: 0 0 20px 0;
        }
        .industrial-info-box {
          background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px;
          padding: 18px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;
        }
        .info-box-row {
          display: flex; justify-content: space-between; font-size: 13px; align-items: center;
        }
        .info-box-row span { font-weight: 800; color: #64748b; font-size: 11px; }
        .info-box-row strong { font-weight: 900; color: #0f172a; }
        .info-box-row .text-red { color: #e30613; }
        .industrial-status-badge {
          background: #fee2e2; color: #e30613; padding: 4px 12px; border-radius: 6px;
          font-weight: 900; font-size: 11px; border: 1px solid #fca5a5;
        }
        .industrial-question {
          font-size: 14px; color: #0f172a; font-weight: 700; text-align: center;
          margin: 15px 0 0 0; line-height: 1.5;
        }
        .industrial-modal-footer {
          background: #f1f5f9; padding: 20px 30px; display: flex; gap: 15px;
          border-top: 1px solid #e2e8f0;
        }
        .btn-industrial-deny {
          flex: 1; background: #ffffff; color: #e30613; border: 2px solid #e30613;
          padding: 14px; border-radius: 10px; font-weight: 800; font-size: 12px;
          cursor: pointer; transition: 0.2s;
        }
        .btn-industrial-deny:hover { background: #fee2e2; }
        .btn-industrial-allow {
          flex: 1; background: #0f172a; color: #ffffff; border: none;
          padding: 14px; border-radius: 10px; font-weight: 800; font-size: 12px;
          cursor: pointer; transition: 0.2s; border-bottom: 4px solid #000000;
        }
        .btn-industrial-allow:hover { background: #1e293b; transform: translateY(1px); }

        @keyframes modalAppear {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseIcon {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }

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