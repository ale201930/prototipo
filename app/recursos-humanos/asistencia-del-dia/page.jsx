"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  doc, 
  updateDoc,
  setDoc,
  getDoc,
  or
} from "firebase/firestore";

export default function AsistenciaDiariaRRHH() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODAS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS"); 
  const [filtroEstadoClic, setFiltroEstadoClic] = useState("PRESENTES"); 
  
  const [asistencias, setAsistencias] = useState([]);
  const [nominaTotalData, setNominaTotalData] = useState([]); 
  const [areasDisponibles, setAreasDisponibles] = useState([]);
  const [fechaHoyStr, setFechaHoyStr] = useState("");

  const [masterPin, setMasterPin] = useState("1234");
  const [haySolicitudPendiente, setHaySolicitudPendiente] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const configRef = doc(db, "configuracion", "seguridad");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) setMasterPin(docSnap.data().pinMaestro);
    };
    fetchConfig();
  }, []);

  const handleChangeMasterPin = async () => {
    const oldPin = prompt("SEGURIDAD: Ingrese código maestro ACTUAL:");
    if (oldPin !== masterPin) return alert("❌ Código incorrecto.");
    const newPin = prompt("Ingrese NUEVO código:");
    if (!newPin || newPin.length < 4) return alert("❌ Mínimo 4 dígitos.");
    const confirmPin = prompt("Confirme NUEVO código:");
    if (newPin === confirmPin) {
      await setDoc(doc(db, "configuracion", "seguridad"), { pinMaestro: newPin });
      setMasterPin(newPin);
      alert("✅ Sincronizado.");
    }
  };

  const autorizarSalida = async (registroId) => {
    const pin = prompt("AUTORIZACIÓN: Ingrese Código Maestro:");
    if (pin === masterPin) {
      await updateDoc(doc(db, "asistencias", registroId), { 
        solicitudSalida: "APROBADA",
        enPlanta: false, 
        salida: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
      });
      alert("✅ Salida autorizada.");
    } else alert("❌ Código inválido.");
  };

  useEffect(() => {
    setMounted(true);
    setFechaHoyStr(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase());
    
    const unsubscribeNomina = onSnapshot(collection(db, "personal"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const dataFiltrada = data.filter(p => 
        ["INVECEM", "Estudiante INCES", "Estudiante INCESS", "Pasante"].includes(p.tipoPersonal) || 
        p.estatus === "Reposo Médico" || p.estatus === "Vacaciones"
      );
      setNominaTotalData(dataFiltrada);
      setAreasDisponibles(Array.from(new Set(dataFiltrada.map(a => a.area || "No asignado"))).sort());
    });

    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const qAsistencias = query(
      collection(db, "asistencias"),
      or(where("fechaHora", ">=", inicioHoy), where("salida", "==", null)),
      orderBy("fechaHora", "desc")
    );

    const unsubscribeAsist = onSnapshot(qAsistencias, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAsistencias(lista);
      setHaySolicitudPendiente(lista.some(a => a.alertaSalida === "ANTICIPADA" && a.solicitudSalida === "PENDIENTE"));
    });

    return () => { unsubscribeNomina(); unsubscribeAsist(); };
  }, []);

  const obtenerListaFinal = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let base = nominaTotalData.map(p => {
      const registro = asistencias.find(a => a.ficha === p.ficha);
      const fechaFinReposoCalculada = p.fechaFinReposo || p.fechaHasta || p.fechaFin || p.fechafinreposo || p.hasta || registro?.fechaFinReposo || p.fechaRegreso || null;
      const fechaRegresoCalculada = p.fechaRegreso || p.fechaFin || registro?.fechaRegreso || fechaFinReposoCalculada;
      const fechaParaComparar = fechaRegresoCalculada || fechaFinReposoCalculada;
      const esFechaVencida = fechaParaComparar && new Date(fechaParaComparar) <= hoy;

      let estatusFinal = p.estatus;
      if ((p.estatus === "Vacaciones" || p.estatus === "Reposo Médico") && esFechaVencida && !registro) {
        estatusFinal = "Inasistente";
      }

      return { 
        ...p, 
        entrada: registro?.entrada || null, 
        salida: registro?.salida || null, 
        asistioHoy: !!registro, 
        alertaSalida: registro?.alertaSalida || null, 
        solicitudSalida: registro?.solicitudSalida || null, 
        regId: registro?.id || null,
        estatusAsistenciaHoy: registro?.estatus || null, 
        estatus: estatusFinal,
        fechaRegreso: fechaRegresoCalculada,
        fechaFinReposo: fechaFinReposoCalculada
      };
    });

    return base.filter(p => {
      const cumpleTexto = (p.nombres?.toLowerCase() || "").includes(filtro.toLowerCase()) || (p.ficha?.toLowerCase() || "").includes(filtro.toLowerCase());
      const cumpleArea = filtroArea === "TODAS" || (p.area || "No asignado") === filtroArea;
      let cumpleTipo = (filtroTipo === "TODOS") || (filtroTipo === "INVECEM" && p.tipoPersonal === "INVECEM") || (filtroTipo === "INCES" && p.tipoPersonal?.includes("INCES")) || (filtroTipo === "PASANTES" && p.tipoPersonal === "Pasante");
      return cumpleTexto && cumpleArea && cumpleTipo;
    });
  };

  const listaCompleta = obtenerListaFinal();
  
  const resumen = {
    total: listaCompleta.length,
    presentes: listaCompleta.filter(p => p.asistioHoy && !p.salida).length,
    inasistencias: listaCompleta.filter(p => !p.asistioHoy && (p.estatus === "Inasistente" || p.estatus?.includes("Activo") || !p.estatus)).length,
    vacaciones: listaCompleta.filter(p => p.estatus === "Vacaciones").length,
    reposo: listaCompleta.filter(p => p.estatus === "Reposo Médico").length
  };

  const listaFiltradaParaTabla = () => {
    let data = [...listaCompleta];
    if (filtroEstadoClic === "PRESENTES") return data.filter(p => p.asistioHoy && !p.salida); 
    if (filtroEstadoClic === "INASISTENCIAS") return data.filter(p => !p.asistioHoy && (p.estatus === "Inasistente" || p.estatus?.includes("Activo") || !p.estatus));
    if (filtroEstadoClic === "VACACIONES") return data.filter(p => p.estatus === "Vacaciones" || (p.asistioHoy && p.estatusAsistenciaHoy === "BENEFICIO" && p.estatus === "Vacaciones"));
    if (filtroEstadoClic === "REPOSO") return data.filter(p => p.estatus === "Reposo Médico" || (p.asistioHoy && p.estatusAsistenciaHoy === "BENEFICIO" && p.estatus === "Reposo Médico"));
    return data.sort((a, b) => {
        const aEnPlanta = a.asistioHoy && !a.salida;
        const bEnPlanta = b.asistioHoy && !b.salida;
        return aEnPlanta === bEnPlanta ? 0 : aEnPlanta ? -1 : 1;
    });
  };

  const getEstadoEstilo = (reg) => {
    if (reg.asistioHoy && reg.estatusAsistenciaHoy === "BENEFICIO") {
      if (reg.estatus === "Vacaciones") return { texto: "Vacaciones", clase: "vacaciones-status", esBeneficio: true };
      return { texto: "Reposo Médico", clase: "reposo-status", esBeneficio: true };
    }
    if (reg.estatus === "Inasistente") return { texto: "Inasistencia", clase: "falta" };
    if (reg.estatus === "Vacaciones") return { texto: "Vacaciones", clase: "vacaciones-status" };
    if (reg.estatus === "Reposo Médico") return { texto: "Reposo Médico", clase: "reposo-status" };
    if (!reg.asistioHoy) return { texto: "Inasistencia", clase: "falta" };
    if (reg.alertaSalida === "ANTICIPADA" && reg.solicitudSalida === "PENDIENTE") return { texto: "ESPERANDO RRHH", clase: "alerta-blink" };
    if (reg.salida) return { texto: "Finalizado", clase: "terminado" };
    const horaEntrada = reg.entrada;
    const horaEsperada = reg.horaEntrada || "07:00";
    return { texto: horaEntrada <= horaEsperada ? "Puntual" : "Retraso", clase: horaEntrada <= horaEsperada ? "puntual" : "retraso" };
  };

  if (!mounted) return null;

  return (
    <div className="main-wrapper">
      <header className="invecem-header">
        <div className="logo-box">
          SYSTEM-CONTROL<span className="red-text"> INVECEM</span>
        </div>
        <button className="btn-return" onClick={() => router.push("/recursos-humanos")}>VOLVER </button>
      </header>

      <div className="container">
        <div className="nav-actions no-print">
             <button className={`btn-master ${haySolicitudPendiente ? "blink-red" : ""}`} onClick={handleChangeMasterPin}>⚙️ Código Maestro</button>
             <button className="btn-record" onClick={() => router.push("/recursos-humanos/asistencia-del-dia/record-asistencia")}>🏆 Ver Récord</button>
        </div>

        <div className="form-card-invecem">
          <div className="red-accent-bar"></div>
          <header className="form-top-info">
            <div>
              <h1 className={`company-name ${haySolicitudPendiente ? "text-pulse" : ""}`}>Asistencia Diaria</h1>
              <div className="badge-status">Control de Planta</div>
            </div>
            <div className="date-display">{fechaHoyStr}</div>
          </header>

          <div className="filter-tabs no-print">
            {["TODOS", "INVECEM", "INCES", "PASANTES"].map(t => (
              <button key={t} className={filtroTipo === t ? "active" : ""} onClick={() => setFiltroTipo(t)}>{t}</button>
            ))}
          </div>

          <section className="resumen-grid no-print">
            <div className={`card card-presentes ${filtroEstadoClic === "PRESENTES" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("PRESENTES")}>
              <small>EN PLANTA ACTIVOS</small><h2>{resumen.presentes}</h2>
            </div>
            <div className={`card card-inasistencias ${filtroEstadoClic === "INASISTENCIAS" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("INASISTENCIAS")}>
              <small>INASISTENCIAS</small><h2>{resumen.inasistencias}</h2>
            </div>
            <div className={`card card-vacaciones ${filtroEstadoClic === "VACACIONES" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("VACACIONES")}>
              <small>EN VACACIONES</small><h2>{resumen.vacaciones}</h2>
            </div>
            <div className={`card card-reposo ${filtroEstadoClic === "REPOSO" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("REPOSO")}>
              <small>EN REPOSO MÉDICO</small><h2>{resumen.reposo}</h2>
            </div>
            <div className={`card card-total ${filtroEstadoClic === "TODOS" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("TODOS")}>
              <small>TOTAL NÓMINA</small><h2>{resumen.total}</h2>
            </div>
          </section>

          <div className="table-container shadow-relief">
            <div className="table-actions no-print">
              <input type="text" placeholder="Buscar por nombre o ficha..." className="search-input" onChange={(e) => setFiltro(e.target.value)} />
              <select className="area-select" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
                <option value="TODAS">TODAS LAS ÁREAS</option>
                {areasDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button onClick={() => window.print()} className="btn-print">🖨️ Imprimir</button>
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
                  <th className="no-print">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltradaParaTabla().map((reg) => {
                  const est = getEstadoEstilo(reg);
                  return (
                    <tr key={reg.id || reg.ficha} className={reg.solicitudSalida === "PENDIENTE" ? "row-alert" : ""}>
                      <td className="ficha-cell">{reg.ficha || "---"}</td>
                      <td className="nombre-cell">{reg.nombres} {reg.apellidos}</td>
                      <td>
                        <div className="cargo-text">{reg.cargo}</div>
                        <div className="area-text">{reg.area}</div>
                      </td>
                      <td className="hora-cell">{reg.entrada || "--:--"}</td>
                      <td className="hora-cell">{reg.salida || "--:--"}</td>
                      <td>
                        <div className="status-cell-wrapper">
                          <span className={`badge ${est.clase}`}>{est.texto}</span>
                          {est.esBeneficio && <span className="badge-benefit-label">📦 BENEFICIO</span>}
                          {(reg.estatus === "Vacaciones" && reg.fechaRegreso) && <div className="return-date-text">Regresa: <span>{new Date(reg.fechaRegreso).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'})}</span></div>}
                          {(reg.estatus === "Reposo Médico" && reg.fechaFinReposo) && <div className="return-date-text">Hasta: <span>{new Date(reg.fechaFinReposo).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'})}</span></div>}
                        </div>
                      </td>
                      <td className="no-print">
                        {reg.solicitudSalida === "PENDIENTE" && <button className="btn-autorizar" onClick={() => autorizarSalida(reg.regId)}>🔓 AUTORIZAR</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style jsx>{`
        /* --- CABECERA ESTILO PANEL (UNIFICADA) --- */
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

        /* --- MANTENIENDO EL RESTO DE TUS ESTILOS --- */
        .main-wrapper { background-color: #f0f4f8; background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px); background-size: 24px 24px; min-height: 100vh; padding-bottom: 40px; font-family: 'Inter', sans-serif; }
        .container { max-width: 1400px; margin: 0 auto; }
        .nav-actions { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px; }
        .btn-master { background: #334155; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.3s; }
        .btn-record { background: #e30613; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 0px #b8050f; }
        .form-card-invecem { background: rgba(255, 255, 255, 0.98); border-radius: 24px; position: relative; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); padding: 50px; }
        .red-accent-bar { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #e30613, #b8050f); border-radius: 24px 24px 0 0; }
        .company-name { font-size: 38px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -2px; }
        .badge-status { background: #f8fafc; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display: inline-block; border: 1px solid #e2e8f0; margin-top: 8px; }
        .date-display { background: #0f172a; padding: 12px 24px; border-radius: 12px; font-weight: 800; color: white; font-size: 13px; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2); }
        .filter-tabs { display: flex; gap: 10px; margin: 30px 0; }
        .filter-tabs button { background: white; border: 1px solid #e2e8f0; padding: 12px 20px; border-radius: 10px; font-weight: 800; color: #64748b; cursor: pointer; font-size: 11px; }
        .filter-tabs button.active { background: #0f172a; color: white; border-color: #0f172a; }
        .resumen-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px; }
        .card { background: white; padding: 20px; border-radius: 15px; cursor: pointer; transition: 0.3s; border: 1px solid #e2e8f0; }
        .card h2 { font-size: 36px; color: #0f172a; margin: 5px 0 0; font-weight: 900; }
        .card small { font-weight: 900; color: #64748b; font-size: 10px; text-transform: uppercase; }
        .active-card { box-shadow: 0 10px 20px rgba(0,0,0,0.05); transform: scale(1.02); }
        .card-presentes { border-top: 6px solid #22c55e; }
        .card-inasistencias { border-top: 6px solid #ef4444; }
        .card-vacaciones { border-top: 6px solid #3b82f6; }
        .card-reposo { border-top: 6px solid #f59e0b; }
        .card-total { border-top: 6px solid #0f172a; }
        .table-container { background: white; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; }
        .shadow-relief { box-shadow: 10px 10px 0px #e30613; }
        .table-actions { display: flex; gap: 15px; margin-bottom: 20px; }
        .search-input, .area-select { padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; font-weight: 600; flex: 1; }
        .btn-print { background: #e30613; color: white; border: none; padding: 0 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
        .asistencia-table { width: 100%; border-collapse: collapse; }
        .asistencia-table th { text-align: left; padding: 15px; color: #94a3b8; font-size: 11px; border-bottom: 3px solid #f1f5f9; font-weight: 900; }
        .asistencia-table td { padding: 18px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .ficha-cell { font-weight: 900; color: #0f172a; }
        .nombre-cell { font-weight: 700; text-transform: uppercase; color: #1e293b; }
        .cargo-text { font-weight: 800; color: #e30613; font-size: 12px; }
        .area-text { font-weight: 600; color: #94a3b8; font-size: 10px; }
        .hora-cell { font-family: monospace; font-weight: 900; color: #1e293b; font-size: 15px; }
        .badge { padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; display: inline-block; }
        .puntual { background: #22c55e; color: white; }
        .retraso { background: #f59e0b; color: white; }
        .falta { background: #ef4444; color: white; }
        .vacaciones-status { background: #3b82f6; color: white; }
        .reposo-status { background: #f59e0b; color: white; }
        .alerta-blink { background: #e30613; color: white; animation: blink 0.8s infinite; }
        .terminado { background: #0f172a; color: white; }
        .badge-benefit-label { background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 9px; text-transform: uppercase; display: inline-block; margin-top: 3px; letter-spacing: 0.3px; border: 1px solid #cbd5e1; }
        .status-cell-wrapper { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
        .return-date-text { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
        .return-date-text span { color: #0f172a; font-weight: 800; }
        .btn-autorizar { background: #e30613; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 10px; }
        .row-alert { background: #fff1f2; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes text-pulse { 0% { color: #0f172a; } 50% { color: #e30613; } 100% { color: #0f172a; } }
        .text-pulse { animation: text-pulse 1.5s infinite; }
        .blink-red { animation: alert-pulse 1s infinite alternate; }
        @keyframes alert-pulse { from { background: #e30613; } to { background: #0f172a; } }
        @media print { .no-print { display: none !important; } .main-wrapper { background: white; padding: 0; } .shadow-relief { box-shadow: none; border: 1px solid #000; } }
      `}</style>
    </div>
  );
}