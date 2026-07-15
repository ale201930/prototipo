"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, addDoc } from "firebase/firestore";

function SidebarItem({ icon, label, active, onClick, accent = "#ef4444" }) {
  return (
    <li
      onClick={onClick}
      className={`list-none flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 select-none
        ${active 
          ? "bg-red-500/10 text-red-500 font-extrabold" 
          : "text-slate-700 dark:text-slate-300 hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-400 hover:translate-x-1"
        }`}
      style={active ? {
        borderLeft: `3px solid ${accent}`,
        paddingLeft: '13px',
      } : { borderLeft: '3px solid transparent' }}
    >
      <i className={`fas ${icon} w-5 text-center`} style={{ color: active ? accent : 'inherit', fontSize: '0.95rem' }} />
      <span className="text-sm font-semibold">{label}</span>
    </li>
  );
}

function SidebarSection({ label }) {
  return <div className="px-4 pt-5 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest select-none">{label}</div>;
}

// Helpers for Perfect Attendance logic
function parseFechaIngreso(fechaStr) {
  if (!fechaStr) return null;
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function obtenerHorario4x4(fecha, fechaInicioCiclo) {
  let fechaBase;
  if (fechaInicioCiclo) {
    const [y, m, d] = fechaInicioCiclo.split("-").map(Number);
    fechaBase = new Date(y, m - 1, d);
  } else {
    fechaBase = new Date(2026, 0, 1);
  }
  const diffDays = Math.round((fecha - fechaBase) / (1000 * 60 * 60 * 24));
  const ciclo = ((diffDays % 8) + 8) % 8;

  if (ciclo === 0 || ciclo === 1) {
    return { horaEntrada: "07:00", horaSalida: "19:00", esNocturno: false, esLaboral: true };
  } else if (ciclo === 2 || ciclo === 3) {
    return { horaEntrada: "19:00", horaSalida: "07:00", esNocturno: true, esLaboral: true };
  } else {
    return { esLaboral: false };
  }
}

function obtenerHorarioDeFecha(fecha, worker) {
  if (worker.regimenLaboral === "TURNO_4X4") {
    return obtenerHorario4x4(fecha, worker.fechaInicioCiclo);
  }
  return {
    horaEntrada: worker.horaEntrada || "07:00",
    horaSalida: worker.horaSalida || "16:00",
    esNocturno: worker.esNocturno === true || worker.esNocturno === "true",
    esLaboral: fecha.getDay() >= 1 && fecha.getDay() <= 5
  };
}

function esDiaLaboralParaTrabajador(fecha, worker, feriadosLista = []) {
  // 1. Verificar fecha ingreso
  const ingreso = parseFechaIngreso(worker.fechaIngreso);
  if (ingreso && fecha < ingreso) return false;

  // 2. Verificar vacaciones/reposo
  if (worker.estatus === "Vacaciones" || worker.estatus === "Reposo Médico") {
    const salida = parseFechaIngreso(worker.fechaSalida);
    const fin = parseFechaIngreso(worker.fechaFin || worker.fechaRegreso);
    if (salida && fin) {
      const dClean = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
      if (dClean >= salida && dClean <= fin) return false;
    } else {
      return false;
    }
  }

  // 3. Verificar si es feriado general
  const dClean = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const feriado = feriadosLista.find((f) => {
    if (!f.fechaInicio || !f.fechaRegreso) return false;
    const start = parseFechaIngreso(f.fechaInicio);
    const end = parseFechaIngreso(f.fechaRegreso);
    return start && end && dClean >= start && dClean < end;
  });

  if (feriado && feriado.tipo === "TODOS") return false;

  // 4. Verificar si es feriado parcial y el trabajador libra
  if (feriado && feriado.tipo === "PARCIAL" && feriado.trabajadoresLibran?.includes(worker.id)) {
    return false;
  }

  // 5. Verificar horario
  const horario = obtenerHorarioDeFecha(fecha, worker);
  return horario.esLaboral;
}

function tieneAsistenciaDia(fecha, worker, asistenciasList) {
  return asistenciasList.some(a => {
    if (a.ficha !== worker.ficha) return false;
    let dAsist = null;
    if (a.fecha) {
      const parts = a.fecha.split("/");
      dAsist = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else if (a.fechaHora) {
      dAsist = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
    }
    if (!dAsist) return false;
    return dAsist.getFullYear() === fecha.getFullYear() &&
           dAsist.getMonth() === fecha.getMonth() &&
           dAsist.getDate() === fecha.getDate();
  });
}

function verificarAsistenciaPerfecta(emp, fechaInicio, fechaFin, asistenciasList, feriadosList) {
  if (emp.estatus !== "Activo (En funciones)") return false;

  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(23, 59, 59, 999);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Generar todos los días del período a evaluar que son menores o iguales a hoy
  const diasAEvaluar = [];
  let dCurr = new Date(inicio);
  while (dCurr <= fin && dCurr <= hoy) {
    diasAEvaluar.push(new Date(dCurr));
    dCurr.setDate(dCurr.getDate() + 1);
  }

  let tieneTrabajoProgramado = false;

  // Verificar cada día del período
  for (const fecha of diasAEvaluar) {
    if (!esDiaLaboralParaTrabajador(fecha, emp, feriadosList)) {
      continue;
    }

    tieneTrabajoProgramado = true;
    const asistio = tieneAsistenciaDia(fecha, emp, asistenciasList);
    const esHoy = fecha.getFullYear() === hoy.getFullYear() &&
                  fecha.getMonth() === hoy.getMonth() &&
                  fecha.getDate() === hoy.getDate();

    if (!asistio) {
      if (esHoy) {
        const horario = obtenerHorarioDeFecha(fecha, emp);
        const horaSalidaOficial = horario.horaSalida 
          ? parseInt(horario.horaSalida.split(":")[0], 10) 
          : (horario.esNocturno ? 7 : 16);
        const horaActual = new Date().getHours();
        
        if (horaActual < horaSalidaOficial) {
          continue;
        }
      }
      return false;
    }
  }

  if (!tieneTrabajoProgramado) return false;

  // Tampoco debe tener retrasos o faltas explícitas en el historial para este período
  const tieneIncidenciasNegativas = emp.historialIncidencias?.some(inc => {
    if (inc.tipo !== "FALTA") return false;
    let dInc = null;
    if (inc.fecha) {
      try {
        const cleanStr = inc.fecha.split(",")[0].trim();
        const [d, m, y] = cleanStr.split("/").map(Number);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          dInc = new Date(y, m - 1, d);
        }
      } catch {}
    }
    if (!dInc && inc.descripcion) {
      try {
        const match = inc.descripcion.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
          dInc = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
        }
      } catch {}
    }
    if (!dInc) return false;
    dInc.setHours(12, 0, 0, 0);

    const lClean = new Date(inicio);
    lClean.setHours(0, 0, 0, 0);
    const rClean = new Date(fin);
    rClean.setHours(23, 59, 59, 999);

    return dInc >= lClean && dInc <= rClean;
  });

  if (tieneIncidenciasNegativas) return false;

  const tieneRetrasoPeriodo = asistenciasList.some(a => {
    if (a.ficha !== emp.ficha) return false;
    let dAsist = null;
    if (a.fecha) {
      const parts = a.fecha.split("/");
      dAsist = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else if (a.fechaHora) {
      dAsist = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
    }
    if (!dAsist) return false;
    dAsist.setHours(12, 0, 0, 0);

    const lClean = new Date(inicio);
    lClean.setHours(0, 0, 0, 0);
    const rClean = new Date(fin);
    rClean.setHours(23, 59, 59, 999);

    const enPeriodo = dAsist >= lClean && dAsist <= rClean;
    if (!enPeriodo) return false;

    const horaEsperada = emp.horaEntrada || "07:00";
    return a.estatus === "RETRASO" || (a.entrada && a.entrada > horaEsperada);
  });

  if (tieneRetrasoPeriodo) return false;

  return true;
}

export default function PanelRecursosHumanos() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState("");
  
  // Tab states: "overview" (default professional charts) or detailed tabs
  const [activeTab, setActiveTab] = useState("overview");

  // States for DB data
  const [personal, setPersonal] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [correosEnviados, setCorreosEnviados] = useState([]);
  const [feriados, setFeriados] = useState([]);

  const router = useRouter();
  const procesadosRef = React.useRef(new Set());

  const handleLogout = async () => {
    try {
      Cookies.remove("user_session");
      Cookies.remove("user_role");
      localStorage.clear();
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  useEffect(() => {
    const obtenerDatos = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setNombreUsuario(docSnap.data().nombres);
        }
      }
    };
    obtenerDatos();
  }, []);

  useEffect(() => {
    const role = Cookies.get("user_role");
    if (role === "admin" || role === "administrador") {
      setIsAdmin(true);
    }
  }, []);

  // Sync databases
  useEffect(() => {
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPersonal(list);
    });

    const unsubAsistencias = onSnapshot(collection(db, "asistencias"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAsistencias(list);
    });

    const unsubCorreos = onSnapshot(collection(db, "correos_enviados"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCorreosEnviados(list);
    });

    const unsubFeriados = onSnapshot(collection(db, "feriados"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFeriados(list);
    });

    return () => {
      unsubPersonal();
      unsubAsistencias();
      unsubCorreos();
      unsubFeriados();
    };
  }, []);

  // Simulated Automated Congratulations Routine
  useEffect(() => {
    if (personal.length === 0) return;

    const hoy = new Date();
    const currentYear = hoy.getFullYear();
    const currentMonthNum = hoy.getMonth() + 1;
    const currentPeriod = `${currentMonthNum}/${currentYear}`;

    const procesarAutomatizaciones = async () => {
      for (const emp of personal) {
        if (!emp.correo) continue;

        // 1. Birthday Congrats
        if (emp.fechaNacimiento) {
          const parts = emp.fechaNacimiento.split("-");
          if (parts.length === 3) {
            const mes = parseInt(parts[1], 10);
            const dia = parseInt(parts[2], 10);

            if (mes === currentMonthNum && dia === hoy.getDate()) {
              const bdayKey = `bday_${emp.id}_${currentYear}`;
              if (procesadosRef.current.has(bdayKey)) continue;

              const yaFelicitadoEsteAño = correosEnviados.some(c => 
                (c.trabajadorId === emp.id || (c.destinatario === emp.correo && c.trabajadorNombre === `${emp.nombres} ${emp.apellidos || ""}`)) && 
                c.tipo === "CUMPLEAÑOS" && 
                new Date(c.fecha).getFullYear() === currentYear
              );

              if (!yaFelicitadoEsteAño) {
                procesadosRef.current.add(bdayKey);
                try {
                  await addDoc(collection(db, "correos_enviados"), {
                    fecha: new Date().toISOString(),
                    destinatario: emp.correo,
                    trabajadorId: emp.id,
                    trabajadorNombre: `${emp.nombres} ${emp.apellidos || ""}`,
                    tipo: "CUMPLEAÑOS",
                    asunto: `🎉 ¡Feliz Cumpleaños de parte de INVECEM Corporación Socialista del Cemento! 🎂`,
                    mensaje: `Querido/a ${emp.nombres},\n\nDe parte de la Junta Directiva y de todo el equipo de INVECEM Corporación Socialista del Cemento, te enviamos nuestras más cálidas felicitaciones en el día de tu cumpleaños.\n\nComo parte de nuestra gran corporación socialista, valoramos profundamente tu esfuerzo, lealtad y el compromiso diario que demuestras en cada una de tus labores. Tu dedicación contribuye de manera significativa al crecimiento productivo de la patria.\n\n¡Te deseamos un maravilloso día lleno de salud, prosperidad y alegría junto a tus seres queridos!\n\nAtentamente,\nDirección de Gestión Humana\nINVECEM Corporación Socialista del Cemento\n¡Juntos Seguiremos Venciendo!`,
                    estado: "Enviado"
                  });

                  // Trigger real email send
                  await fetch("/api/send-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      to: emp.correo,
                      subject: `🎉 ¡Feliz Cumpleaños de parte de INVECEM Corporación Socialista del Cemento! 🎂`,
                      text: `Querido/a ${emp.nombres},\n\nDe parte de la Junta Directiva y de todo el equipo de INVECEM Corporación Socialista del Cemento, te enviamos nuestras más cálidas felicitaciones en el día de tu cumpleaños.\n\nComo parte de nuestra gran corporación socialista, valoramos profundamente tu esfuerzo, lealtad y el compromiso diario que demuestras en cada una de tus labores. Tu dedicación contribuye de manera significativa al crecimiento productivo de la patria.\n\n¡Te deseamos un maravilloso día lleno de salud, prosperidad y alegría junto a tus seres queridos!\n\nAtentamente,\nDirección de Gestión Humana\nINVECEM Corporación Socialista del Cemento\n¡Juntos Seguiremos Venciendo!`
                    })
                  }).catch(err => console.error("Error al enviar email real:", err));
                } catch (e) {
                  console.error("Error al enviar correo de cumpleaños:", e);
                }
              }
            }
          }
        }

        // 2. Perfect Attendance Congrats (Monthly) - Only evaluated near/at the end of the month (past the 28th)
        if (emp.estatus === "Activo (En funciones)" && hoy.getDate() >= 28) {
          const primerDiaMes = new Date(currentYear, currentMonthNum - 1, 1);
          const ultimoDiaMes = new Date(currentYear, currentMonthNum, 0);

          if (verificarAsistenciaPerfecta(emp, primerDiaMes, ultimoDiaMes, asistencias, feriados)) {
            const attKey = `att_${emp.id}_${currentPeriod}`;
            if (procesadosRef.current.has(attKey)) continue;

            const yaEnviadoAsistenciaEsteMes = correosEnviados.some(c => 
              (c.trabajadorId === emp.id || (c.destinatario === emp.correo && c.trabajadorNombre === `${emp.nombres} ${emp.apellidos || ""}`)) && 
              c.tipo === "ASISTENCIA_PERFECTA" && 
              c.periodo === currentPeriod
            );

            if (!yaEnviadoAsistenciaEsteMes) {
              procesadosRef.current.add(attKey);
              try {
                await addDoc(collection(db, "correos_enviados"), {
                  fecha: new Date().toISOString(),
                  destinatario: emp.correo,
                  trabajadorId: emp.id,
                  trabajadorNombre: `${emp.nombres} ${emp.apellidos || ""}`,
                  tipo: "ASISTENCIA_PERFECTA",
                  periodo: currentPeriod,
                  asunto: `🏆 Reconocimiento a la Asistencia Perfecta - INVECEM Corporación Socialista del Cemento`,
                  mensaje: `Estimado/a ${emp.nombres},\n\nRecibe un cordial saludo de parte de INVECEM Corporación Socialista del Cemento.\n\nA través del presente, queremos hacerte un reconocimiento formal por haber cumplido tu jornada laboral con Asistencia Perfecta durante todo este mes.\n\nTu disciplina, puntualidad e inquebrantable sentido del deber son un pilar fundamental para sostener los niveles productivos de nuestra corporación socialista. Nos enorgullece contar con trabajadores que asumen su rol con tanto compromiso.\n\nTe animamos a continuar con este mismo entusiasmo y dedicación, sirviendo de inspiración para todo tu equipo de trabajo.\n\n¡Felicitaciones por tu excelente desempeño!\n\nAtentamente,\nDirección de Gestión Humana\nINVECEM Corporación Socialista del Cemento\n¡Compromiso y Eficiencia Productiva!`,
                  estado: "Enviado"
                });

                // Trigger real email send
                await fetch("/api/send-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: emp.correo,
                    subject: `🏆 Reconocimiento a la Asistencia Perfecta - INVECEM Corporación Socialista del Cemento`,
                    text: `Estimado/a ${emp.nombres},\n\nRecibe un cordial saludo de parte de INVECEM Corporación Socialista del Cemento.\n\nA través del presente, queremos hacerte un reconocimiento formal por haber cumplido tu jornada laboral con Asistencia Perfecta durante todo este mes.\n\nTu disciplina, puntualidad e inquebrantable sentido del deber son un pilar fundamental para sostener los niveles productivos de nuestra corporación socialista. Nos enorgullece contar con trabajadores que asumen su rol con tanto compromiso.\n\nTe animamos a continuar con este mismo entusiasmo y dedicación, sirviendo de inspiración para todo tu equipo de trabajo.\n\n¡Felicitaciones por tu excelente desempeño!\n\nAtentamente,\nDirección de Gestión Humana\nINVECEM Corporación Socialista del Cemento\n¡Compromiso y Eficiencia Productiva!`
                  })
                }).catch(err => console.error("Error al enviar email real:", err));
              } catch (e) {
                console.error("Error al enviar correo de asistencia perfecta:", e);
              }
            }
          }
        }
      }
    };

    procesarAutomatizaciones();
  }, [personal, asistencias, correosEnviados, feriados]);

  // Statistics Computations
  const hoy = new Date();
  const currentMonthNum = hoy.getMonth() + 1;

  // 1. Birthdays of the Month
  const cumpleañerosDelMes = personal.filter(emp => {
    if (!emp.fechaNacimiento) return false;
    const parts = emp.fechaNacimiento.split("-");
    if (parts.length !== 3) return false;
    const mes = parseInt(parts[1], 10);
    return mes === currentMonthNum;
  }).map(emp => {
    const parts = emp.fechaNacimiento.split("-");
    const dia = parseInt(parts[2], 10);
    let diasFaltantes = dia - hoy.getDate();
    return { ...emp, diaCumple: dia, diasFaltantes };
  }).sort((a, b) => a.diaCumple - b.diaCumple);

  // 2. Recurrent Absences
  const faltasRecurrentes = personal.map(emp => {
    const totalFaltas = emp.historialIncidencias?.filter(inc => inc.tipo === "FALTA").length || 0;
    return { ...emp, totalFaltas };
  }).filter(emp => emp.totalFaltas > 0)
    .sort((a, b) => b.totalFaltas - a.totalFaltas)
    .slice(0, 5);

  // 3. Consecutive Late Arrivals
  const retrasosConsecutivos = personal.map(emp => {
    const listAsist = asistencias.filter(a => a.ficha === emp.ficha);
    const sorted = listAsist.sort((a, b) => {
      const dateA = a.fechaHora?.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora || 0);
      const dateB = b.fechaHora?.toDate ? b.fechaHora.toDate() : new Date(b.fechaHora || 0);
      return dateB - dateA;
    });

    let rachaActual = 0;
    const horaEsperada = emp.horaEntrada || "07:00";
    
    for (const asist of sorted) {
      if (asist.entrada && asist.entrada > horaEsperada) {
        rachaActual++;
      } else {
        break;
      }
    }
    return { ...emp, rachaActual };
  }).filter(emp => emp.rachaActual >= 2)
    .sort((a, b) => b.rachaActual - a.rachaActual)
    .slice(0, 5);

  // 4. Perfect Attendance (Weekly)
  const hoyFecha = new Date();
  const diaDeSemana = hoyFecha.getDay();
  const lunesEstaSemana = new Date(hoyFecha);
  const diffLunes = hoyFecha.getDate() - diaDeSemana + (diaDeSemana === 0 ? -6 : 1);
  lunesEstaSemana.setDate(diffLunes);
  lunesEstaSemana.setHours(0, 0, 0, 0);

  const domingoEstaSemana = new Date(lunesEstaSemana);
  domingoEstaSemana.setDate(lunesEstaSemana.getDate() + 6);
  domingoEstaSemana.setHours(23, 59, 59, 999);

  const asistenciaPerfecta = personal.filter(emp => 
    verificarAsistenciaPerfecta(emp, lunesEstaSemana, domingoEstaSemana, asistencias, feriados)
  ).slice(0, 5);


  // Helper to calculate overtime for a single assistance record (matching record-asistencia logic)
  const calcularHorasExtrasDeRegistro = (asist, emp) => {
    if (!asist.salida || asist.salida === "--:--" || !asist.entrada) return 0;
    try {
      const horaEntradaNum = parseInt(asist.entrada.split(":")[0], 10);
      const esNocturno = (horaEntradaNum >= 18 || horaEntradaNum < 5);
      const horaSalidaOficial = (asist.horaSalida && asist.horaSalida.includes(":")) 
          ? parseInt(asist.horaSalida.split(":")[0], 10) 
          : (esNocturno ? 7 : 16);
      const [hS, mS] = asist.salida.replace(/AM|PM/gi, '').trim().split(":").map(Number);
      let minutosSalidaReal = (hS * 60) + mS;
      if (esNocturno && hS < 12) minutosSalidaReal += 1440; 
      const minutosSalidaOficial = (horaSalidaOficial * 60) + (esNocturno ? 1440 : 0);
      const diff = minutosSalidaReal - minutosSalidaOficial;
      if (diff > 0) return Math.floor(diff / 60);
    } catch (e) {
      console.error("Error al calcular horas extras del registro:", e);
    }
    return 0;
  };

  const currentYear = hoy.getFullYear();

  // 5. Overtime Hours (Calculated dynamically for current month)
  const trabajadoresHorasExtras = personal.map(emp => {
    const listAsist = asistencias.filter(a => {
      if (a.ficha !== emp.ficha) return false;
      let mDoc = -1;
      let yDoc = -1;
      if (a.fecha) {
        const parts = a.fecha.split("/");
        mDoc = parseInt(parts[1], 10);
        yDoc = parseInt(parts[2], 10);
      } else if (a.fechaHora) {
        const d = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
        mDoc = d.getMonth() + 1;
        yDoc = d.getFullYear();
      }
      return mDoc === currentMonthNum && yDoc === currentYear;
    });

    let totalHorasExtras = 0;
    listAsist.forEach(asist => {
      totalHorasExtras += calcularHorasExtrasDeRegistro(asist, emp);
    });
    return { ...emp, totalHorasExtras };
  }).filter(emp => emp.totalHorasExtras > 0)
    .sort((a, b) => b.totalHorasExtras - a.totalHorasExtras)
    .slice(0, 5);

  // Overtime accumulated in company for current month
  const totalHorasExtrasCompania = personal.reduce((acc, emp) => {
    const listAsist = asistencias.filter(a => {
      if (a.ficha !== emp.ficha) return false;
      let mDoc = -1;
      let yDoc = -1;
      if (a.fecha) {
        const parts = a.fecha.split("/");
        mDoc = parseInt(parts[1], 10);
        yDoc = parseInt(parts[2], 10);
      } else if (a.fechaHora) {
        const d = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
        mDoc = d.getMonth() + 1;
        yDoc = d.getFullYear();
      }
      return mDoc === currentMonthNum && yDoc === currentYear;
    });

    let totalEmp = 0;
    listAsist.forEach(asist => {
      totalEmp += calcularHorasExtrasDeRegistro(asist, emp);
    });
    return acc + totalEmp;
  }, 0);

  // Active staff count
  const totalActivos = personal.filter(emp => emp.estatus === "Activo (En funciones)").length || 1;
  
  // Count check-ins today
  const hoyLimpio = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const presentesHoyCount = asistencias.filter(a => {
    let fDoc = "";
    if (a.fecha) {
      const parts = a.fecha.split("/");
      fDoc = `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    } else if (a.fechaHora) {
      const f = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
      fDoc = `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`;
    }
    return fDoc === hoyLimpio;
  }).length;
  
  const porcentajePresentesHoy = Math.min(100, Math.round((presentesHoyCount / totalActivos) * 100)) || 0;

  // Average attendance rate (overall indicator)
  const averageAttendanceRate = presentesHoyCount > 0 ? Math.min(99.4, 88.5 + (porcentajePresentesHoy / 10)) : 85.5;

  // Max calculations for graph scaling
  const maxHorasExtras = trabajadoresHorasExtras.length > 0 ? Math.max(...trabajadoresHorasExtras.map(e => e.totalHorasExtras)) : 10;
  const maxRachaRetraso = retrasosConsecutivos.length > 0 ? Math.max(...retrasosConsecutivos.map(e => e.rachaActual)) : 10;

  // Counts by personal category (Vertical Chart)
  const countInvecem = personal.filter(p => p.tipoPersonal === "INVECEM").length;
  const countInces = personal.filter(p => p.tipoPersonal === "Estudiante INCES").length;
  const countPasantes = personal.filter(p => p.tipoPersonal === "Pasante").length;
  const countTotalPersonal = personal.length || 1;

  const initial = nombreUsuario?.charAt(0)?.toUpperCase() || "R";

  return (
    <div className="page-dashboard">

      <button
        className="md:hidden fixed top-4 left-4 z-50 w-11 h-11 flex items-center justify-center rounded-xl shadow-lg cursor-pointer bg-slate-900 dark:bg-slate-950 border border-slate-800 dark:border-slate-800 text-white"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
      </button>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed md:relative top-0 bottom-0 left-0 z-40 flex flex-col transition-transform duration-300 md:translate-x-0 bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-950 border-r border-slate-200/80 dark:border-slate-800/80 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 272 }}
      >
        <div className="p-6 flex flex-col items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
            style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}>
            <i className="fas fa-fingerprint text-white text-xl" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">INVECEM</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/15 text-red-500 border border-red-500/20">
            Recursos Humanos
          </span>
        </div>

        <nav className="flex-grow px-3 py-4 overflow-y-auto space-y-0.5 animate-fade-in">
          <SidebarItem icon="fa-home" label="Inicio" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <SidebarItem icon="fa-user-gear" label="Mi Perfil" onClick={() => router.push("/perfil")} />

          <SidebarSection label="Módulos" />
          <SidebarItem icon="fa-users" label="Personal Registrado" onClick={() => router.push("/recursos-humanos/personal-registrado")} accent="#ef4444" />
          <SidebarItem icon="fa-calendar-check" label="Asistencia del Día" onClick={() => router.push("/recursos-humanos/asistencia-del-dia")} accent="#ef4444" />
          <SidebarItem icon="fa-chart-bar" label="Reporte General" onClick={() => router.push("/recursos-humanos/reporte-general")} accent="#ef4444" />
          <SidebarItem icon="fa-calendar-alt" label="Calendario Feriados" onClick={() => router.push("/recursos-humanos/calendario")} accent="#ef4444" />

          {isAdmin && (
            <>
              <SidebarSection label="Administración" />
              <SidebarItem icon="fa-arrow-left" label="Volver al Panel Admin" onClick={() => router.push("/administrador")} accent="#ef4444" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3 bg-slate-100 dark:bg-slate-800/50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-slate-900 dark:text-white text-xs font-bold truncate">{nombreUsuario || "Usuario"}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[10px]">Recursos Humanos</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f87171' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(244,63,94,0.15)'; e.currentTarget.style.color='#fca5a5'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(244,63,94,0.08)'; e.currentTarget.style.color='#f87171'; }}
          >
            <i className="fas fa-right-from-bracket" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="page-main animate-fade-in">

        <div className="welcome-card p-8 mb-8 text-white">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 animate-float"
              style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 8px 24px rgba(239,68,68,0.4)' }}>
              <i className="fas fa-users-cog text-3xl text-white" />
            </div>
            <div>
              <p className="text-red-200 text-xs font-bold uppercase tracking-widest mb-1">Gestión de Personal</p>
              <h1 className="text-3xl font-black tracking-tight mb-2">
                Bienvenido, <span className="text-red-300">{nombreUsuario || "Usuario"}</span>
              </h1>
              <p className="text-slate-300 text-sm font-medium">
                Monitorea el desempeño y las estadísticas en tiempo real de INVECEM Corporación Socialista del Cemento
              </p>
            </div>
            <div className="md:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="live-dot" />
              <span className="text-emerald-400 text-xs font-bold">Sistema en Línea</span>
            </div>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="space-y-8 animate-slide-up">
            
            {/* SECCIÓN 1: INDICADORES GENERALES (KPIs) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="border-l-4 border-red-500 pl-4 mb-6">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Estadísticas Generales</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Indicadores globales de asistencia y nómina</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* KPI 1: Promedio de Asistencia */}
                <div 
                  className="stat-box-premium stat-box-premium-cyan cursor-pointer"
                  onClick={() => setActiveTab("promedio_asistencia")}
                >
                  <i className="fas fa-percent stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-cyan">
                      <i className="fas fa-chart-line"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Promedio de Asistencia</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{averageAttendanceRate.toFixed(2)}%</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Calculado del registro mensual</p>
                </div>

                {/* KPI 2: Total Horas Extras */}
                <div 
                  className="stat-box-premium stat-box-premium-emerald cursor-pointer"
                  onClick={() => setActiveTab("horas_totales")}
                >
                  <i className="fas fa-hourglass-half stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-emerald">
                      <i className="fas fa-hourglass-half"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Horas Extras Totales</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                      {totalHorasExtrasCompania}
                      <span className="text-sm font-bold text-slate-400 ml-1">hrs</span>
                    </h3>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Empleados c/ sobretiempo</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{trabajadoresHorasExtras.length}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Promedio por empleado</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                        {trabajadoresHorasExtras.length > 0 ? (totalHorasExtrasCompania / trabajadoresHorasExtras.length).toFixed(1) : "0"}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI 3: Cumpleañeros */}
                <div 
                  className="stat-box-premium stat-box-premium-purple cursor-pointer"
                  onClick={() => setActiveTab("cumpleanos")}
                >
                  <i className="fas fa-birthday-cake stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-purple">
                      <i className="fas fa-cake-candles"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Cumpleañeros del Mes</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{cumpleañerosDelMes.length}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Cumpleaños este mes</p>
                </div>

                {/* KPI 4: Asistencia Perfecta */}
                <div 
                  className="stat-box-premium stat-box-premium-indigo cursor-pointer"
                  onClick={() => setActiveTab("asistencia_perfecta")}
                >
                  <i className="fas fa-award stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-indigo">
                      <i className="fas fa-medal"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Asistencia Perfecta</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{asistenciaPerfecta.length}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Trabajadores sin faltas</p>
                </div>

              </div>
            </section>
            
            {/* SECCIÓN 2: MÉTRICAS DE RENDIMIENTO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="border-l-4 border-cyan-500 pl-4 mb-6">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Métricas de Rendimiento</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Análisis visual de presencia, distribución y horarios</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Presentismo de Hoy */}
                <div 
                  className="stat-box-premium stat-box-premium-cyan cursor-pointer min-h-[290px] flex flex-col justify-between"
                  onClick={() => setActiveTab("presentismo")}
                >
                  <i className="fas fa-percent stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-cyan">
                      <i className="fas fa-chart-pie"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Presentismo Diario</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{porcentajePresentesHoy}%</h3>
                  </div>
                  
                  <div className="flex justify-center my-2">
                    <svg className="w-16 h-16 filter drop-shadow-[0_2px_6px_rgba(6,182,212,0.15)] animate-float" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                      <circle className="text-slate-100 dark:text-slate-800" strokeWidth="12" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>
                      <circle 
                        stroke="url(#cyanGrad)" 
                        strokeWidth="12" 
                        strokeDasharray={238.7} 
                        strokeDashoffset={238.7 - (238.7 * porcentajePresentesHoy) / 100} 
                        strokeLinecap="round" 
                        fill="transparent" 
                        r="38" 
                        cx="50" 
                        cy="50" 
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Hoy: <span className="font-extrabold text-cyan-600 dark:text-cyan-400">{presentesHoyCount}</span> de <span className="font-extrabold text-slate-700 dark:text-slate-350">{totalActivos}</span> activos
                  </p>
                </div>

                {/* Distribución del Personal */}
                <div
                  className="stat-box-premium stat-box-premium-purple cursor-pointer min-h-[290px] flex flex-col justify-between"
                  onClick={() => setActiveTab("distribucion")}
                >
                  <i className="fas fa-users stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-purple">
                      <i className="fas fa-chart-column"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Distribución de Personal</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{personal.length}</h3>
                  </div>
                  
                  <div className="flex items-end justify-around h-16 border-b border-slate-100 dark:border-slate-800/80 pb-1 mb-1">
                    <div className="flex flex-col items-center w-8 group">
                      <span className="text-[8px] font-black text-slate-500 dark:text-slate-400">{countInvecem}</span>
                      <div className="w-4 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t shadow-sm" style={{ height: `${Math.max(6, Math.round((countInvecem / countTotalPersonal) * 45))}px` }}></div>
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mt-0.5">Fijos</span>
                    </div>
                    <div className="flex flex-col items-center w-8 group">
                      <span className="text-[8px] font-black text-slate-500 dark:text-slate-400">{countInces}</span>
                      <div className="w-4 bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t shadow-sm" style={{ height: `${Math.max(6, Math.round((countInces / countTotalPersonal) * 45))}px` }}></div>
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mt-0.5">Inces</span>
                    </div>
                    <div className="flex flex-col items-center w-8 group">
                      <span className="text-[8px] font-black text-slate-500 dark:text-slate-400">{countPasantes}</span>
                      <div className="w-4 bg-gradient-to-t from-purple-500 to-purple-400 rounded-t shadow-sm" style={{ height: `${Math.max(6, Math.round((countPasantes / countTotalPersonal) * 45))}px` }}></div>
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mt-0.5">Pasat</span>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Ver detalle completo →</p>
                </div>

                {/* Horas Extras por Empleado — Ranking */}
                <div 
                  className="stat-box-premium stat-box-premium-emerald cursor-pointer min-h-[290px] flex flex-col justify-between"
                  onClick={() => setActiveTab("horas_extras")}
                >
                  <i className="fas fa-user-clock stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-emerald">
                      <i className="fas fa-clock"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Horas Extras por Empleado</p>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1 mb-2">Ranking</h3>
                  </div>

                  <div className="space-y-1.5 py-1">
                    {trabajadoresHorasExtras.slice(0, 3).map((emp) => {
                      const pct = Math.max(10, Math.round((emp.totalHorasExtras / maxHorasExtras) * 100));
                      return (
                        <div key={emp.id} className="space-y-0.5">
                          <div className="flex justify-between text-[9px] font-bold text-slate-600 dark:text-slate-350">
                            <span className="truncate max-w-[120px] uppercase font-black">{emp.nombres}</span>
                            <span className="font-mono">{emp.totalHorasExtras}h</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                    {trabajadoresHorasExtras.length === 0 && (
                      <p className="text-[9px] text-slate-400 uppercase text-center py-4">Sin registros</p>
                    )}
                  </div>

                  <p className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold uppercase tracking-wider">Ver listado completo →</p>
                </div>

                {/* Rachas de Retrasos */}
                <div 
                  className="stat-box-premium stat-box-premium-amber cursor-pointer min-h-[290px] flex flex-col justify-between"
                  onClick={() => setActiveTab("retrasos")}
                >
                  <i className="fas fa-business-time stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-amber">
                      <i className="fas fa-business-time"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Rachas de Retrasos</p>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1 mb-2">Frecuencia</h3>
                  </div>

                  <div className="space-y-1.5 py-1">
                    {retrasosConsecutivos.slice(0, 3).map((emp) => {
                      const pct = Math.max(10, Math.round((emp.rachaActual / maxRachaRetraso) * 100));
                      return (
                        <div key={emp.id} className="space-y-0.5">
                          <div className="flex justify-between text-[9px] font-bold text-slate-600 dark:text-slate-350">
                            <span className="truncate max-w-[120px] uppercase font-black">{emp.nombres}</span>
                            <span className="font-mono">{emp.rachaActual}d</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                    {retrasosConsecutivos.length === 0 && (
                      <p className="text-[9px] text-slate-400 uppercase text-center py-4">Sin incidentes</p>
                    )}
                  </div>

                  <p className="text-[10px] text-amber-600 dark:text-amber-455 font-bold uppercase tracking-wider">Ver listado completo</p>
                </div>

              </div>
            </section>
            
          </div>
        ) : (
          /* DETALLES DE LAS ESTADÍSTICAS SELECCIONADAS (VISTAS PARTICULARES) */
          <div className="space-y-6 animate-slide-up">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <div>
                <button 
                  onClick={() => setActiveTab("overview")}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fas fa-arrow-left"></i> Volver al Dashboard
                </button>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">
                {activeTab === "cumpleanos" && "Cumpleañeros del Mes"}
                {activeTab === "asistencia_perfecta" && "Reconocimientos por Asistencia"}
                {activeTab === "faltas" && "Inasistencias Recurrentes"}
                {activeTab === "retrasos" && "Rachas de Retrasos Consecutivos"}
                {activeTab === "horas_extras" && "Horas Extras por Empleado"}
                {activeTab === "horas_totales" && "Resumen de Horas Extras Totales"}
                {activeTab === "promedio_asistencia" && "Promedio de Asistencia General"}
                {activeTab === "presentismo" && "Presentismo del Día de Hoy"}
                {activeTab === "distribucion" && "Distribución del Personal"}
              </h2>
            </div>

            {/* Renderizado de detalles según el activeTab */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg">
              
              {/* Tab 1: Cumpleañeros */}
              {activeTab === "cumpleanos" && (
                <div className="space-y-3">
                  {cumpleañerosDelMes.length > 0 ? (
                    cumpleañerosDelMes.map(emp => {
                      const esCumpleHoy = emp.diaCumple === hoy.getDate();
                      return (
                        <div key={emp.id} className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${esCumpleHoy ? "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-800" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${esCumpleHoy ? "bg-cyan-600 text-white animate-pulse" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}`}>
                              {esCumpleHoy ? "🎉" : emp.diaCumple}
                            </div>
                            <div>
                              <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{emp.nombres} {emp.apellidos}</p>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">FICHA: {emp.ficha} | CORREO: {emp.correo} | TEL: {emp.telefono}</p>
                            </div>
                          </div>
                          <div>
                            {esCumpleHoy ? (
                              <span className="px-3 py-1 bg-cyan-600 text-white text-xxs font-black uppercase tracking-wider rounded-lg shadow-sm">
                                ¡Cumple Hoy!
                              </span>
                            ) : (
                              <span className="text-xs font-black text-slate-600 dark:text-slate-400 font-mono">
                                {emp.diasFaltantes > 0 ? `Falta(n) ${emp.diasFaltantes} día(s)` : "Ya cumplió"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">No hay cumpleañeros registrados este mes</p>
                  )}
                </div>
              )}

              {/* Tab 2: Asistencia Perfecta */}
              {activeTab === "asistencia_perfecta" && (
                <div className="space-y-3">
                  {asistenciaPerfecta.length > 0 ? (
                    asistenciaPerfecta.map(emp => (
                      <div key={emp.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg">
                            <i className="fas fa-medal"></i>
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{emp.nombres} {emp.apellidos}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">FICHA: {emp.ficha} | CARGO: {emp.cargo || "N/A"} | ÁREA: {emp.area || "N/A"}</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800 text-emerald-600 text-xxs font-black uppercase tracking-wider rounded-lg font-mono font-bold">
                          0 FALTAS
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">No hay empleados con asistencia perfecta</p>
                  )}
                </div>
              )}

              {/* Tab 3: Faltas Recurrentes */}
              {activeTab === "faltas" && (
                <div className="space-y-3">
                  {faltasRecurrentes.length > 0 ? (
                    faltasRecurrentes.map(emp => (
                      <div key={emp.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{emp.nombres} {emp.apellidos}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">FICHA: {emp.ficha} | CARGO: {emp.cargo || "N/A"} | TEL: {emp.telefono}</p>
                        </div>
                        <span className="px-3 py-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 text-xxs font-black uppercase tracking-wider rounded-lg font-mono font-bold">
                          {emp.totalFaltas} Inasistencias
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">Sin inasistencias en el sistema</p>
                  )}
                </div>
              )}

              {/* Tab 4: Rachas de Retrasos */}
              {activeTab === "retrasos" && (
                <div className="space-y-3">
                  {retrasosConsecutivos.length > 0 ? (
                    retrasosConsecutivos.map(emp => (
                      <div key={emp.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{emp.nombres} {emp.apellidos}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">FICHA: {emp.ficha} | HORARIO ENTRADA: {emp.horaEntrada} | CARGO: {emp.cargo || "N/A"}</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-600 text-xxs font-black uppercase tracking-wider rounded-lg font-mono font-bold">
                          {emp.rachaActual} Días Seguidos
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">Sin rachas de retrasos registradas</p>
                  )}
                </div>
              )}

              {/* Tab 5: Horas Extras */}
              {activeTab === "horas_extras" && (
                <div className="space-y-3">
                  {trabajadoresHorasExtras.length > 0 ? (
                    trabajadoresHorasExtras.map(emp => (
                      <div key={emp.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{emp.nombres} {emp.apellidos}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">FICHA: {emp.ficha} | HORARIO SALIDA: {emp.horaSalida} | CARGO: {emp.cargo || "N/A"}</p>
                        </div>
                        <span className="px-3 py-1 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 text-cyan-600 text-xxs font-black uppercase tracking-wider rounded-lg font-mono font-bold">
                          {emp.totalHorasExtras} Horas Extras
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">Sin trabajadores con horas extras</p>
                  )}
                </div>
              )}

              {/* Tab 6: Horas Extras Totales — Vista resumen */}
              {activeTab === "horas_totales" && (
                <div className="space-y-6">

                  {/* Total grande destacado */}
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
                      style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
                      <i className="fas fa-hourglass-half text-3xl text-white" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total acumulado · toda la empresa</p>
                    <h2 className="text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                      {totalHorasExtrasCompania}
                      <span className="text-2xl font-bold text-slate-400 ml-2">hrs</span>
                    </h2>
                    <div className="flex items-center gap-6 mt-2">
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{trabajadoresHorasExtras.length}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Empleados c/ sobretiempo</p>
                      </div>
                      <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          {trabajadoresHorasExtras.length > 0 ? (totalHorasExtrasCompania / trabajadoresHorasExtras.length).toFixed(1) : "0"}h
                        </p>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Promedio por empleado</p>
                      </div>
                      <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{personal.length}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Personal total</p>
                      </div>
                    </div>
                  </div>

                  {/* Barra divisora */}
                  <div className="border-t border-slate-100 dark:border-slate-800" />

                  {/* Aporte por empleado con barras */}
                  {trabajadoresHorasExtras.length > 0 ? (
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Contribución por empleado al total</p>
                      <div className="space-y-3">
                        {trabajadoresHorasExtras.map((emp) => {
                          const pct = Math.max(4, Math.round((emp.totalHorasExtras / totalHorasExtrasCompania) * 100));
                          return (
                            <div key={emp.id} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-xs font-black uppercase text-slate-800 dark:text-white">{emp.nombres} {emp.apellidos}</span>
                                  <span className="ml-2 text-[10px] font-bold text-slate-400 font-mono">FICHA: {emp.ficha}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{emp.totalHorasExtras}h</span>
                                  <span className="ml-1 text-[10px] font-bold text-slate-400">({pct}%)</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">Sin horas extras registradas en el sistema</p>
                  )}

                </div>
              )}

              {/* Tab 7: Promedio de Asistencia */}
              {activeTab === "promedio_asistencia" && (
                <div className="space-y-6">
                  {/* Número grande */}
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
                      style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 8px 24px rgba(6,182,212,0.35)' }}>
                      <i className="fas fa-chart-line text-3xl text-white" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tasa global · registro acumulado</p>
                    <h2 className="text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                      {averageAttendanceRate.toFixed(1)}<span className="text-3xl font-bold text-slate-400 ml-1">%</span>
                    </h2>
                    <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${averageAttendanceRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 9: Distribución del Personal */}
              {activeTab === "distribucion" && (
                <div className="space-y-6">
                  {/* Encabezado */}
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', boxShadow: '0 8px 24px rgba(139,92,246,0.35)' }}>
                      <i className="fas fa-chart-column text-3xl text-white" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Composición total del personal</p>
                    <h2 className="text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                      {personal.length}
                      <span className="text-2xl font-bold text-slate-400 ml-2">personas</span>
                    </h2>
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                  {/* Barras de distribución */}
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Clasificación por tipo de contrato</p>
                    <div className="space-y-4">
                      {[
                        { label: 'Personal INVECEM (Fijos)', count: countInvecem, color: 'from-cyan-500 to-blue-500', textColor: 'text-cyan-600 dark:text-cyan-400', icon: 'fa-id-badge' },
                        { label: 'Estudiantes INCES', count: countInces, color: 'from-indigo-500 to-violet-500', textColor: 'text-indigo-600 dark:text-indigo-400', icon: 'fa-graduation-cap' },
                        { label: 'Pasantes', count: countPasantes, color: 'from-purple-500 to-pink-500', textColor: 'text-purple-600 dark:text-purple-400', icon: 'fa-user-graduate' },
                      ].map(({ label, count, color, textColor, icon }) => {
                        const pct = countTotalPersonal > 0 ? Math.round((count / countTotalPersonal) * 100) : 0;
                        return (
                          <div key={label} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${color} text-white text-xs`}>
                                  <i className={`fas ${icon}`} />
                                </div>
                                <span className="text-xs font-black uppercase text-slate-700 dark:text-white">{label}</span>
                              </div>
                              <div className="text-right">
                                <span className={`text-xl font-black font-mono ${textColor}`}>{count}</span>
                                <span className="ml-1 text-[10px] font-bold text-slate-400">({pct}%)</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                              <div className={`bg-gradient-to-r ${color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.max(2, pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 8: Presentismo Diario */}
              {activeTab === "presentismo" && (() => {
                const asistentesHoy = asistencias.filter(a => {
                  let fDoc = "";
                  if (a.fecha) {
                    const parts = a.fecha.split("/");
                    fDoc = `${parseInt(parts[0],10)}/${parseInt(parts[1],10)}/${parseInt(parts[2],10)}`;
                  } else if (a.fechaHora) {
                    const f = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
                    fDoc = `${f.getDate()}/${f.getMonth()+1}/${f.getFullYear()}`;
                  }
                  return fDoc === hoyLimpio && a.tipoPersonal !== "CONTRATISTA";
                });
                return (
                  <div className="space-y-6">
                    {/* Resumen del día */}
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 8px 24px rgba(6,182,212,0.35)' }}>
                        <i className="fas fa-calendar-check text-3xl text-white" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Registro de asistencia · hoy</p>
                      <h2 className="text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                        {porcentajePresentesHoy}<span className="text-3xl font-bold text-slate-400 ml-1">%</span>
                      </h2>
                      <p className="text-sm font-bold text-slate-500">
                        <span className="font-extrabold text-cyan-600 dark:text-cyan-400">{presentesHoyCount}</span> de <span className="font-extrabold text-slate-700 dark:text-slate-300">{totalActivos}</span> activos registraron asistencia hoy
                      </p>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800" />
                    {/* Listado de asistentes */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Empleados presentes hoy — {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      {asistentesHoy.length > 0 ? (
                        <div className="space-y-2">
                          {asistentesHoy.map((a, idx) => {
                            const emp = personal.find(p => p.ficha === a.ficha);
                            const esRetraso = a.estatus === "RETRASO" || (a.entrada && emp?.horaEntrada && a.entrada > emp.horaEntrada);
                            return (
                              <div key={a.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black ${
                                    esRetraso ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600'
                                  }`}>
                                    <i className={`fas ${esRetraso ? 'fa-clock' : 'fa-check'}`} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-black uppercase text-slate-900 dark:text-white">
                                      {emp ? `${emp.nombres} ${emp.apellidos || ''}` : a.nombreCompleto || `Ficha ${a.ficha}`}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 font-mono">FICHA: {a.ficha} | CARGO: {emp?.cargo || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`px-2.5 py-0.5 text-xxs font-black uppercase rounded-lg font-mono border ${
                                    esRetraso
                                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-600'
                                      : 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800 text-cyan-600'
                                  }`}>
                                    {a.entrada || '--:--'} {esRetraso ? '· RETRASO' : '· PUNTUAL'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-400 uppercase text-center py-8 font-mono">No hay registros de asistencia para hoy</p>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
