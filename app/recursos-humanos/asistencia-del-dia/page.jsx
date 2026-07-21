"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, registrarAccion } from "@/app/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  or
} from "firebase/firestore";

export default function AsistenciaDiariaRRHH() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODAS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroEstadoClic, setFiltroEstadoClic] = useState("PRESENTES");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 30;

  const [asistencias, setAsistencias] = useState([]);
  const [nominaTotalData, setNominaTotalData] = useState([]);
  const [areasDisponibles, setAreasDisponibles] = useState([]);
  const [fechaHoyStr, setFechaHoyStr] = useState("");

  const [feriados, setFeriados] = useState([]);

  const [haySolicitudPendiente, setHaySolicitudPendiente] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [registroIdConfirmar, setRegistroIdConfirmar] = useState(null);

  // Función auxiliar para formatear fechas sin error de zona horaria
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const autorizarSalida = (registroId) => {
    setRegistroIdConfirmar(registroId);
    setShowConfirmModal(true);
  };

  const ejecutarAutorizarSalida = async () => {
    if (!registroIdConfirmar) return;
    try {
      const record = asistencias.find(a => a.id === registroIdConfirmar);
      const nombreEmpleado = record ? record.nombreCompleto : registroIdConfirmar;
      await updateDoc(doc(db, "asistencias", registroIdConfirmar), {
        solicitudSalida: "APROBADA",
        enPlanta: false,
        salida: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      });
      registrarAccion(
        null, 
        null, 
        `Salida anticipada autorizada para ${nombreEmpleado}`, 
        "Control de Asistencia"
      );
      alert("✅ Salida autorizada.");
    } catch (error) {
      console.error("Error al autorizar salida:", error);
    }
    setShowConfirmModal(false);
    setRegistroIdConfirmar(null);
  };

  useEffect(() => {
    setMounted(true);
    setFechaHoyStr(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase());

    const unsubscribeNomina = onSnapshot(collection(db, "personal"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const dataFiltrada = data.filter(p => {
        // Excluir personal inactivo
        if (p.estatus === "Inactivo") return false;

        // Excluir pasantes cuya pasantía haya culminado
        if (p.tipoPersonal === "Pasante" && p.fechaEgreso) {
          const [anio, mes, dia] = p.fechaEgreso.split("-").map(Number);
          const fechaCulminacion = new Date(anio, mes - 1, dia, 23, 59, 59, 999);
          if (hoy > fechaCulminacion) return false;
        }

        const tUpper = (p.tipoPersonal || "").toUpperCase().trim();
        return tUpper.includes("INVECEM") || tUpper.includes("INCES") || tUpper.includes("PASANTE") || !p.tipoPersonal;
      });
      setNominaTotalData(dataFiltrada);
      setAreasDisponibles(Array.from(new Set(dataFiltrada.map(a => a.area || "No asignado"))).sort());
    });

    const unsubscribeFeriados = onSnapshot(collection(db, "feriados"), (snapshot) => {
      setFeriados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    return () => { unsubscribeNomina(); unsubscribeAsist(); unsubscribeFeriados(); };
  }, []);

  // Reiniciar paginación al cambiar filtros de búsqueda o categoría
  useEffect(() => {
    setPaginaActual(1);
  }, [filtro, filtroArea, filtroTipo, filtroEstadoClic]);

  const obtenerListaFinal = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let base = nominaTotalData.map(p => {
      const registro = asistencias.find(a => 
        (a.ficha && p.ficha && a.ficha.trim() === p.ficha.trim()) || 
        (a.cedula && p.cedula && a.cedula.trim() === p.cedula.trim()) ||
        (a.cedula && p.cedula && a.cedula.replace(/\D/g, "") === p.cedula.replace(/\D/g, ""))
      );
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
        fechaFinReposo: fechaFinReposoCalculada,
        salidaAlmuerzo: registro?.salidaAlmuerzo || null,
        entradaAlmuerzo: registro?.entradaAlmuerzo || null,
        minutosAlmuerzoTarde: registro?.minutosAlmuerzoTarde || null,
        observacionAcceso: registro?.observacionAcceso || null,
        tipoSalida: registro?.tipoSalida || null
      };
    });

    return base.filter(p => {
      const cumpleTexto = (p.nombres?.toLowerCase() || "").includes(filtro.toLowerCase()) || (p.ficha?.toLowerCase() || "").includes(filtro.toLowerCase());
      const cumpleArea = filtroArea === "TODAS" || (p.area || "No asignado") === filtroArea;
      const pTipoUpper = (p.tipoPersonal || "").toUpperCase();
      let cumpleTipo = (filtroTipo === "TODOS") || 
        (filtroTipo === "INVECEM" && (pTipoUpper === "INVECEM" || !p.tipoPersonal)) || 
        (filtroTipo.includes("INCES") && pTipoUpper.includes("INCES")) || 
        (filtroTipo.includes("PASANTE") && pTipoUpper.includes("PASANTE"));
      return cumpleTexto && cumpleArea && cumpleTipo;
    });
  };

  const getFeriadoHoy = () => {
    const localHoy = new Date();
    const dClean = new Date(localHoy.getFullYear(), localHoy.getMonth(), localHoy.getDate());

    const parseLocalDate = (dateStr) => {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    };

    return feriados.find(f => {
      if (!f.fechaInicio || !f.fechaRegreso) return false;
      const start = parseLocalDate(f.fechaInicio);
      const end = parseLocalDate(f.fechaRegreso);
      return start && end && dClean >= start && dClean < end;
    });
  };
  const feriadoHoy = getFeriadoHoy();
  const esFeriadoExento = (p) => feriadoHoy && (feriadoHoy.tipo === "TODOS" || (feriadoHoy.tipo === "PARCIAL" && feriadoHoy.trabajadoresLibran?.includes(p.id)));

  const listaCompleta = obtenerListaFinal();

  const resumen = {
    total: listaCompleta.length,
    presentes: listaCompleta.filter(p => p.asistioHoy && !p.salida && !(p.salidaAlmuerzo && !p.entradaAlmuerzo) && p.estatusAsistenciaHoy !== "ABANDONO DE TRABAJO").length,
    inasistencias: listaCompleta.filter(p => {
      if (p.asistioHoy) return false;
      if (esFeriadoExento(p)) return false;
      return (p.estatus === "Inasistente" || p.estatus?.includes("Activo") || !p.estatus);
    }).length,
    vacaciones: listaCompleta.filter(p => p.estatus === "Vacaciones").length,
    reposo: listaCompleta.filter(p => p.estatus === "Reposo Médico").length
  };

  const listaFiltradaParaTabla = () => {
    let data = [...listaCompleta];
    if (filtroEstadoClic === "PRESENTES") return data.filter(p => p.asistioHoy && !p.salida && !(p.salidaAlmuerzo && !p.entradaAlmuerzo) && p.estatusAsistenciaHoy !== "ABANDONO DE TRABAJO");
    if (filtroEstadoClic === "INASISTENCIAS") return data.filter(p => !p.asistioHoy && !esFeriadoExento(p) && (p.estatus === "Inasistente" || p.estatus?.includes("Activo") || !p.estatus));
    if (filtroEstadoClic === "VACACIONES") return data.filter(p => p.estatus === "Vacaciones" || (p.asistioHoy && p.estatusAsistenciaHoy === "BENEFICIO" && p.estatus === "Vacaciones"));
    if (filtroEstadoClic === "REPOSO") return data.filter(p => p.estatus === "Reposo Médico" || (p.asistioHoy && p.estatusAsistenciaHoy === "BENEFICIO" && p.estatus === "Reposo Médico"));
    return data.sort((a, b) => {
      const aEnPlanta = a.asistioHoy && !a.salida && !(a.salidaAlmuerzo && !a.entradaAlmuerzo) && a.estatusAsistenciaHoy !== "ABANDONO DE TRABAJO";
      const bEnPlanta = b.asistioHoy && !b.salida && !(b.salidaAlmuerzo && !b.entradaAlmuerzo) && b.estatusAsistenciaHoy !== "ABANDONO DE TRABAJO";
      return aEnPlanta === bEnPlanta ? 0 : aEnPlanta ? -1 : 1;
    });
  };

  const getEstadoEstilo = (reg) => {
    if (reg.asistioHoy && reg.estatusAsistenciaHoy === "ABANDONO DE TRABAJO") {
      return { texto: "Abandono", clase: "bg-red-100 text-red-750 border-red-300 font-black animate-pulse" };
    }
    if (reg.asistioHoy && reg.estatusAsistenciaHoy === "BENEFICIO") {
      if (reg.estatus === "Vacaciones") return { texto: "Vacaciones", clase: "bg-cyan-50 text-cyan-600 border-cyan-200", esBeneficio: true };
      return { texto: "Reposo Médico", clase: "bg-amber-50 text-amber-600 border-amber-200", esBeneficio: true };
    }
    if (reg.estatus === "Vacaciones") return { texto: "Vacaciones", clase: "bg-cyan-50 text-cyan-600 border-cyan-200" };
    if (reg.estatus === "Reposo Médico") return { texto: "Reposo Médico", clase: "bg-amber-50 text-amber-600 border-amber-200" };
    if (!reg.asistioHoy && esFeriadoExento(reg)) {
      return { texto: "Libró (Feriado)", clase: "bg-emerald-50 text-emerald-600 border-emerald-200 font-bold" };
    }
    if (reg.estatus === "Inasistente") return { texto: "Inasistencia", clase: "bg-red-50 text-red-600 border-red-200" };
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

      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)" }}><i className="fas fa-fingerprint text-white" style={{ fontSize: "11px" }}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <div className="flex gap-2">
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

        {/* ENCABEZADO DE IMPRESIÓN */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6 w-full">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo Invecem" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-black uppercase text-indigo-955 tracking-tight">INVECEM</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Asistencia Diaria - Recursos Humanos</p>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-slate-500">
            <div>Fecha: {fechaHoyStr}</div>
            <div>Tipo: Asistencia General</div>
          </div>
        </div>

        {/* NAV ACCIONES SECUNDARIAS */}
        <div className="flex justify-end mb-6 print:hidden">
          <button
            className="px-5 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 flex items-center gap-2 cursor-pointer"
            onClick={() => router.push("/recursos-humanos/asistencia-del-dia/record-asistencia")}
          >
            <i className="fas fa-calendar-alt"></i> Ver Récord Histórico
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
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200/60 pb-6 print:hidden">
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
            {["TODOS", "INVECEM", "ESTUDIANTES INCES", "PASANTES"].map(t => (
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
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">Reposo Médico</span>
              <h2 className="text-3xl font-black text-amber-600">{resumen.reposo}</h2>
              <div className="absolute right-3 bottom-3 text-amber-600/10 text-3xl group-hover:text-amber-600/20 transition-all">
                <i className="fas fa-medkit"></i>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${filtroEstadoClic === "TODOS" ? "bg-indigo-500/5 border-indigo-500/40 shadow-neon-indigo" : "bg-white border-slate-200 hover:border-slate-300"}`}
              onClick={() => setFiltroEstadoClic("TODOS")}
            >
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest">Total Nómina</span>
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
                placeholder="Buscar por Nombre, Ficha o Cédula..."
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
                <option value="TODAS">Todas las áreas</option>
                {areasDisponibles.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <button
                onClick={() => window.print()}
                className="px-5 py-3 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-600 hover:text-red-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÁREA / CARGO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ENTRADA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">SALIDA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center print:hidden font-mono">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const listadoCompleto = listaFiltradaParaTabla();
                  if (listadoCompleto.length === 0) {
                    return (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-400 font-bold italic text-sm font-mono">
                          Sin registros encontrados
                        </td>
                      </tr>
                    );
                  }

                  const totalPaginas = Math.ceil(listadoCompleto.length / itemsPorPagina) || 1;
                  const indexInicio = (paginaActual - 1) * itemsPorPagina;
                  const indexFin = paginaActual * itemsPorPagina;
                  const itemsPaginados = listadoCompleto.slice(indexInicio, indexFin);

                  return itemsPaginados.map((reg) => {
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
                        <td className="py-4 px-3 text-left">
                          <strong className="text-sm font-extrabold text-indigo-950 uppercase block">{reg.nombres} {reg.apellidos}</strong>
                          {reg.observacionAcceso && reg.tipoSalida === "ANTICIPADA" && (
                            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                              <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-[9px] font-black uppercase tracking-wider font-mono animate-pulse">
                                🚨 Salida Anticipada: {reg.observacionAcceso}
                              </span>
                            </div>
                          )}
                          {reg.salidaAlmuerzo && (
                            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                                🍱 Almuerzo: {reg.salidaAlmuerzo} a {reg.entradaAlmuerzo || "--:--"}
                              </span>
                              {reg.minutosAlmuerzoTarde > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-650 rounded text-[9px] font-black uppercase tracking-wider font-mono animate-pulse">
                                  ⚠️ Demora: +{reg.minutosAlmuerzoTarde}m
                                </span>
                              )}
                              {reg.salidaAlmuerzo && !reg.entradaAlmuerzo && !reg.salida && (
                                <span className="px-1.5 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-600 text-[9px] font-black uppercase tracking-wider font-mono">
                                  ⏳ Almorzando
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-3 text-left">
                          {reg.tipoPersonal === "Pasante" ? (
                            <>
                              <div className="font-extrabold text-cyan-700 text-xs uppercase">{reg.carreraPasante || "Pasante"}</div>
                              <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">{reg.universidadPasante || "Sin Universidad"}</div>
                              {reg.fechaEgreso && (
                                <div className="text-[10px] font-bold text-amber-600 uppercase mt-1 font-mono">
                                  Culmina: <span className="font-black">{reg.fechaEgreso.split("-").reverse().join("/")}</span>
                                </div>
                              )}
                            </>
                          ) : (reg.tipoPersonal && reg.tipoPersonal.toUpperCase().includes("INCES")) ? (
                            <>
                              <div className="font-extrabold text-cyan-700 text-xs uppercase">{reg.programaInces || "Estudiante INCES"}</div>
                              <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">Cohorte: {reg.cohorteInces || "Sin Cohorte"}</div>
                            </>
                          ) : (
                            <>
                              <div className="font-extrabold text-cyan-700 text-xs uppercase">{reg.cargo || "Sin cargo asignado"}</div>
                              <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">{reg.area || "Sin área asignada"}</div>
                            </>
                          )}
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
                            {(reg.estatus === "Reposo Médico" && reg.fechaFinReposo) && (
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
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {(() => {
            const listadoCompleto = listaFiltradaParaTabla();
            if (listadoCompleto.length <= itemsPorPagina) return null;
            const totalPaginas = Math.ceil(listadoCompleto.length / itemsPorPagina) || 1;

            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/60 print:hidden">
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest font-mono">
                  Mostrando {((paginaActual - 1) * itemsPorPagina) + 1} - {Math.min(paginaActual * itemsPorPagina, listadoCompleto.length)} de {listadoCompleto.length} colaboradores
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                    disabled={paginaActual === 1}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <i className="fas fa-chevron-left text-cyan-500"></i> Anterior
                  </button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(pag => pag === 1 || pag === totalPaginas || Math.abs(pag - paginaActual) <= 1)
                    .map((pag, index, arr) => {
                      const showEllipsis = index > 0 && pag - arr[index - 1] > 1;
                      return (
                        <React.Fragment key={pag}>
                          {showEllipsis && <span className="text-slate-400 font-bold self-center px-1">...</span>}
                          <button
                            onClick={() => setPaginaActual(pag)}
                            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xxs font-black transition-all cursor-pointer ${
                              paginaActual === pag
                                ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow shadow-cyan-500/20'
                                : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-650'
                            }`}
                          >
                            {pag}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  <button
                    onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    Siguiente <i className="fas fa-chevron-right text-cyan-500"></i>
                  </button>
                </div>
              </div>
            );
          })()}

        </div>

        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in no-print">
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative shadow-neon-cyan/20 text-slate-800">
              {/* Tech Corners */}
              <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-cyan-600"></i> Confirmar Autorización
              </h2>
              <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                ¿Está seguro de autorizar la salida de este colaborador de las instalaciones?
              </p>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  onClick={() => { setShowConfirmModal(false); setRegistroIdConfirmar(null); }}
                >
                  Cancelar
                </button>
                <button
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer hover:shadow-neon-cyan"
                  onClick={ejecutarAutorizarSalida}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

