"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db, registrarAccion } from "@/app/lib/firebase";
import { 
  collection, query, where, getDocs, addDoc, 
  updateDoc, doc, serverTimestamp, onSnapshot, orderBy, deleteDoc, or
} from "firebase/firestore";

export default function RegistroAsistencia() {
  const router = useRouter();
  const inputRef = useRef(null);

  const [identificador, setIdentificador] = useState("");
  const filtro = "";
  const [asistenciasHoy, setAsistenciasHoy] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [fechaHoy, setFechaHoy] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 30;

  useEffect(() => {
    setPaginaActual(1);
  }, [asistenciasHoy.length]);

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

  const estaEnRangoAlmuerzo = (horaActStr, inicioStr, finStr) => {
    if (!inicioStr || !finStr) return false;
    const minActual = convertirAMinutos(horaActStr);
    let minInicio = convertirAMinutos(inicioStr);
    let minFin = convertirAMinutos(finStr);

    if (minFin < minInicio) {
      // Cruza la medianoche, ej: de 23:00 a 00:30 (1380 a 30)
      minFin += 1440;
      if (minActual < 720) {
        const minActualAjustado = minActual + 1440;
        return minActualAjustado >= (minInicio - 30) && minActualAjustado <= (minFin + 60);
      }
    }

    return minActual >= (minInicio - 30) && minActual <= (minFin + 60);
  };

  const obtenerCountdownAlmuerzo = (salidaAlmuerzoStr, finAlmuerzoStr) => {
    if (!salidaAlmuerzoStr || !finAlmuerzoStr) return { texto: "--:--", esTarde: false };
    
    const [hrsSalida, minsSalida] = salidaAlmuerzoStr.split(":").map(Number);
    const [hrsFin, minsFin] = finAlmuerzoStr.split(":").map(Number);
    
    const ahora = new Date();
    
    // Configurar la fecha de salida a almuerzo (hoy)
    const fechaSalida = new Date();
    fechaSalida.setHours(hrsSalida, minsSalida, 0, 0);
    
    // Configurar la fecha limite de regreso (hoy)
    const fechaLimite = new Date();
    fechaLimite.setHours(hrsFin, minsFin, 0, 0);
    
    // Si la hora de fin es menor que la de salida, cruza la medianoche (es el dia siguiente)
    const salidaMinutos = hrsSalida * 60 + minsSalida;
    const finMinutos = hrsFin * 60 + minsFin;
    if (finMinutos < salidaMinutos) {
      fechaLimite.setDate(fechaLimite.setDate() + 1);
    }
    
    const diffMs = fechaLimite.getTime() - ahora.getTime();
    const esTarde = diffMs < 0;
    const diffAbs = Math.abs(diffMs);
    
    const totalSegundos = Math.floor(diffAbs / 1000);
    const min = Math.floor(totalSegundos / 60);
    const seg = totalSegundos % 60;
    
    const texto = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
    return { texto, esTarde };
  };

  const chequearAbandonosHoy = async (listaAsistencias) => {
    const ahora = new Date();
    const horaActualMin = ahora.getHours() * 60 + ahora.getMinutes();

    for (const reg of listaAsistencias) {
      // Si salió a almorzar pero no regresó, no ha finalizado su jornada, y tiene hora de salida asignada
      if (reg.entrada && reg.salidaAlmuerzo && !reg.entradaAlmuerzo && !reg.salida && reg.horaSalida) {
        const minSalida = convertirAMinutos(reg.horaSalida);
        let pasoHoraSalida = false;
        const minEntrada = convertirAMinutos(reg.horaEntrada || "07:00");
        
        if (minSalida < minEntrada) {
          // Turno nocturno (cruza medianoche)
          if (horaActualMin >= minSalida && horaActualMin < minEntrada) {
            pasoHoraSalida = true;
          }
        } else {
          // Turno normal (mismo día)
          if (horaActualMin >= minSalida) {
            pasoHoraSalida = true;
          }
        }

        if (pasoHoraSalida) {
          try {
            await updateDoc(doc(db, "asistencias", reg.id), {
              salida: reg.horaSalida,
              estatus: "ABANDONO DE TRABAJO",
              estado: "FINALIZADO",
              observacionAcceso: "AUTO-CIERRE: El trabajador salió a almorzar y no retornó antes de su hora de salida oficial."
            });
            
            registrarAccion(
              null,
              null,
              `Abandono de trabajo registrado automáticamente para ${reg.nombreCompleto} (Ficha: ${reg.ficha}) - No regresó de almuerzo`,
              "Control de Asistencia"
            );
          } catch (err) {
            console.error("Error al registrar abandono de puesto:", err);
          }
        }
      }
    }
  };

  useEffect(() => {
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    setFechaHoy(new Date().toLocaleDateString('es-ES', opciones).toUpperCase());

    const limiteDia = new Date();
    limiteDia.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "asistencias"),
      or(where("fechaHora", ">=", limiteDia), where("salida", "==", null)),
      orderBy("fechaHora", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAsistenciasHoy(lista);
      chequearAbandonosHoy(lista);
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
        registrarAccion(
          null, 
          null, 
          "Base de datos de asistencia diaria vaciada (Modo Desarrollador)", 
          "Control de Asistencia"
        );
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
        cargo: trabajador.nombreContrata || trabajador.cargo || (trabajador.tipoPersonal === "Pasante" ? (trabajador.carreraPasante || "PASANTE") : trabajador.tipoPersonal === "Estudiante INCES" ? (trabajador.programaInces || "ESTUDIANTE INCES") : "OPERARIO"),
        area: trabajador.areaTrabajo || trabajador.area || (trabajador.tipoPersonal === "Pasante" ? (trabajador.universidadPasante || "PLANTA") : trabajador.tipoPersonal === "Estudiante INCES" ? ("INCES") : "PLANTA"), 
        tipoPersonal: trabajador.tipoPersonal || "INVECEM",
        entrada: horaActual,
        salida: null,
        estatus: "BENEFICIO",
        fechaHora: serverTimestamp(),
        observacionAcceso: `INGRESO AUTORIZADO POR BENEFICIOS: Personal en ${trabajador.estatus.toUpperCase()}`
      });

      registrarAccion(
        null, 
        null, 
        `Ingreso por beneficio autorizado para ${trabajador.nombres} ${trabajador.apellidos} (Ficha: ${trabajador.ficha || trabajador.idAcceso || 'S/F'})`, 
        "Control de Asistencia"
      );

      // Si el trabajador tiene inasistencias registradas para hoy en su historial, las eliminamos al marcar entrada
      const d = new Date();
      const hoyStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      if (trabajador.historialIncidencias && trabajador.historialIncidencias.length > 0) {
        const historialFiltrado = trabajador.historialIncidencias.filter(inc => 
          !(inc.tipo === "FALTA" && inc.descripcion.includes(hoyStr))
        );
        if (historialFiltrado.length !== trabajador.historialIncidencias.length) {
          await updateDoc(doc(db, "personal", trabajador.id), {
            historialIncidencias: historialFiltrado
          });
        }
      }

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

        if (!existe) {
          // Verificar si es un pasante y su pasantía ha culminado (para denegar ingreso)
          if (trabajador.tipoPersonal === "Pasante" && trabajador.fechaEgreso) {
            const hoy = new Date();
            const [anio, mes, dia] = trabajador.fechaEgreso.split("-").map(Number);
            const fechaCulminacion = new Date(anio, mes - 1, dia, 23, 59, 59, 999);

            if (hoy > fechaCulminacion) {
              setTrabajadorEspecial({
                ...trabajador,
                motivoBloqueo: "PASANTÍA CULMINADA",
                mensajeBloqueo: `Las pasantías de este colaborador culminaron el día ${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${anio}. No tiene permitido el acceso a las instalaciones.`
              });
              setMostrarModalBeneficio(true);
              setCargando(false);
              return;
            }
          }

          // Verificar si el colaborador está INACTIVO
          if (trabajador.estatus === "Inactivo") {
            setTrabajadorEspecial({
              ...trabajador,
              motivoBloqueo: "PERSONAL INACTIVO",
              mensajeBloqueo: "Este colaborador se encuentra INACTIVO en el sistema. Acceso denegado."
            });
            setMostrarModalBeneficio(true);
            setCargando(false);
            return;
          }

          // Verificar si es un contratista y está SUSPENDIDO o INACTIVO
          if (procedencia === "CONTRATISTA") {
            if (trabajador.estadoNominal === "Suspendido") {
              setTrabajadorEspecial({
                ...trabajador,
                motivoBloqueo: "CONTRATISTA SUSPENDIDO",
                mensajeBloqueo: "Este contratista se encuentra SUSPENDIDO. Acceso denegado."
              });
              setMostrarModalBeneficio(true);
              setCargando(false);
              return;
            }
            if (trabajador.estadoNominal === "Inactivo") {
              setTrabajadorEspecial({
                ...trabajador,
                motivoBloqueo: "CONTRATISTA INACTIVO",
                mensajeBloqueo: "Este contratista se encuentra INACTIVO. Acceso denegado."
              });
              setMostrarModalBeneficio(true);
              setCargando(false);
              return;
            }
          }

          if (trabajador.estatus === "Vacaciones" || trabajador.estatus === "Reposo Médico") {
            setTrabajadorEspecial(trabajador);
            setMostrarModalBeneficio(true);
            setCargando(false);
            return;
          }
        }

        if (existe) {
          const tieneAlmuerzo = existe.horaAlmuerzoInicio && existe.horaAlmuerzoFin;
          
          if (tieneAlmuerzo) {
            if (!existe.salidaAlmuerzo) {
              // Aún no ha marcado salida a almuerzo. ¿Está en el rango?
              const enRango = estaEnRangoAlmuerzo(horaActual, existe.horaAlmuerzoInicio, existe.horaAlmuerzoFin);
              if (enRango) {
                await updateDoc(doc(db, "asistencias", existe.id), {
                  salidaAlmuerzo: horaActual,
                  observacionAcceso: "Salió a almorzar"
                });
                
                registrarAccion(
                  null,
                  null,
                  `Salida a almorzar registrada para ${trabajador.nombres} ${trabajador.apellidos} (Ficha: ${trabajador.ficha || trabajador.idAcceso || 'S/F'})`,
                  "Control de Asistencia"
                );
                
                alert(`🍱 Salida a Almuerzo registrada para ${trabajador.nombres.toUpperCase()} ${trabajador.apellidos.toUpperCase()}.\nHora límite de regreso: ${existe.horaAlmuerzoFin}`);
                setCargando(false);
                return;
              }
            } else if (existe.salidaAlmuerzo && !existe.entradaAlmuerzo) {
              // Ya salió pero no ha regresado. Registrar Regreso de Almuerzo.
              let minActual = convertirAMinutos(horaActual);
              let minFin = convertirAMinutos(existe.horaAlmuerzoFin);
              
              if (minFin < convertirAMinutos(existe.salidaAlmuerzo)) {
                minFin += 1440;
                if (minActual < 720) minActual += 1440;
              }
              
              const diffMinutos = minActual - minFin;
              const retraso = diffMinutos > 0 ? diffMinutos : 0;
              
              await updateDoc(doc(db, "asistencias", existe.id), {
                entradaAlmuerzo: horaActual,
                minutosAlmuerzoTarde: retraso,
                observacionAcceso: retraso > 0 ? `Regresó de almuerzo con retraso de ${retraso} min` : "Regresó de almuerzo a tiempo"
              });
              
              registrarAccion(
                null,
                null,
                `Regreso de almuerzo registrado para ${trabajador.nombres} ${trabajador.apellidos} (Ficha: ${trabajador.ficha || trabajador.idAcceso || 'S/F'})${retraso > 0 ? ` - Retraso: +${retraso} min` : " (A tiempo)"}`,
                "Control de Asistencia"
              );
              
              if (retraso > 0) {
                alert(`⚠️ Regreso de almuerzo registrado con retraso de ${retraso} minutos.`);
              } else {
                alert(`✅ Regreso de almuerzo registrado a tiempo.`);
              }
              setCargando(false);
              return;
            }
          }

          // Salida definitiva
          await updateDoc(doc(db, "asistencias", existe.id), {
            salida: horaActual,
            estado: "FINALIZADO" 
          });
          
          registrarAccion(
            null, 
            null, 
            `Salida registrada para ${trabajador.nombres} ${trabajador.apellidos} (Ficha: ${trabajador.ficha || trabajador.idAcceso || 'S/F'})`, 
            "Control de Asistencia"
          );
          
          alert(`👋 Salida definitiva registrada para ${trabajador.nombres.toUpperCase()} ${trabajador.apellidos.toUpperCase()}.`);
        } else {
          const minM = convertirAMinutos(horaActual);
          const minT = convertirAMinutos(trabajador.horaEntrada || "07:00");
          const estatusCalculado = minM > (minT + 15) ? "RETRASO" : "PUNTUAL";

          await addDoc(collection(db, "asistencias"), {
            nombreCompleto: `${trabajador.nombres} ${trabajador.apellidos}`.toUpperCase(),
            ficha: trabajador.idAcceso || trabajador.ficha || "S/F",
            cedula: trabajador.cedula,
            cargo: trabajador.nombreContrata || trabajador.cargo || (trabajador.tipoPersonal === "Pasante" ? (trabajador.carreraPasante || "PASANTE") : trabajador.tipoPersonal === "Estudiante INCES" ? (trabajador.programaInces || "ESTUDIANTE INCES") : "OPERARIO"),
            area: trabajador.areaTrabajo || trabajador.area || (trabajador.tipoPersonal === "Pasante" ? (trabajador.universidadPasante || "PLANTA") : trabajador.tipoPersonal === "Estudiante INCES" ? ("INCES") : "PLANTA"), 
            tipoPersonal: trabajador.tipoPersonal || procedencia,
            entrada: horaActual,
            salida: null,
            estatus: estatusCalculado, 
            fechaHora: serverTimestamp(),
            // Copia del horario
            horaEntrada: trabajador.horaEntrada || "07:00",
            horaSalida: trabajador.horaSalida || "16:00",
            horaAlmuerzoInicio: trabajador.horaAlmuerzoInicio || "",
            horaAlmuerzoFin: trabajador.horaAlmuerzoFin || "",
            salidaAlmuerzo: null,
            entradaAlmuerzo: null,
            minutosAlmuerzoTarde: null
          });

          registrarAccion(
            null, 
            null, 
            `Entrada registrada para ${trabajador.nombres} ${trabajador.apellidos} (Ficha: ${trabajador.ficha || trabajador.idAcceso || 'S/F'}) - Estatus: ${estatusCalculado}`, 
            "Control de Asistencia"
          );

          // Si el trabajador tiene inasistencias registradas para hoy en su historial, las eliminamos al marcar entrada
          const d = new Date();
          const hoyStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
          if (trabajador.historialIncidencias && trabajador.historialIncidencias.length > 0) {
            const historialFiltrado = trabajador.historialIncidencias.filter(inc => 
              !(inc.tipo === "FALTA" && inc.descripcion.includes(hoyStr))
            );
            if (historialFiltrado.length !== trabajador.historialIncidencias.length) {
              await updateDoc(doc(db, "personal", trabajador.id), {
                historialIncidencias: historialFiltrado
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setCargando(false);
    }
  }, [identificador, cargando, asistenciasHoy]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      procesarRegistro();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#06b6d4,#3b82f6)'}}>
            <i className="fas fa-fingerprint text-white" style={{fontSize:'11px'}} />
          </div>
          <span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span>
        </div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-cyan-500/20 transition-all duration-200 cursor-pointer text-white"
          onClick={() => router.push("/inspector")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-6xl mx-auto px-6 py-10 z-10 relative">
        
        {/* DEV ACTIONS AND TOOLS */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-6 print:hidden">
          <div className="flex gap-2">
            <span className="px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-600 text-xxs font-black tracking-widest uppercase rounded-lg animate-pulse flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> Lector Conectado
            </span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleLimpiarBase}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-indigo-950 rounded-lg text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm"
            >
              🧹 Limpiar Base
            </button>
            <button 
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-555 hover:text-indigo-950 rounded-lg text-xxs font-bold uppercase transition-all cursor-pointer shadow-sm"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {/* TARJETA ESCÁNER PRINCIPAL */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          {/* HEADER TARJETA */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/60 pb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase flex items-center gap-2">
                <i className="fas fa-barcode text-cyan-600"></i> Registro de Asistencia
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                Lectura de ficha técnica y cédula para ingreso a planta
              </p>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-cyan-600 uppercase tracking-wider font-mono shadow-sm">
              {fechaHoy}
            </div>
          </header>

          {/* ESCÁNER TERMINAL */}
          <section className="p-6 bg-slate-50 border border-slate-200 rounded-2xl print:hidden relative overflow-hidden group">
            
            {/* Lámpara de scanner animado */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-float"></div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <label className="text-xxs font-black text-cyan-600 uppercase tracking-widest flex items-center gap-1.5 justify-center md:justify-start font-mono">
                  <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping"></span> TERMINAL_ESCANEADO
                </label>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ingrese o escanee la ficha del trabajador</p>
              </div>

              <div className="w-full md:w-80">
                <input
                  ref={inputRef}
                  type="text"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mostrarModalBeneficio ? "BLOQUEADO" : "INGRESE FICHA Y PRESIONE ENTER"}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:shadow-neon-cyan/40 focus:border-transparent transition-all duration-200 text-base font-black tracking-widest text-center uppercase shadow-sm"
                  autoComplete="off"
                  disabled={mostrarModalBeneficio}
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN PERSONAL EN ALMUERZO */}
          {(() => {
            const enAlmuerzo = asistenciasHoy.filter(a => a.entrada && a.salidaAlmuerzo && !a.entradaAlmuerzo && !a.salida);
            
            return (
              <section className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl print:hidden space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                  <h3 className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-2 font-mono">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    ⏱️ Monitoreo de Almuerzo en Tiempo Real
                  </h3>
                  <span className="px-2 py-0.5 bg-slate-200 border border-slate-300 rounded text-[9px] font-black text-slate-600 tracking-wider font-mono uppercase">
                    {enAlmuerzo.length} {enAlmuerzo.length === 1 ? "Trabajador fuera" : "Trabajadores fuera"}
                  </span>
                </div>

                {enAlmuerzo.length === 0 ? (
                  <p className="text-slate-400 font-bold italic text-xs font-mono text-center py-2 flex items-center justify-center gap-2">
                    <i className="fas fa-check-circle text-emerald-500"></i> Todo el personal se encuentra en planta o completó su almuerzo.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {enAlmuerzo.map(reg => {
                      const countdown = obtenerCountdownAlmuerzo(reg.salidaAlmuerzo, reg.horaAlmuerzoFin || "13:00");
                      return (
                        <div key={reg.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 relative overflow-hidden group">
                          {/* Top accent line */}
                          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${countdown.esTarde ? "from-red-500 to-pink-500 animate-pulse" : "from-cyan-500 to-blue-500"}`} />
                          
                          <div>
                            <strong className="text-xs font-black text-indigo-950 uppercase block truncate">{reg.nombreCompleto}</strong>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block font-mono">Ficha: {reg.ficha}</span>
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-mono border-t border-b border-slate-100 py-1.5">
                            <div>
                              <span className="text-slate-400 block">SALIÓ</span>
                              <strong className="text-slate-700">{reg.salidaAlmuerzo}</strong>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block">LÍMITE</span>
                              <strong className="text-slate-700">{reg.horaAlmuerzoFin || "13:00"}</strong>
                            </div>
                          </div>

                          <div className="pt-1">
                            {countdown.esTarde ? (
                              <div className="w-full text-center px-3 py-2 bg-red-50 border border-red-200 text-red-650 rounded-lg text-xs font-black tracking-widest uppercase animate-pulse">
                                🚨 LATE (+{countdown.texto})
                              </div>
                            ) : (
                              <div className="w-full text-center px-3 py-2 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg text-xs font-black tracking-widest uppercase font-mono">
                                ⏳ RESTA {countdown.texto}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })()}

          {/* TABLA TELEMETRÍA */}
          <div className="overflow-x-auto w-full no-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center w-24 font-mono">FICHA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">COLABORADOR</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">ÁREA / DPTO</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ENTRADA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">SALIDA</th>
                  <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const listaFiltrada = asistenciasHoy.filter(a => (a.nombreCompleto || "").toLowerCase().includes(filtro.toLowerCase()));
                  if (listaFiltrada.length === 0) {
                    return (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-400 font-bold italic text-sm font-mono">
                          Sin registros encontrados
                        </td>
                      </tr>
                    );
                  }

                  const totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina) || 1;
                  const indexInicio = (paginaActual - 1) * itemsPorPagina;
                  const indexFin = paginaActual * itemsPorPagina;
                  const asistenciasPaginadas = listaFiltrada.slice(indexInicio, indexFin);

                  return asistenciasPaginadas.map(reg => {
                    const isRetraso = reg.estatus === "RETRASO";
                    const isBeneficio = reg.estatus === "BENEFICIO";
                    return (
                      <tr key={reg.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-3 text-center font-black text-cyan-600 text-sm font-mono">
                          {reg.ficha}
                        </td>
                        <td className="py-4 px-3 text-left">
                          <strong className="text-sm font-extrabold text-indigo-950 uppercase block">{reg.nombreCompleto}</strong>
                          <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider block mt-0.5 font-mono">{reg.cargo}</span>
                          {reg.salidaAlmuerzo && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                                🍱 Almuerzo: {reg.salidaAlmuerzo} a {reg.entradaAlmuerzo || "--:--"}
                              </span>
                              {reg.minutosAlmuerzoTarde > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-[9px] font-black uppercase tracking-wider font-mono animate-pulse">
                                  ⚠️ Demora: +{reg.minutosAlmuerzoTarde}m
                                </span>
                              )}
                              {reg.salidaAlmuerzo && !reg.entradaAlmuerzo && !reg.salida && (
                                <span className="px-1.5 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded text-[9px] font-black uppercase tracking-wider font-mono">
                                  ⏳ Almorzando
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                         <td className="py-4 px-3 text-left text-xs font-semibold text-slate-500">
                          {reg.area}
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                          <span className="flex items-center justify-center gap-1">
                            <i className="fas fa-sign-in-alt text-emerald-600 text-xxs"></i> {reg.entrada}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-slate-700 text-sm font-mono">
                          {reg.salida ? (
                            <span className="flex items-center justify-center gap-1">
                              <i className="fas fa-sign-out-alt text-red-500 text-xxs"></i> {reg.salida}
                            </span>
                          ) : (
                            <span className="text-slate-400">--:--</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase border inline-block ${
                              reg.estatus === "ABANDONO DE TRABAJO"
                                ? "bg-red-100 text-red-750 border-red-300 animate-pulse"
                                : isRetraso
                                ? "bg-red-50 text-red-650 border-red-200 animate-pulse"
                                : isBeneficio
                                ? "bg-cyan-50 text-cyan-600 border-cyan-205"
                                : "bg-emerald-50 text-emerald-600 border-emerald-200"
                            }`}>
                              {reg.estatus}
                            </span>
                            {reg.salida && (
                              <span className="px-1.5 py-0.5 bg-slate-55/10 border border-slate-200 text-slate-500 rounded text-[9px] font-black tracking-widest uppercase font-mono">
                                FINALIZADO
                              </span>
                            )}
                          </div>
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
            const listaFiltrada = asistenciasHoy.filter(a => (a.nombreCompleto || "").toLowerCase().includes(filtro.toLowerCase()));
            if (listaFiltrada.length <= itemsPorPagina) return null;
            const totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina) || 1;

            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/60 print:hidden">
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest font-mono">
                  Mostrando {((paginaActual - 1) * itemsPorPagina) + 1} - {Math.min(paginaActual * itemsPorPagina, listaFiltrada.length)} de {listaFiltrada.length} registros
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
      </div>

      {/* INDUSTRIAL RESTRICTION MODAL */}
      {mostrarModalBeneficio && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl border border-red-500/60 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl space-y-6 relative shadow-neon-red/10">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

            {/* Alert Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-red-200/60">
              <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center text-red-600 text-2xl animate-pulse">
                <i className="fas fa-exclamation-triangle animate-bounce"></i>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight">Restricción de Acceso</h2>
                <p className="text-3xs font-black text-red-600 uppercase tracking-widest mt-0.5">Acceso Bloqueado por Sistema</p>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 p-4 border border-slate-200 rounded-xl">
                {trabajadorEspecial?.mensajeBloqueo || "El sistema detectó un bloqueo administrativo activo en la ficha de este trabajador. No tiene permitido el acceso para cumplir jornadas laborales ordinarias."}
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xxs font-mono">EMPLEADO</span>
                  <strong className="text-indigo-955 uppercase">{trabajadorEspecial?.nombres} {trabajadorEspecial?.apellidos}</strong>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xxs font-mono">CEDULA_FICHA</span>
                  <strong className="text-red-600 font-black font-mono">{trabajadorEspecial?.cedula} / {trabajadorEspecial?.ficha || "S/F"}</strong>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xxs font-mono">ESTATUS_NOMINAL</span>
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-xxs font-black uppercase tracking-wider font-mono">
                    {trabajadorEspecial?.motivoBloqueo || trabajadorEspecial?.estatus?.toUpperCase()}
                  </span>
                </div>
              </div>

              {!["PASANTÍA CULMINADA", "PERSONAL INACTIVO", "CONTRATISTA SUSPENDIDO", "CONTRATISTA INACTIVO"].includes(trabajadorEspecial?.motivoBloqueo) && (
                <p className="text-xs font-black text-indigo-955 uppercase text-center py-2 border-t border-b border-slate-200/60 font-mono">
                  ¿EL ACCESO ES EXCLUSIVAMENTE PARA RETIRAR BENEFICIOS?
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all duration-200 cursor-pointer"
                onClick={() => { setMostrarModalBeneficio(false); setTrabajadorEspecial(null); }}
              >
                {["PASANTÍA CULMINADA", "PERSONAL INACTIVO", "CONTRATISTA SUSPENDIDO", "CONTRATISTA INACTIVO"].includes(trabajadorEspecial?.motivoBloqueo) ? "Aceptar y Cerrar" : "❌ Denegar Entrada"}
              </button>
              
              {!["PASANTÍA CULMINADA", "PERSONAL INACTIVO", "CONTRATISTA SUSPENDIDO", "CONTRATISTA INACTIVO"].includes(trabajadorEspecial?.motivoBloqueo) && (
                <button 
                  type="button" 
                  className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-450 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all duration-200 cursor-pointer" 
                  onClick={() => ejecutarEntradaExcepcional(trabajadorEspecial)}
                >
                  📦 Permitir Entrada (Retiro)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
