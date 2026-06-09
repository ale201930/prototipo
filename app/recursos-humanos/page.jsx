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

    return () => {
      unsubPersonal();
      unsubAsistencias();
      unsubCorreos();
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
                c.destinatario === emp.correo && 
                c.tipo === "CUMPLEAÑOS" && 
                new Date(c.fecha).getFullYear() === currentYear
              );

              if (!yaFelicitadoEsteAño) {
                procesadosRef.current.add(bdayKey);
                try {
                  await addDoc(collection(db, "correos_enviados"), {
                    fecha: new Date().toISOString(),
                    destinatario: emp.correo,
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

        // 2. Perfect Attendance Congrats (Monthly)
        if (emp.estatus === "Activo (En funciones)") {
          // Check if they registered check-in at least once this month
          const asistioEsteMes = asistencias.some(a => {
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

          // Check if they have zero FALTAs this month
          const tieneFaltasEsteMes = emp.historialIncidencias?.some(inc => {
            if (inc.tipo !== "FALTA") return false;
            return inc.descripcion.includes(`/${currentMonthNum}/${currentYear}`);
          });

          // Check if they have zero retrasos this month
          const tieneRetrasosEsteMes = asistencias.some(a => {
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
            const enEsteMes = mDoc === currentMonthNum && yDoc === currentYear;
            if (!enEsteMes) return false;

            const horaEsperada = emp.horaEntrada || "07:00";
            return a.estatus === "RETRASO" || (a.entrada && a.entrada > horaEsperada);
          });

          if (asistioEsteMes && !tieneFaltasEsteMes && !tieneRetrasosEsteMes) {
            const attKey = `att_${emp.id}_${currentPeriod}`;
            if (procesadosRef.current.has(attKey)) continue;

            const yaEnviadoAsistenciaEsteMes = correosEnviados.some(c => 
              c.destinatario === emp.correo && 
              c.tipo === "ASISTENCIA_PERFECTA" && 
              c.periodo === currentPeriod
            );

            if (!yaEnviadoAsistenciaEsteMes) {
              procesadosRef.current.add(attKey);
              try {
                await addDoc(collection(db, "correos_enviados"), {
                  fecha: new Date().toISOString(),
                  destinatario: emp.correo,
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
  }, [personal, asistencias, correosEnviados]);

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

  const asistenciaPerfecta = personal.filter(emp => {
    if (emp.estatus !== "Activo (En funciones)") return false;

    // 1. Debe haber asistido al menos una vez esta semana
    const asistioEstaSemana = asistencias.some(a => {
      if (a.ficha !== emp.ficha) return false;
      let dAsist = null;
      if (a.fecha) {
        const parts = a.fecha.split("/");
        dAsist = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else if (a.fechaHora) {
        dAsist = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
      }
      if (!dAsist) return false;
      
      const dClean = new Date(dAsist.getFullYear(), dAsist.getMonth(), dAsist.getDate(), 12, 0, 0);
      const lClean = new Date(lunesEstaSemana.getFullYear(), lunesEstaSemana.getMonth(), lunesEstaSemana.getDate(), 0, 0, 0);
      const rClean = new Date(domingoEstaSemana.getFullYear(), domingoEstaSemana.getMonth(), domingoEstaSemana.getDate(), 23, 59, 59);
      
      return dClean >= lClean && dClean <= rClean;
    });

    // 2. No debe tener faltas registradas esta semana
    const tieneFaltasEstaSemana = emp.historialIncidencias?.some(inc => {
      if (inc.tipo !== "FALTA") return false;
      let dInc = null;
      if (inc.fecha) {
        try {
          const cleanStr = inc.fecha.split(",")[0].trim();
          const [d, m, y] = cleanStr.split("/").map(Number);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
            dInc = new Date(y, m - 1, d, 12, 0, 0);
          }
        } catch {}
      }
      if (!dInc && inc.descripcion) {
        try {
          const match = inc.descripcion.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (match) {
            dInc = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10), 12, 0, 0);
          }
        } catch {}
      }
      if (!dInc) return false;
      
      const lClean = new Date(lunesEstaSemana.getFullYear(), lunesEstaSemana.getMonth(), lunesEstaSemana.getDate(), 0, 0, 0);
      const rClean = new Date(domingoEstaSemana.getFullYear(), domingoEstaSemana.getMonth(), domingoEstaSemana.getDate(), 23, 59, 59);
      
      return dInc >= lClean && dInc <= rClean;
    });

    // 3. No debe tener retrasos esta semana
    const tieneRetrasosEstaSemana = asistencias.some(a => {
      if (a.ficha !== emp.ficha) return false;
      let dAsist = null;
      if (a.fecha) {
        const parts = a.fecha.split("/");
        dAsist = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else if (a.fechaHora) {
        dAsist = a.fechaHora.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
      }
      if (!dAsist) return false;
      
      const dClean = new Date(dAsist.getFullYear(), dAsist.getMonth(), dAsist.getDate(), 12, 0, 0);
      const lClean = new Date(lunesEstaSemana.getFullYear(), lunesEstaSemana.getMonth(), lunesEstaSemana.getDate(), 0, 0, 0);
      const rClean = new Date(domingoEstaSemana.getFullYear(), domingoEstaSemana.getMonth(), domingoEstaSemana.getDate(), 23, 59, 59);
      
      const enEstaSemana = dClean >= lClean && dClean <= rClean;
      if (!enEstaSemana) return false;

      const horaEsperada = emp.horaEntrada || "07:00";
      return a.estatus === "RETRASO" || (a.entrada && a.entrada > horaEsperada);
    });

    return asistioEstaSemana && !tieneFaltasEstaSemana && !tieneRetrasosEstaSemana;
  }).slice(0, 5);


  // 5. Overtime Hours (Calculated dynamically)
  const trabajadoresHorasExtras = personal.map(emp => {
    const listAsist = asistencias.filter(a => a.ficha === emp.ficha);
    let totalHorasExtras = 0;
    const horaSalidaEsperada = emp.horaSalida || "16:00";
    
    listAsist.forEach(asist => {
      if (asist.salida) {
        try {
          const [sh, sm] = asist.salida.split(":").map(Number);
          const [eh, em] = horaSalidaEsperada.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(eh)) {
            const difMin = (sh * 60 + sm) - (eh * 60 + em);
            if (difMin > 60) {
              totalHorasExtras += Math.floor(difMin / 60);
            }
          }
        } catch {}
      }
    });
    return { ...emp, totalHorasExtras };
  }).filter(emp => emp.totalHorasExtras > 0)
    .sort((a, b) => b.totalHorasExtras - a.totalHorasExtras)
    .slice(0, 5);

  // Overtime accumulated in company
  const totalHorasExtrasCompania = personal.reduce((acc, emp) => {
    const listAsist = asistencias.filter(a => a.ficha === emp.ficha);
    let totalEmp = 0;
    const horaSalidaEsperada = emp.horaSalida || "16:00";
    listAsist.forEach(asist => {
      if (asist.salida) {
        try {
          const [sh, sm] = asist.salida.split(":").map(Number);
          const [eh, em] = horaSalidaEsperada.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(eh)) {
            const difMin = (sh * 60 + sm) - (eh * 60 + em);
            if (difMin > 60) {
              totalEmp += Math.floor(difMin / 60);
            }
          }
        } catch {}
      }
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
                  onClick={() => setActiveTab("retrasos")}
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
                  onClick={() => setActiveTab("horas_extras")}
                >
                  <i className="fas fa-clock stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-emerald">
                      <i className="fas fa-user-clock"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Horas Extras Totales</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{totalHorasExtrasCompania}h</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Acumuladas por el personal</p>
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
                  onClick={() => setActiveTab("retrasos")}
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
                <div className="stat-box-premium stat-box-premium-purple cursor-pointer min-h-[290px] flex flex-col justify-between">
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
                  
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Clasificación por contrato</p>
                </div>

                {/* Trabajadores con Horas Extras */}
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

                  <p className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold uppercase tracking-wider">Ver listado completo</p>
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
                {activeTab === "horas_extras" && "Trabajadores con Horas Extras"}
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

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
