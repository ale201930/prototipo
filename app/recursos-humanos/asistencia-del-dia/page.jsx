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
  getDoc
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
  const [resumen, setResumen] = useState({ presentes: 0, inasistencias: 0, vacaciones: 0, reposo: 0, total: 0 });

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
    
    const unsubscribeNomina = onSnapshot(query(collection(db, "personal"), where("tipoPersonal", "in", ["INVECEM", "Estudiante INCES", "Estudiante INCESS", "Pasante"])), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNominaTotalData(data);
      setAreasDisponibles(Array.from(new Set(data.map(a => a.area || "No asignado"))).sort());
    });

    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const unsubscribeAsist = onSnapshot(query(collection(db, "asistencias"), where("fechaHora", ">=", inicioHoy), orderBy("fechaHora", "desc")), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAsistencias(lista);
      setHaySolicitudPendiente(lista.some(a => a.alertaSalida === "ANTICIPADA" && a.solicitudSalida === "PENDIENTE"));
    });

    return () => { unsubscribeNomina(); unsubscribeAsist(); };
  }, []);

  useEffect(() => {
    const fAsistencias = asistencias.filter(a => {
      if (filtroTipo === "INVECEM") return a.tipoPersonal === "INVECEM";
      if (filtroTipo === "INCES") return a.tipoPersonal?.includes("INCES");
      if (filtroTipo === "PASANTES") return a.tipoPersonal === "Pasante";
      return true;
    });
    const nominaFiltrada = nominaTotalData.filter(p => {
      if (filtroTipo === "INVECEM") return p.tipoPersonal === "INVECEM";
      if (filtroTipo === "INCES") return p.tipoPersonal?.includes("INCES");
      if (filtroTipo === "PASANTES") return p.tipoPersonal === "Pasante";
      return true;
    });
    setResumen({
      total: nominaFiltrada.length,
      presentes: fAsistencias.filter(a => !a.salida).length,
      inasistencias: nominaFiltrada.filter(p => (p.estatus?.includes("Activo") || !p.estatus) && !fAsistencias.some(a => a.ficha === p.ficha)).length,
      vacaciones: nominaFiltrada.filter(p => p.estatus === "Vacaciones").length,
      reposo: nominaFiltrada.filter(p => p.estatus === "Reposo Médico").length
    });
  }, [filtroTipo, asistencias, nominaTotalData]);

  const obtenerListaFinal = () => {
    let base = nominaTotalData.map(p => {
      const registro = asistencias.find(a => a.ficha === p.ficha);
      return { ...p, entrada: registro?.entrada || null, salida: registro?.salida || null, asistioHoy: !!registro, alertaSalida: registro?.alertaSalida || null, solicitudSalida: registro?.solicitudSalida || null, regId: registro?.id || null };
    });
    base = base.filter(p => {
      const cumpleTexto = (p.nombres?.toLowerCase() || "").includes(filtro.toLowerCase()) || (p.ficha?.toLowerCase() || "").includes(filtro.toLowerCase());
      const cumpleArea = filtroArea === "TODAS" || (p.area || "No asignado") === filtroArea;
      let cumpleTipo = true;
      if (filtroTipo === "INVECEM") cumpleTipo = p.tipoPersonal === "INVECEM";
      if (filtroTipo === "INCES") cumpleTipo = p.tipoPersonal?.includes("INCES");
      if (filtroTipo === "PASANTES") cumpleTipo = p.tipoPersonal === "Pasante";
      return cumpleTexto && cumpleArea && cumpleTipo;
    });
    if (filtroEstadoClic === "PRESENTES") return base.filter(p => p.asistioHoy);
    if (filtroEstadoClic === "INASISTENCIAS") return base.filter(p => !p.asistioHoy && (p.estatus?.includes("Activo") || !p.estatus));
    if (filtroEstadoClic === "VACACIONES") return base.filter(p => p.estatus === "Vacaciones");
    if (filtroEstadoClic === "REPOSO") return base.filter(p => p.estatus === "Reposo Médico");
    return base;
  };

  const getEstadoEstilo = (reg) => {
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
      <div className="container">
        <div className="nav-header no-print">
          <button className="btn-back-minimal" onClick={() => router.push("/recursos-humanos")}>← Volver al Panel</button>
          <div className="nav-actions">
             <button className={`btn-master ${haySolicitudPendiente ? "blink-red" : ""}`} onClick={handleChangeMasterPin}>⚙️ Código Maestro</button>
             <button className="btn-record" onClick={() => router.push("/recursos-humanos/asistencia-del-dia/record-asistencia")}>🏆 Ver Récord</button>
          </div>
        </div>

        <div className="form-card-invecem">
          <div className="red-accent-bar"></div>
          
          <header className="form-top-info">
            <div>
              <h1 className={`company-name ${haySolicitudPendiente ? "text-pulse" : ""}`}>Asistencia Diaria</h1>
              <div className="badge-status">INVECEM · Control de Planta</div>
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
              <span className="hint">En planta actualmente</span>
            </div>
            <div className={`card card-inasistencias ${filtroEstadoClic === "INASISTENCIAS" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("INASISTENCIAS")}>
              <small>INASISTENCIAS</small><h2>{resumen.inasistencias}</h2>
              <span className="hint">Ver faltas</span>
            </div>
            <div className={`card card-vacaciones ${filtroEstadoClic === "VACACIONES" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("VACACIONES")}>
              <small>EN VACACIONES</small><h2>{resumen.vacaciones}</h2>
              <span className="hint">Ver quiénes</span>
            </div>
            <div className={`card card-reposo ${filtroEstadoClic === "REPOSO" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("REPOSO")}>
              <small>EN REPOSO MÉDICO</small><h2>{resumen.reposo}</h2>
              <span className="hint">Ver quiénes</span>
            </div>
            <div className={`card card-total ${filtroEstadoClic === "TODOS" ? "active-card" : ""}`} onClick={() => setFiltroEstadoClic("TODOS")}>
              <small>TOTAL REGISTROS</small><h2>{asistencias.length}</h2>
              <span className="hint">Asistencias totales hoy</span>
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
                {obtenerListaFinal().map((reg) => {
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
                        <span className={`badge ${est.clase}`}>{est.texto}</span>
                      </td>
                      <td className="no-print">
                        {reg.solicitudSalida === "PENDIENTE" && (
                          <button className="btn-autorizar" onClick={() => autorizarSalida(reg.regId)}>🔓 AUTORIZAR</button>
                        )}
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
        .main-wrapper { 
          background-color: #f0f4f8;
          background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px);
          background-size: 24px 24px;
          min-height: 100vh; padding: 40px 20px; font-family: 'Inter', sans-serif;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        .nav-header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }
        .btn-back-minimal { background: white; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 10px; font-weight: 800; color: #64748b; cursor: pointer; transition: 0.3s; }
        .btn-back-minimal:hover { color: #e30613; transform: translateX(-5px); }
        .nav-actions { display: flex; gap: 10px; }
        
        .btn-master { background: #334155; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.3s; }
        
        /* BOTÓN RÉCORD CORREGIDO (ROJO INVECEM) */
        .btn-record { 
          background: #e30613; 
          color: white; 
          border: none; 
          padding: 10px 18px; 
          border-radius: 8px; 
          font-weight: 800; 
          cursor: pointer; 
          transition: 0.3s;
          box-shadow: 0 4px 0px #b8050f;
        }
        .btn-record:hover { background: #b8050f; transform: translateY(2px); box-shadow: 0 2px 0px #8a040b; }

        .form-card-invecem { 
          background: rgba(255, 255, 255, 0.98); border-radius: 24px; position: relative; 
          border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); padding: 50px; 
        }
        .red-accent-bar { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #e30613, #b8050f); }

        .company-name { font-size: 38px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -2px; }
        .badge-status { background: #f8fafc; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display: inline-block; border: 1px solid #e2e8f0; margin-top: 8px; }
        .date-display { background: #0f172a; padding: 12px 24px; border-radius: 12px; font-weight: 800; color: white; font-size: 13px; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2); }

        .filter-tabs { display: flex; gap: 10px; margin: 30px 0; }
        .filter-tabs button { background: white; border: 1px solid #e2e8f0; padding: 12px 20px; border-radius: 10px; font-weight: 800; color: #64748b; cursor: pointer; font-size: 11px; }
        .filter-tabs button.active { background: #0f172a; color: white; border-color: #0f172a; }

        .resumen-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px; }
        .card { background: white; padding: 20px; border-radius: 15px; cursor: pointer; transition: 0.3s; border: 1px solid #e2e8f0; }
        .card:hover { transform: translateY(-5px); }
        .card h2 { font-size: 36px; color: #0f172a; margin: 5px 0 0; font-weight: 900; }
        .card small { font-weight: 900; color: #64748b; font-size: 10px; text-transform: uppercase; }
        .active-card { box-shadow: 0 10px 20px rgba(0,0,0,0.05); transform: scale(1.02); }
        .hint { font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-top: 10px; }

        /* Bordes Superiores Gruesos Estilo Original */
        .card-presentes { border-top: 6px solid #22c55e; }
        .card-inasistencias { border-top: 6px solid #ef4444; }
        .card-vacaciones { border-top: 6px solid #3b82f6; }
        .card-reposo { border-top: 6px solid #f59e0b; }
        .card-total { border-top: 6px solid #0f172a; }

        .table-container { background: white; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; }
        
        /* SOMBRA RELEVO CORREGIDA (AHORA ES ROJA PARA COMBINAR) */
        .shadow-relief { box-shadow: 10px 10px 0px #e30613; }

        .table-actions { display: flex; gap: 15px; margin-bottom: 20px; }
        .search-input, .area-select { padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; font-weight: 600; flex: 1; }
        .btn-print { background: #e30613; color: white; border: none; padding: 0 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }

        .asistencia-table { width: 100%; border-collapse: collapse; }
        .asistencia-table th { text-align: left; padding: 15px; color: #94a3b8; font-size: 11px; border-bottom: 3px solid #f1f5f9; font-weight: 900; }
        .asistencia-table td { padding: 18px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .ficha-cell { font-weight: 900; color: #0f172a; }
        .nombre-cell { font-weight: 700; text-transform: uppercase; color: #1e293b; }
        .cargo-text { font-weight: 800; color: #e30613; font-size: 12px; } /* Texto de cargo ahora en rojo */
        .area-text { font-weight: 600; color: #94a3b8; font-size: 10px; }
        .hora-cell { font-family: monospace; font-weight: 900; color: #1e293b; font-size: 15px; }

        /* Badges Sólidos Estilo Original */
        .badge { padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; display: inline-block; }
        .puntual { background: #22c55e; color: white; }
        .retraso { background: #f59e0b; color: white; }
        .falta { background: #ef4444; color: white; }
        .vacaciones-status { background: #3b82f6; color: white; }
        .reposo-status { background: #f59e0b; color: white; }
        .alerta-blink { background: #e30613; color: white; animation: blink 0.8s infinite; }
        .terminado { background: #0f172a; color: white; }

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