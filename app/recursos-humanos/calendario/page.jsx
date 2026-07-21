"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db, registrarAccion } from "@/app/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc
} from "firebase/firestore";

export default function CalendarioFeriados() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Selector de duración: "UN_DIA" o "RANGO"
  const [duracion, setDuracion] = useState("UN_DIA");

  // Form states (date range)
  const [fechaUnica, setFechaUnica] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaRegreso, setFechaRegreso] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("TODOS");
  const [trabajadoresLibran, setTrabajadoresLibran] = useState([]);

  // Modal de Personal Asignado a Feriado
  const [modalPersonalFeriado, setModalPersonalFeriado] = useState(null);
  const [pagModal, setPagModal] = useState(1);
  const [busquedaModal, setBusquedaModal] = useState("");
  const itemsPorPaginaModal = 10;

  // Filter states
  const [busqueda, setBusqueda] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODAS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");

  // Database states
  const [personal, setPersonal] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals / Alerts
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    feriadoId: null,
    nombreFeriado: "",
    fechaInicio: "",
    fechaRegreso: ""
  });
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "success"
  });

  const showAlert = (title, message, type = "success") => {
    setAlertState({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    setMounted(true);

    // Set default range: start tomorrow, return day after tomorrow
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const startStr = start.toISOString().split("T")[0];
    setFechaUnica(startStr);
    setFechaInicio(startStr);

    const regreso = new Date();
    regreso.setDate(regreso.getDate() + 2);
    setFechaRegreso(regreso.toISOString().split("T")[0]);

    const unsubPersonal = onSnapshot(collection(db, "personal"), (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(w => w.estatus !== "Inactivo");
      setPersonal(data);
      setLoading(false);
    });

    const unsubFeriados = onSnapshot(collection(db, "feriados"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort chronologically (newest/future first)
      data.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
      setFeriados(data);
    });

    return () => {
      unsubPersonal();
      unsubFeriados();
    };
  }, []);

  // Compute unique areas for dropdown filter
  const areasDisponibles = useMemo(() => {
    const areas = personal.map(w => w.area || "No asignado");
    return Array.from(new Set(areas)).sort();
  }, [personal]);

  // Filter workers list for UI checklist
  const trabajadoresFiltrados = useMemo(() => {
    return personal.filter(w => {
      const matchesSearch =
        (w.nombres?.toLowerCase() || "").includes(busqueda.toLowerCase()) ||
        (w.apellidos?.toLowerCase() || "").includes(busqueda.toLowerCase()) ||
        (w.ficha?.toLowerCase() || "").includes(busqueda.toLowerCase()) ||
        (w.cedula?.toLowerCase() || "").includes(busqueda.toLowerCase());

      const matchesArea = filtroArea === "TODAS" || (w.area || "No asignado") === filtroArea;

      const wTipoUpper = (w.tipoPersonal || "").toUpperCase();
      const matchesTipo =
        filtroTipo === "TODOS" ||
        (filtroTipo === "INVECEM" && (wTipoUpper === "INVECEM" || !w.tipoPersonal)) ||
        (filtroTipo.includes("INCES") && wTipoUpper.includes("INCES")) ||
        (filtroTipo.includes("PASANTE") && wTipoUpper.includes("PASANTE"));

      return matchesSearch && matchesArea && matchesTipo;
    });
  }, [personal, busqueda, filtroArea, filtroTipo]);

  const abrirListadoPersonal = (feriadoObj) => {
    setModalPersonalFeriado(feriadoObj);
    setPagModal(1);
    setBusquedaModal("");
  };

  const trabajadoresAsignadosFeriado = useMemo(() => {
    if (!modalPersonalFeriado) return [];
    
    let listaBase = [];
    if (modalPersonalFeriado.tipo === "TODOS") {
      listaBase = personal;
    } else {
      const exentosIds = modalPersonalFeriado.trabajadoresLibran || [];
      listaBase = personal.filter(w => exentosIds.includes(w.id));
    }

    if (busquedaModal.trim() !== "") {
      const q = busquedaModal.toLowerCase();
      listaBase = listaBase.filter(w => 
        (w.nombres?.toLowerCase() || "").includes(q) ||
        (w.apellidos?.toLowerCase() || "").includes(q) ||
        (w.ficha?.toLowerCase() || "").includes(q) ||
        (w.cedula?.toLowerCase() || "").includes(q) ||
        (w.area?.toLowerCase() || "").includes(q)
      );
    }

    return listaBase;
  }, [modalPersonalFeriado, personal, busquedaModal]);

  const handleToggleWorker = (workerId) => {
    if (trabajadoresLibran.includes(workerId)) {
      setTrabajadoresLibran(trabajadoresLibran.filter(id => id !== workerId));
    } else {
      setTrabajadoresLibran([...trabajadoresLibran, workerId]);
    }
  };

  const handleSelectAllVisible = () => {
    const visibleIds = trabajadoresFiltrados.map(w => w.id);
    const uniqueIds = Array.from(new Set([...trabajadoresLibran, ...visibleIds]));
    setTrabajadoresLibran(uniqueIds);
  };

  const handleDeselectAllVisible = () => {
    const visibleIds = trabajadoresFiltrados.map(w => w.id);
    setTrabajadoresLibran(trabajadoresLibran.filter(id => !visibleIds.includes(id)));
  };

  // Helper to remove date range from already processed dates in config
  const forzarReprocesarRango = async (fInicio, fRegreso) => {
    try {
      const configRef = doc(db, "configuracion", "procesamiento-faltas");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const data = configSnap.data();
        const fp = data.fechasProcesadas || [];
        
        // Generate list of dates to remove from processed list
        const datesToRemove = [];
        const start = new Date(fInicio + "T12:00:00");
        const end = new Date(fRegreso + "T12:00:00");
        
        let current = new Date(start);
        while (current < end) {
          const yyyy = current.getFullYear();
          const mm = String(current.getMonth() + 1).padStart(2, "0");
          const dd = String(current.getDate()).padStart(2, "0");
          datesToRemove.push(`${yyyy}-${mm}-${dd}`);
          current.setDate(current.getDate() + 1);
        }

        const nuevoFp = fp.filter(d => !datesToRemove.includes(d));
        await setDoc(configRef, { fechasProcesadas: nuevoFp }, { merge: true });
      }
    } catch (e) {
      console.error("Error forzando reprocesamiento de faltas:", e);
    }
  };

  // Helper to remove automatic FALTAs for exempt workers in a holiday range
  const limpiarFaltasDeRango = async (fInicio, fRegreso, trabajadoresExentos, esTodos) => {
    try {
      // Generate list of match strings "D/M/YYYY"
      const datesToMatch = [];
      const start = new Date(fInicio + "T12:00:00");
      const end = new Date(fRegreso + "T12:00:00");
      
      let current = new Date(start);
      while (current < end) {
        datesToMatch.push(`${current.getDate()}/${current.getMonth() + 1}/${current.getFullYear()}`);
        current.setDate(current.getDate() + 1);
      }

      if (datesToMatch.length === 0) return;

      const snap = await getDocs(collection(db, "personal"));
      const batchPromesas = [];
      
      snap.docs.forEach((docSnap) => {
        const worker = { id: docSnap.id, ...docSnap.data() };
        const esExento = esTodos || trabajadoresExentos.includes(worker.id);
        
        if (esExento && worker.historialIncidencias?.length) {
          const nuevoHistorial = worker.historialIncidencias.filter((inc) => {
            const coincideFaltaAuto =
              inc.tipo === "FALTA" &&
              inc.registradoPor === "SISTEMA AUTOMÁTICO" &&
              datesToMatch.some(dStr => inc.descripcion.includes(dStr));
            return !coincideFaltaAuto;
          });

          if (nuevoHistorial.length !== worker.historialIncidencias.length) {
            batchPromesas.push(
              updateDoc(doc(db, "personal", worker.id), {
                historialIncidencias: nuevoHistorial,
              })
            );
          }
        }
      });

      if (batchPromesas.length > 0) {
        await Promise.all(batchPromesas);
        console.log(`[Calendario] Limpieza de faltas retroactivas de rango completada para ${batchPromesas.length} trabajadores`);
      }
    } catch (e) {
      console.error("Error limpiando faltas retroactivas:", e);
    }
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();

    let finalInicio = "";
    let finalRegreso = "";

    if (duracion === "UN_DIA") {
      if (!fechaUnica) return showAlert("Error", "Debe seleccionar una fecha.", "error");
      finalInicio = fechaUnica;
      
      // Calculate return date as tomorrow of fechaUnica
      const [y, m, d] = fechaUnica.split("-").map(Number);
      const next = new Date(y, m - 1, d + 1);
      const yReg = next.getFullYear();
      const mReg = String(next.getMonth() + 1).padStart(2, "0");
      const dReg = String(next.getDate()).padStart(2, "0");
      finalRegreso = `${yReg}-${mReg}-${dReg}`;
    } else {
      if (!fechaInicio) return showAlert("Error", "Debe seleccionar una fecha de inicio.", "error");
      if (!fechaRegreso) return showAlert("Error", "Debe seleccionar una fecha de regreso.", "error");
      if (new Date(fechaRegreso) <= new Date(fechaInicio)) {
        return showAlert("Error", "La fecha de regreso debe ser mayor a la fecha de inicio.", "error");
      }
      finalInicio = fechaInicio;
      finalRegreso = fechaRegreso;
    }

    if (!nombre.trim()) return showAlert("Error", "Debe ingresar el nombre del feriado o período.", "error");

    setSaving(true);
    try {
      const exentos = tipo === "TODOS" ? [] : trabajadoresLibran;
      const documentId = `${finalInicio}_${finalRegreso}`;
      const refFeriado = doc(db, "feriados", documentId);
      
      await setDoc(refFeriado, {
        id: documentId,
        fechaInicio: finalInicio,
        fechaRegreso: finalRegreso,
        nombre: nombre.trim(),
        tipo,
        trabajadoresLibran: exentos
      });

      // Force background processing to check this range again
      await forzarReprocesarRango(finalInicio, finalRegreso);

      // Clean existing FALTAs retroactively
      await limpiarFaltasDeRango(finalInicio, finalRegreso, exentos, tipo === "TODOS");

      registrarAccion(
        null,
        null,
        `Feriado/Período registrado: del ${finalInicio} al regreso ${finalRegreso}: ${nombre.trim()} (${tipo})`,
        "Gestión de Feriados"
      );

      showAlert("Éxito", `Feriado registrado correctamente.`);
      setNombre("");
      setTrabajadoresLibran([]);
    } catch (error) {
      console.error("Error al guardar feriado:", error);
      showAlert("Error", "Ocurrió un error al guardar en la base de datos.", "error");
    }
    setSaving(false);
  };

  const confirmDeleteHoliday = (feriadoId, nombreFeriado, fInicio, fRegreso) => {
    setConfirmDialog({
      isOpen: true,
      feriadoId,
      nombreFeriado,
      fechaInicio: fInicio,
      fechaRegreso: fRegreso
    });
  };

  const handleDeleteHoliday = async () => {
    const { feriadoId, fechaInicio: fIni, fechaRegreso: fReg } = confirmDialog;
    if (!feriadoId) return;

    try {
      await deleteDoc(doc(db, "feriados", feriadoId));
      
      // Force reprocessing of this date range so absences can be registered normally again
      await forzarReprocesarRango(fIni, fReg);

      registrarAccion(
        null,
        null,
        `Feriado/Período eliminado: del ${fIni} al ${fReg}`,
        "Gestión de Feriados"
      );

      showAlert("Feriado Eliminado", `El registro ha sido eliminado.`);
    } catch (error) {
      console.error("Error al eliminar feriado:", error);
      showAlert("Error", "No se pudo eliminar el feriado.", "error");
    }

    setConfirmDialog({ isOpen: false, feriadoId: null, nombreFeriado: "", fechaInicio: "", fechaRegreso: "" });
  };

  const allVisibleSelected = useMemo(() => {
    if (trabajadoresFiltrados.length === 0) return false;
    return trabajadoresFiltrados.every(w => trabajadoresLibran.includes(w.id));
  }, [trabajadoresFiltrados, trabajadoresLibran]);

  const someVisibleSelected = useMemo(() => {
    if (trabajadoresFiltrados.length === 0) return false;
    return trabajadoresFiltrados.some(w => trabajadoresLibran.includes(w.id)) && !allVisibleSelected;
  }, [trabajadoresFiltrados, trabajadoresLibran, allVisibleSelected]);

  const handleBulkToggle = () => {
    const allChecked = trabajadoresFiltrados.every(w => trabajadoresLibran.includes(w.id));
    if (allChecked) {
      handleDeselectAllVisible();
    } else {
      handleSelectAllVisible();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background decoration */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* CORPORATE TOP NAV */}
      <nav className="top-nav bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)" }}>
            <i className="fas fa-fingerprint text-white text-[11px]"></i>
          </div>
          <span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span>
        </div>
        <button
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/recursos-humanos")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CENTRAL CONTAINER */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">
        
        {/* HEADER SECTION */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 dark:text-white uppercase flex items-center gap-3">
            <i className="fas fa-calendar-alt text-cyan-500"></i> Calendario de Feriados y Períodos
          </h1>
          <p className="text-slate-550 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Gestión de días feriados individuales y asuetos programados por rangos continuos de descanso
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDE: HOLIDAY REGISTRY FORM & WORKERS SELECTOR */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/10 relative shadow-neon-cyan/5">
              <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-lg font-black uppercase text-indigo-955 dark:text-white tracking-tight mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <i className="fas fa-plus-circle text-cyan-500"></i> Configurar Feriado
              </h2>

              <form onSubmit={handleSaveHoliday} className="space-y-6">
                
                {/* Duration selector tabs */}
                <div className="space-y-2">
                  <label className="block text-xxs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Duración del Feriado</label>
                  <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 rounded-xl relative max-w-xs select-none">
                    <button
                      type="button"
                      onClick={() => setDuracion("UN_DIA")}
                      className={`flex-1 py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${duracion === 'UN_DIA' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                      Un Solo Día
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuracion("RANGO")}
                      className={`flex-1 py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${duracion === 'RANGO' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                      Rango de Fechas
                    </button>
                  </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {duracion === "UN_DIA" ? (
                    /* Single day input */
                    <div>
                      <label className="block text-xxs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-mono">Fecha del Feriado</label>
                      <input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        value={fechaUnica}
                        onChange={(e) => setFechaUnica(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                        required
                      />
                    </div>
                  ) : (
                    /* Date range inputs */
                    <>
                      <div>
                        <label className="block text-xxs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-mono">Fecha de Inicio</label>
                        <input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          value={fechaInicio}
                          onChange={(e) => setFechaInicio(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xxs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-mono">Fecha de Regreso (Retorno)</label>
                        <input
                          type="date"
                          value={fechaRegreso}
                          onChange={(e) => setFechaRegreso(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* Holiday Name */}
                  <div className={duracion === "UN_DIA" ? "md:col-span-2" : "md:col-span-1"}>
                    <label className="block text-xxs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-mono">Nombre / Descripción</label>
                    <input
                      type="text"
                      placeholder={duracion === "UN_DIA" ? "Ej. Batalla de Carabobo, Navidad..." : "Ej. Primer Turno Diciembre..."}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                      required
                    />
                  </div>

                </div>         </div>

                {/* Holiday Type Selector */}
                <div>
                  <label className="block text-xxs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 font-mono">Asignación de Beneficiarios</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 px-4 py-3 bg-[#f8fafc]/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800 transition-all select-none">
                      <input
                        type="radio"
                        name="tipoFeriado"
                        value="TODOS"
                        checked={tipo === "TODOS"}
                        onChange={() => setTipo("TODOS")}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Todos Libres (Feriado Global)</span>
                    </label>
                    <label className="flex items-center gap-2 px-4 py-3 bg-[#f8fafc]/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800 transition-all select-none">
                      <input
                        type="radio"
                        name="tipoFeriado"
                        value="PARCIAL"
                        checked={tipo === "PARCIAL"}
                        onChange={() => setTipo("PARCIAL")}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Selección Parcial (Personal Específico / Áreas)</span>
                    </label>
                  </div>
                </div>

                {/* DYNAMIC WORKER SELECTOR GRID */}
                {tipo === "PARCIAL" && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black uppercase text-indigo-955 dark:text-slate-100 font-mono">Asignación de Personal Exento</h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                          Selecciona a los colaboradores que libran en este período ({trabajadoresLibran.length} seleccionados)
                        </p>
                      </div>

                      {/* Bulk actions */}
                      <div className="flex gap-2 w-full md:w-auto justify-end">
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xxs font-black uppercase tracking-wider transition-colors cursor-pointer font-mono"
                        >
                          <i className="fas fa-check-double mr-1"></i> Seleccionar Todos Filtrados
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllVisible}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-955/40 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 rounded-lg text-xxs font-black uppercase tracking-wider transition-colors cursor-pointer font-mono"
                        >
                          <i className="fas fa-trash-alt mr-1"></i> Limpiar Filtrados
                        </button>
                      </div>
                    </div>

                    {/* Filter controls */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#f8fafc] dark:bg-slate-955/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                      
                      <div className="md:col-span-6 relative w-full">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          <i className="fas fa-search"></i>
                        </span>
                        <input
                          type="text"
                          placeholder="Buscar por Nombre, Ficha..."
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xxs font-semibold"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <select
                          value={filtroArea}
                          onChange={(e) => setFiltroArea(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xxs font-semibold cursor-pointer uppercase"
                        >
                          <option value="TODAS">TODAS LAS ÁREAS</option>
                          {areasDisponibles.map(a => (
                            <option key={a} value={a}>{a.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <select
                          value={filtroTipo}
                          onChange={(e) => setFiltroTipo(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xxs font-semibold cursor-pointer uppercase"
                        >
                          <option value="TODOS">TODOS LOS CONTRATOS</option>
                          <option value="INVECEM">INVECEM</option>
                          <option value="INCES">INCES</option>
                          <option value="PASANTES">PASANTES</option>
                        </select>
                      </div>

                    </div>

                    {/* Workers list table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto bg-white dark:bg-slate-900 pr-0.5">
                      <table className="w-full border-collapse">
                        <thead className="bg-[#f8fafc] dark:bg-slate-800 sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-12 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono select-none">
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someVisibleSelected;
                                }}
                                onChange={handleBulkToggle}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                              />
                            </th>
                            <th className="py-2.5 px-3 text-center w-20 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Ficha</th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Colaborador</th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Área / Cargo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trabajadoresFiltrados.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="py-8 text-center text-slate-400 font-bold italic text-xs font-mono">
                                Sin resultados para el filtro seleccionado
                              </td>
                            </tr>
                          ) : (
                            trabajadoresFiltrados.map((w) => {
                              const seleccionado = trabajadoresLibran.includes(w.id);
                              return (
                                <tr
                                  key={w.id}
                                  onClick={() => handleToggleWorker(w.id)}
                                  className={`border-b border-slate-100/60 dark:border-slate-800/60 hover:bg-[#f8fafc]/70 dark:hover:bg-slate-850/50 transition-colors cursor-pointer select-none ${seleccionado ? "bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10 animate-fade-in" : ""}`}
                                >
                                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={seleccionado}
                                      onChange={() => handleToggleWorker(w.id)}
                                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-750 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-xs font-black font-mono text-cyan-600">
                                    {w.ficha || "---"}
                                  </td>
                                  <td className="py-2.5 px-3 text-left">
                                    <span className="text-xs font-extrabold text-indigo-955 dark:text-slate-100 uppercase block">{w.nombres} {w.apellidos}</span>
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{w.tipoPersonal}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-left text-xs font-semibold text-slate-550 dark:text-slate-400 uppercase">
                                    {w.area || "No asignado"} <span className="text-[10px] text-slate-400 dark:text-slate-500 lowercase block font-normal">{w.cargo}</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin"></i> Guardando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i> Guardar Feriado
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT SIDE: LIST OF REGISTERED HOLIDAYS */}
          <div className="lg:col-span-4">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-2xl shadow-slate-200/10 relative shadow-neon-cyan/5 flex flex-col h-full min-h-[500px]">
              <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-lg font-black uppercase text-indigo-955 dark:text-white tracking-tight mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <i className="fas fa-list-ul text-cyan-500"></i> Feriados Guardados
              </h2>

              <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[600px] no-scrollbar font-sans">
                {loading ? (
                  <div className="py-12 text-center text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
                    Cargando feriados...
                  </div>
                ) : feriados.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 dark:text-slate-400 font-bold italic text-xs font-sans">
                    No se han registrado feriados o períodos libres.
                  </div>
                ) : (
                  feriados.map((f) => {
                    const esGlobal = f.tipo === "TODOS";
                    const [yI, mI, dI] = f.fechaInicio.split("-");
                    const [yR, mR, dR] = f.fechaRegreso.split("-");
                    
                    // Check if it is a single day
                    const isSingleDay =
                      f.fechaInicio &&
                      f.fechaRegreso &&
                      Math.floor((new Date(f.fechaRegreso) - new Date(f.fechaInicio)) / (1000 * 60 * 60 * 24)) === 1;

                    return (
                      <div
                        key={f.id}
                        className={`p-3.5 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl relative flex flex-col justify-between transition-all hover:translate-x-1 ${esGlobal ? "border-l-4 border-l-cyan-500" : "border-l-4 border-l-purple-500"}`}
                      >
                        <button
                          onClick={() => confirmDeleteHoliday(f.id, f.nombre, f.fechaInicio, f.fechaRegreso)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-red-500 transition-colors text-xs font-extrabold cursor-pointer"
                          title="Eliminar período"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>

                        <div>
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 font-mono block mb-1">
                            {isSingleDay ? (
                              `Día Feriado: ${dI}/${mI}/${yI}`
                            ) : (
                              `Rango: ${dI}/${mI}/${yI} al ${dR}/${mR}/${yR}`
                            )}
                          </span>
                          <h4 className="text-xs font-black uppercase text-indigo-955 dark:text-slate-250 pr-6 leading-tight">
                            {f.nombre}
                          </h4>
                          {!isSingleDay && (
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-450 block mt-1">
                              📅 Retorno: {dR}/${mR}/${yR}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-lg border font-mono ${esGlobal ? "bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800" : "bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-200 dark:border-purple-800"}`}>
                            {esGlobal ? "TODOS LIBRES" : "PARCIAL"}
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirListadoPersonal(f)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono flex items-center gap-1 hover:scale-105 active:scale-95"
                          >
                            👁️ Ver {esGlobal ? "Todos" : `${f.trabajadoresLibran?.length || 0} p.`}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* CONFIRMATION DELETE DIALOG */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-fade-in font-sans">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 dark:border-indigo-500/20 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative text-slate-800 dark:text-slate-100 animate-slide-up">
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

            <h2 className="text-xl font-black uppercase text-indigo-955 dark:text-white tracking-tight flex items-center gap-2">
              <i className="fas fa-exclamation-triangle text-amber-500"></i> ¿Eliminar Período?
            </h2>
            <p className="text-sm font-semibold text-slate-650 dark:text-slate-300 leading-relaxed font-sans">
              ¿Estás seguro de que deseas eliminar el feriado <strong className="text-indigo-950 dark:text-white">"{confirmDialog.nombreFeriado}"</strong>?
              <br /><br />
              <span className="text-xs text-red-500 font-bold block">
                ⚠️ Si es un rango en el pasado, el sistema automático volverá a procesar las faltas injustificadas para estos días en el próximo ciclo.
              </span>
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                onClick={() => setConfirmDialog({ isOpen: false, feriadoId: null, nombreFeriado: "", fechaInicio: "", fechaRegreso: "" })}
              >
                Cancelar
              </button>
              <button
                className="px-5 py-2 bg-red-650 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                onClick={handleDeleteHoliday}
              >
                Eliminar Período
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT MODAL */}
      {alertState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-fade-in">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 dark:border-indigo-500/20 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative text-slate-800 dark:text-slate-100 animate-slide-up font-sans">
            <h2 className="text-xl font-black uppercase text-indigo-955 dark:text-white tracking-tight flex items-center gap-2">
              <i className={`fas ${alertState.type === "success" ? "fa-check-circle text-emerald-500" : "fa-exclamation-circle text-red-500"}`}></i> {alertState.title}
            </h2>
            <p className="text-sm font-semibold text-slate-650 dark:text-slate-350 leading-relaxed font-sans">
              {alertState.message}
            </p>
            <div className="flex justify-end pt-2">
              <button
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                onClick={() => setAlertState({ ...alertState, isOpen: false })}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LISTADO PERSONAL FERIADO */}
      {modalPersonalFeriado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-fade-in font-sans">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 dark:border-indigo-500/20 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl space-y-6 relative text-slate-800 dark:text-slate-100 animate-slide-up">
            <button
              onClick={() => setModalPersonalFeriado(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-red-500 transition-colors text-lg font-extrabold cursor-pointer"
            >
              <i className="fas fa-times"></i>
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-2xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 text-2xl">
                <i className="fas fa-users font-sans text-cyan-500"></i>
              </div>
              <div>
                <h2 className="text-lg font-black uppercase text-indigo-955 dark:text-white tracking-tight">Personal en Feriado/Asueto</h2>
                <p className="text-3xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mt-0.5">
                  Feriado: {modalPersonalFeriado.nombre} ({modalPersonalFeriado.tipo === "TODOS" ? "Global" : "Parcial"})
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="BUSCAR COLABORADOR POR NOMBRE, FICHA, CEDULA..."
                value={busquedaModal}
                onChange={(e) => {
                  setBusquedaModal(e.target.value);
                  setPagModal(1);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold uppercase"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto w-full no-scrollbar max-h-[300px] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800/60 text-xxs font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase font-mono">
                    <th className="py-3 px-4 text-center w-20">FICHA</th>
                    <th className="py-3 px-4">COLABORADOR</th>
                    <th className="py-3 px-4">CÉDULA</th>
                    <th className="py-3 px-4">ÁREA / DPTO</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalPaginas = Math.ceil(trabajadoresAsignadosFeriado.length / itemsPorPaginaModal) || 1;
                    const indexInicio = (pagModal - 1) * itemsPorPaginaModal;
                    const indexFin = pagModal * itemsPorPaginaModal;
                    const paginados = trabajadoresAsignadosFeriado.slice(indexInicio, indexFin);

                    if (paginados.length === 0) {
                      return (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-slate-400 dark:text-slate-500 font-bold italic text-xs font-mono">
                            Ningún colaborador asignado o coincidente
                          </td>
                        </tr>
                      );
                    }

                    return paginados.map(w => (
                      <tr key={w.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-xs font-semibold">
                        <td className="py-2.5 px-4 text-center font-bold text-cyan-600 dark:text-cyan-400 font-mono">{w.ficha}</td>
                        <td className="py-2.5 px-4 font-black uppercase text-indigo-955 dark:text-slate-200">{w.nombres} {w.apellidos}</td>
                        <td className="py-2.5 px-4 font-mono">{w.cedula}</td>
                        <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 text-xxs font-bold uppercase">{w.area || "No asignado"}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination / Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
              <span className="text-xxs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Mostrando {Math.min(trabajadoresAsignadosFeriado.length, (pagModal - 1) * itemsPorPaginaModal + 1)} - {Math.min(trabajadoresAsignadosFeriado.length, pagModal * itemsPorPaginaModal)} de {trabajadoresAsignadosFeriado.length} exentos
              </span>

              {trabajadoresAsignadosFeriado.length > itemsPorPaginaModal && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPagModal(prev => Math.max(prev - 1, 1))}
                    disabled={pagModal === 1}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-850 dark:text-slate-350 rounded-xl text-xxs font-black uppercase transition-all cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                  >
                    <i className="fas fa-chevron-left"></i> Ant.
                  </button>
                  <button
                    onClick={() => setPagModal(prev => Math.min(prev + 1, Math.ceil(trabajadoresAsignadosFeriado.length / itemsPorPaginaModal)))}
                    disabled={pagModal === Math.ceil(trabajadoresAsignadosFeriado.length / itemsPorPaginaModal)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-850 dark:text-slate-350 rounded-xl text-xxs font-black uppercase transition-all cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                  >
                    Sig. <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer font-semibold"
                onClick={() => setModalPersonalFeriado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
