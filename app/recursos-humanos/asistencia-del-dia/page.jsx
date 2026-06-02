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

  // FunciÃ³n auxiliar para formatear fechas sin error de zona horaria
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    const fetchConfig = async () => {
      const configRef = doc(db, "configuracion", "seguridad");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) setMasterPin(docSnap.data().pinMaestro);
    };
    fetchConfig();
  }, []);

  const handleChangeMasterPin = async () => {
    const oldPin = prompt("SEGURIDAD: Ingrese cÃ³digo maestro ACTUAL:");
    if (oldPin !== masterPin) return alert("âŒ CÃ³digo incorrecto.");
    const newPin = prompt("Ingrese NUEVO cÃ³digo:");
    if (!newPin || newPin.length < 4) return alert("âŒ MÃ­nimo 4 dÃ­gitos.");
    const confirmPin = prompt("Confirme NUEVO cÃ³digo:");
    if (newPin === confirmPin) {
      await setDoc(doc(db, "configuracion", "seguridad"), { pinMaestro: newPin });
      setMasterPin(newPin);
      alert("âœ… Sincronizado.");
    }
  };

  const autorizarSalida = async (registroId) => {
    const pin = prompt("AUTORIZACIÃ“N: Ingrese CÃ³digo Maestro:");
    if (pin === masterPin) {
      await updateDoc(doc(db, "asistencias", registroId), { 
        solicitudSalida: "APROBADA",
        enPlanta: false, 
        salida: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
      });
      alert("âœ… Salida autorizada.");
    } else alert("âŒ CÃ³digo invÃ¡lido.");
  };

  useEffect(() => {
    setMounted(true);
    setFechaHoyStr(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase());
    
    const unsubscribeNomina = onSnapshot(collection(db, "personal"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const dataFiltrada = data.filter(p => 
        ["INVECEM", "Estudiante INCES", "Estudiante INCESS", "Pasante"].includes(p.tipoPersonal) || 
        p.estatus === "Reposo MÃ©dico" || p.estatus === "Vacaciones"
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
      if ((p.estatus === "Vacaciones" || p.estatus === "Reposo MÃ©dico") && esFechaVencida && !registro) {
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
    reposo: listaCompleta.filter(p => p.estatus === "Reposo MÃ©dico").length
  };

  const listaFiltradaParaTabla = () => {
    let data = [...listaCompleta];
    if (filtroEstadoClic === "PRESENTES") return data.filter(p => p.asistioHoy && !p.salida); 
    if (filtroEstadoClic === "INASISTENCIAS") return data.filter(p => !p.asistioHoy && (p.estatus === "Inasistente" || p.estatus?.includes("Activo") || !p.estatus));
    if (filtroEstadoClic === "VACACIONES") return data.filter(p => p.estatus === "Vacaciones" || (p.asistioHoy && p.estatusAsistenciaHoy === "BENEFICIO" && p.estatus === "Vacaciones"));
    if (filtroEstadoClic === "REPOSO") return data.filter(p => p.estatus === "Reposo MÃ©dico" || (p.asistioHoy && p.estatusAsistenciaHoy === "BENEFICIO" && p.estatus === "Reposo MÃ©dico"));
    return data.sort((a, b) => {
        const aEnPlanta = a.asistioHoy && !a.salida;
        const bEnPlanta = b.asistioHoy && !b.salida;
        return aEnPlanta === bEnPlanta ? 0 : aEnPlanta ? -1 : 1;
    });
  };

  const getEstadoEstilo = (reg) => {
    if (reg.asistioHoy && reg.estatusAsistenciaHoy === "BENEFICIO") {
      if (reg.estatus === "Vacaciones") return { texto: "Vacaciones", clase: "bg-cyan-50 text-cyan-600 border-cyan-200", esBeneficio: true };
      return { texto: "Reposo MÃ©dico", clase: "bg-amber-50 text-amber-600 border-amber-200", esBeneficio: true };
    }
    if (reg.estatus === "Inasistente") return { texto: "Inasistencia", clase: "bg-red-50 text-red-600 border-red-200" };
    if (reg.estatus === "Vacaciones") return { texto: "Vacaciones", clase: "bg-cyan-50 text-cyan-600 border-cyan-200" };
    if (reg.estatus === "Reposo MÃ©dico") return { texto: "Reposo MÃ©dico", clase: "bg-amber-50 text-amber-600 border-amber-200" };
    if (!reg.asistioHoy) return { texto: "Inasistencia", clase: "bg-red-50 text-red-600 border-red-200" };
    if (reg.alertaSalida === "ANTICIPADA" && reg.solicitudSalida === "PENDIENTE") return { texto: "ESPERANDO RRHH", clase: "bg-red-100 text-red-650 border-red-300 animate-pulse" };
    if (reg.salida) return { texto: "Finalizado", clase: "bg-slate-100 text-slate-500 border-slate-200" };
    const horaEntrada = reg.entrada;
    const horaEsperada = reg.horaEntrada || "07:00";
    return { 
      texto: horaEntrada <= horaEsperada ? "Puntual" : "Retraso", 
      clase: horaEntrada <= horaEsperada ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-orange-50 text-orange-600 border-orange-200" 
    };
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
        <div className="flex gap-2">
          <button 
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-sm"
            onClick={handleChangeMasterPin}
            title="Sincronizar cÃ³digo maestro de seguridad"
          >
            <i className="fas fa-key text-cyan-500"></i> PIN Maestro
          </button>
          <button 
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
            onClick={() => router.push("/recursos-humanos")}
          >
            <i className="fas fa-arrow-left mr-2"></i> Volver
          </button>
        </div>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">
        
        {/* NAV ACCIONES SECUNDARIAS */}
        <div className="flex justify-end mb-6 print:hidden">
          <button 
            className="px-5 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 flex items-center gap-2 cursor-pointer"
            onClick={() => router.push("/recursos-humanos/asistencia-del-dia/record-asistencia")}
          >
            <i className="fas fa-calendar-alt"></i> Ver RÃ©cord HistÃ³rico
          </button>
        </div>

        {/* TARJETA DE CONTROL PRINCIPAL */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/20 text-slate-800 relative shadow-neon-cyan">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          {/* HEADER INTERNO */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200/60 pb-6">
            <div>
              <h1 className={`text-3xl font-black tracking-tight text-indigo-950 uppercase flex items-center gap-3 ${haySolicitudPendiente ? "animate-pulse text-red-600" : ""}`}>
                <i className="fas fa-clock text-cyan-500"></i> Asistencia Diaria
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                Monitoreo operacional y control de permanencia del personal en planta
              </p>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black tracking-wider text-cyan-600 uppercase font-mono">
              {fechaHoyStr}
            </div>
          </header>

          {/* TABS DE TIPO DE PERSONAL */}
          <div className="flex flex-wrap gap-2 mb-8 print:hidden">
            {["TODOS", "INVECEM", "INCES", "PASANTES"].map(t => (
              <button 
                key={t} 
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer ${filtroTipo === t ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white border-transparent shadow-md shadow-indigo-500/20" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                onClick={() => setFiltroTipo(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* INDICADORES / SUMMARY CARDS */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 print:hidden">
            
            <div 
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${filtroEstadoClic === "PRESENTES" ? "bg-cyan-500/5 border-cyan-500/40 shadow-neon-cyan" : "bg-white border-slate-200 hover:border-slate-300"}`}
              onClick={() => setFiltroEstadoClic("PRESENTES")}
            >
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">En Planta</span>
              <h2 className="text-3xl font-black text-indigo-950">{resumen.presentes}</h2>
              <div className="absolute right-3 bottom-3 text-cyan-600/10 text-3xl group-hover:text-cyan-600/20 transition-all">
                <i className="fas fa-sign-in-alt"></i>
              </div>
            </div>

            <div 
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${filtroEstadoClic === "INASISTENCIAS" ? "bg-red-500/5 border-red-500/40 shadow-neon-red" : "bg-white border-slate-200 hover:border-slate-300"}`}
              onClick={() => setFiltroEstadoClic("INASISTENCIAS")}
            >
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">Inasistencias</span>
              <h2 className="text-3xl font-black text-red-600">{resumen.inasistencias}</h2>
              <div className="absolute right-3 bottom-3 text-red-600/10 text-3xl group-hover:text-red-600/20 transition-all">
                <i className="fas fa-user-times"></i>
              </div>
            </div>

            <div 
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${filtroEstadoClic === "VACACIONES" ? "bg-purple-500/5 border-purple-500/40 shadow-neon-purple" : "bg-white border-slate-200 hover:border-slate-300"}`}
              onClick={() => setFiltroEstadoClic("VACACIONES")}
            >
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">Vacaciones</span>
              <h2 className="text-3xl font-black text-purple-600">{resumen.vacaciones}</h2>
              <div className="absolute right-3 bottom-3 text-purple-600/10 text-3xl group-hover:text-purple-600/20 transition-all">
                <i className="fas fa-umbrella-beach"></i>
              </div>
            </div>

            <div 
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${filtroEstadoClic === "REPOSO" ? "bg-amber-500/5 border-amber-500/40 shadow-neon-amber" : "bg-white border-slate-200 hover:border-slate-300"}`}
              onClick={() => setFiltroEstadoClic("REPOSO")}
            >
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">Reposo MÃ©dico</span>
              <h2 className="text-3xl font-black text-amber-600">{resumen.reposo}</h2>
              <div className="absolute right-3 bottom-3 text-amber-600/10 text-3xl group-hover:text-amber-600/20 transition-all">
                <i className="fas fa-medkit"></i>
              </div>
            </div>

            <div 
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${filtroEstadoClic === "TODOS" ? "bg-indigo-500/5 border-indigo-500/40 shadow-neon-indigo" : "bg-white border-slate-200 hover:border-slate-300"}`}
              onClick={() => setFiltroEstadoClic("TODOS")}
            >
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">Total NÃ³mina</span>
              <h2 className="text-3xl font-black text-slate-900">{resumen.total}</h2>
              <div className="absolute right-3 bottom-3 text-indigo-500/10 text-3xl group-hover:text-indigo-500/20 transition-all">
                <i className="fas fa-clipboard-list"></i>
              </div>
            </div>

          </section>

          {/* PANEL DE CONTROL DE TABLA */}
          <div className="p-4 bg-white/90 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-md print:hidden">
            <div className="relative w-full md:flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <i className="fas fa-search"></i>
              </span>
              <input 
                type="text" 
                placeholder="Buscar por Nombre, Ficha o CÃ©dula..." 
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold"
              />
            </div>
            
            <div className="flex w-full md:w-auto gap-3">
              <select 
                value={filtroArea} 
                onChange={(e) => setFiltroArea(e.target.value)}
                className="w-full md:w-56 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer uppercase"
              >
                <option value="TODAS">Todas las Ã¡reas</option>
                {areasDisponibles.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <button 
                onClick={() => window.print()}
                className="px-5 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>

          {/* TABLA PRINCIPAL DE ASISTENCIAS */}
          <div className="overflow-x-auto w-full no-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center w-24 font-mono">FICHA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">COLABORADOR</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÃREA / CARGO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ENTRADA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">SALIDA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center print:hidden font-mono">ACCIÃ“N</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltradaParaTabla().length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 font-bold italic text-sm font-mono">
                      Sin registros encontrados
                    </td>
                  </tr>
                ) : (
                  listaFiltradaParaTabla().map((reg) => {
                    const est = getEstadoEstilo(reg);
                    const isPending = reg.solicitudSalida === "PENDIENTE";

                    return (
                      <tr 
                        key={reg.id || reg.ficha} 
                        className={`border-b border-slate-100/60 hover:bg-slate-50/50 transition-all ${isPending ? "bg-red-500/5 animate-pulse-glow" : ""}`}
                      >
                        <td className="py-4 px-3 text-center font-black text-cyan-600 text-sm font-mono">
                          {reg.ficha || "---"}
                        </td>
                        <td className="py-4 px-3 text-left font-extrabold text-indigo-950 text-sm uppercase">
                          {reg.nombres} {reg.apellidos}
                        </td>
                        <td className="py-4 px-3 text-left">
                          <div className="font-extrabold text-cyan-700 text-xs uppercase">{reg.cargo}</div>
                          <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">{reg.area}</div>
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                          {reg.entrada ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <i className="fas fa-sign-in-alt text-emerald-600 text-xs"></i> {reg.entrada}
                            </span>
                          ) : (
                            <span className="text-slate-400">--:--</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                          {reg.salida ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <i className="fas fa-sign-out-alt text-red-500 text-xs"></i> {reg.salida}
                            </span>
                          ) : (
                            <span className="text-slate-400">--:--</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${est.clase}`}>
                              {est.texto}
                            </span>
                            {est.esBeneficio && (
                              <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 rounded text-[9px] font-black tracking-widest uppercase font-mono">
                                BENEFICIO
                              </span>
                            )}
                            {(reg.estatus === "Vacaciones" && reg.fechaRegreso) && (
                              <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 font-mono">
                                Regresa: <span className="text-cyan-600 font-black">{formatDate(reg.fechaRegreso)}</span>
                              </div>
                            )}
                            {(reg.estatus === "Reposo MÃ©dico" && reg.fechaFinReposo) && (
                              <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 font-mono">
                                Hasta: <span className="text-amber-600 font-black">{formatDate(reg.fechaFinReposo)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center print:hidden">
                          {isPending ? (
                            <button 
                              className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-red-550 hover:from-red-500 hover:to-red-500 active:scale-90 text-white text-xxs font-black tracking-wider uppercase rounded-lg shadow-md shadow-red-600/20 hover:shadow-neon-red transition-all duration-200 flex items-center gap-1.5 mx-auto cursor-pointer"
                              onClick={() => autorizarSalida(reg.regId)}
                            >
                              <i className="fas fa-unlock"></i> Autorizar
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

