"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { ContadorEstancia, parseFechaIngreso } from "./visitantes/page";

function SidebarItem({ icon, label, active, onClick, accent = "#06b6d4" }) {
  return (
    <li
      onClick={onClick}
      className="list-none flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 select-none"
      style={active ? {
        background: `linear-gradient(90deg, rgba(6,182,212,0.15), rgba(59,130,246,0.08))`,
        borderLeft: `3px solid ${accent}`,
        color: '#ffffff',
        fontWeight: 800,
        paddingLeft: '13px',
      } : { color: '#94a3b8', borderLeft: '3px solid transparent' }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.transform = 'translateX(3px)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.transform = ''; } }}
    >
      <i className={`fas ${icon} w-5 text-center`} style={{ color: active ? accent : 'inherit', fontSize: '0.95rem' }} />
      <span className="text-sm font-semibold">{label}</span>
    </li>
  );
}

function SidebarSection({ label }) {
  return <div className="px-4 pt-5 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest select-none">{label}</div>;
}

export default function Inspector() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState("");
  
  // Real-time states
  const [stats, setStats] = useState({ hoy: 0, enPlanta: 0, asistenciasHoy: 0, pctPresencia: 0 });
  const [visitantesEnPlanta, setVisitantesEnPlanta] = useState([]);
  const [visitantesHoy, setVisitantesHoy] = useState([]);
  const [ultimasAsistencias, setUltimasAsistencias] = useState([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

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

    const role = Cookies.get("user_role");
    if (role === "admin" || role === "administrador") {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    // 1. Escuchar visitantes
    const unsubVisitas = onSnapshot(collection(db, "visitantes"), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      docs.sort((a, b) => {
        const dA = parseFechaIngreso(a.fechaIngreso, a.entrada);
        const dB = parseFechaIngreso(b.fechaIngreso, b.entrada);
        const msA = dA ? dA.getTime() : 0;
        const msB = dB ? dB.getTime() : 0;
        return msB - msA;
      });

      const enPlanta = docs.filter(v => v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--"));
      
      const visitantesRelevantes = docs.filter(v => {
        const isEnPlanta = v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--");
        if (isEnPlanta) return true;
        const fechaObj = parseFechaIngreso(v.fechaIngreso, v.entrada);
        return fechaObj && fechaObj >= inicioHoy;
      });

      setVisitantesEnPlanta(enPlanta);
      setVisitantesHoy(visitantesRelevantes);
      setStats(prev => ({
        ...prev,
        hoy: visitantesRelevantes.length,
        enPlanta: enPlanta.length
      }));
    }, (error) => {
      console.error("Error cargando visitantes:", error);
    });

    // 2. Escuchar personal (para calcular el porcentaje de presencia)
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const activos = list.filter(emp => emp.estatus === "Activo (En funciones)").length || 1;
      
      // 3. Escuchar asistencias de hoy (para contar marcajes de hoy)
      const qAsistencias = query(
        collection(db, "asistencias"),
        where("fechaHora", ">=", inicioHoy)
      );

      const unsubAsistencias = onSnapshot(qAsistencias, (asistSnap) => {
        const asistDocs = asistSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort by check-in time desc
        const sortedAsist = asistDocs.sort((a, b) => {
          const dateA = a.fechaHora?.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora || 0);
          const dateB = b.fechaHora?.toDate ? b.fechaHora.toDate() : new Date(b.fechaHora || 0);
          return dateB - dateA;
        });

        // Filter out unique check-ins (unique ficha) to compute headcount present
        const uniquePresent = new Set(asistDocs.map(a => a.ficha));
        const presentesCount = uniquePresent.size;
        
        const pct = Math.min(100, Math.round((presentesCount / activos) * 100)) || 0;
        
        setUltimasAsistencias(sortedAsist.slice(0, 5));
        setStats(prev => ({
          ...prev,
          asistenciasHoy: asistDocs.length,
          pctPresencia: pct
        }));
        setLoading(false);
      });

      return () => unsubAsistencias();
    });

    return () => {
      unsubVisitas();
      unsubPersonal();
    };
  }, []);

  const handleLogout = async () => {
    try {
      Cookies.remove("user_session");
      Cookies.remove("user_role");
      localStorage.clear();
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Error al salir:", error);
    }
  };

  const initial = nombreUsuario?.charAt(0)?.toUpperCase() || "I";

  return (
    <div className="page-dashboard">

      <button
        className="md:hidden fixed top-4 left-4 z-50 w-11 h-11 flex items-center justify-center rounded-xl shadow-lg cursor-pointer"
        style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
      </button>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed md:relative top-0 bottom-0 left-0 z-40 flex flex-col transition-transform duration-300 md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 272, background: 'linear-gradient(180deg, #0d1117 0%, #161b27 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="p-6 flex flex-col items-center gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 4px 14px rgba(6,182,212,0.35)' }}>
            <i className="fas fa-fingerprint text-white text-xl" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-white uppercase">INVECEM</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
            style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
            Inspector
          </span>
        </div>

        <nav className="flex-grow px-3 py-4 overflow-y-auto space-y-0.5">
          <SidebarItem icon="fa-home" label="Inicio" active={true} onClick={() => router.push("/inspector")} />
          <SidebarItem icon="fa-user-gear" label="Mi Perfil" onClick={() => router.push("/perfil")} />

          <SidebarSection label="Módulos" />
          <SidebarItem icon="fa-edit" label="Registro de Asistencia" onClick={() => router.push("/inspector/registro-asistencia")} />
          <SidebarItem icon="fa-user-group" label="Visitantes" onClick={() => router.push("/inspector/visitantes")} accent="#3b82f6" />

          {isAdmin && (
            <>
              <SidebarSection label="Administración" />
              <SidebarItem icon="fa-arrow-left" label="Volver al Panel Admin" onClick={() => router.push("/administrador")} accent="#f59e0b" />
            </>
          )}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-bold truncate">{nombreUsuario || "Usuario"}</p>
              <p className="text-slate-500 text-[10px]">Inspector de Planta</p>
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
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 8px 24px rgba(6,182,212,0.4)' }}>
              <i className="fas fa-user-shield text-3xl text-white" />
            </div>
            <div>
              <p className="text-cyan-300 text-xs font-bold uppercase tracking-widest mb-1">Módulo Inspector</p>
              <h1 className="text-3xl font-black tracking-tight mb-2">
                Bienvenido, <span style={{ color: '#22d3ee' }}>{nombreUsuario || "Inspector"}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium">
                Accede a los módulos de registro y control desde el menú lateral
              </p>
            </div>
            <div className="md:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="live-dot" />
              <span className="text-emerald-400 text-xs font-bold">Turno Activo</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-cyan-500 animate-pulse font-sans">
            <i className="fas fa-spinner fa-spin mr-2"></i> Conectando con el sistema... Cargando estadísticas en vivo...
          </div>
        ) : (
          <div className="space-y-8 animate-slide-up">
            
            {/* SECCIÓN 1: ESTADÍSTICAS GENERALES DE ACCESO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="border-l-4 border-cyan-500 pl-4 mb-6">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Estadísticas de Acceso (Hoy)</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Indicadores en tiempo real de visitas y presencia en planta</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1: Visitas de Hoy */}
                <div className="stat-box-premium stat-box-premium-cyan cursor-pointer" onClick={() => router.push("/inspector/visitantes")}>
                  <i className="fas fa-address-book stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-cyan">
                      <i className="fas fa-address-book"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Visitas de Hoy</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.hoy}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Registrados en el sistema hoy</p>
                </div>

                {/* KPI 2: Visitantes en Planta */}
                <div className="stat-box-premium stat-box-premium-emerald cursor-pointer" onClick={() => router.push("/inspector/visitantes")}>
                  <i className="fas fa-user-clock stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-emerald text-emerald-500">
                      <i className="fas fa-user-clock"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Visitantes en Planta</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.enPlanta}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Actualmente dentro de planta</p>
                </div>

                {/* KPI 3: Asistencias Registradas */}
                <div className="stat-box-premium stat-box-premium-purple cursor-pointer" onClick={() => router.push("/inspector/registro-asistencia")}>
                  <i className="fas fa-id-card stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-purple">
                      <i className="fas fa-id-card"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Marcajes de Hoy</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.asistenciasHoy}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Marcaciones de entrada/salida</p>
                </div>

                {/* KPI 4: Porcentaje Presencia */}
                <div className="stat-box-premium stat-box-premium-indigo cursor-pointer" onClick={() => router.push("/inspector/registro-asistencia")}>
                  <i className="fas fa-users stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-indigo">
                      <i className="fas fa-users"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Presencia de Personal</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.pctPresencia}%</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Presencia de la nómina activa</p>
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: DETALLES EN PLANTA */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* Historial de Visitas de Hoy */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
                <h3 className="text-sm font-black uppercase text-indigo-950 dark:text-white tracking-wider border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <i className="fas fa-history text-cyan-500"></i> Historial de Visitas de Hoy
                </h3>
                
                <div className="overflow-y-auto max-h-[300px] mt-4 space-y-3 pr-2">
                  {visitantesHoy.length > 0 ? (
                    visitantesHoy.map(v => {
                      const isEnPlanta = v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--");
                      return (
                        <div key={v.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                          <div>
                            <strong className="text-xs font-black text-indigo-950 dark:text-white uppercase block">{v.nombre}</strong>
                            <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">{v.empresa || "Particular"}</span>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            {isEnPlanta ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono animate-pulse-glow">
                                  EN PLANTA
                                </span>
                                <ContadorEstancia fechaIngreso={v.fechaIngreso} entradaStr={v.entrada} />
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 text-slate-500 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">
                                SALIÓ: {v.salida}
                              </span>
                            )}
                            <span className="block text-[9px] text-slate-400 font-bold font-mono">ÁREA: {v.area}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-12 font-mono">No hay visitas registradas hoy</p>
                  )}
                </div>
                {visitantesHoy.length > 0 && (
                  <button 
                    onClick={() => router.push("/inspector/visitantes")} 
                    className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xxs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Ver panel de visitas
                  </button>
                )}
              </div>

              {/* Últimos Marcajes de Asistencia */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
                <h3 className="text-sm font-black uppercase text-indigo-950 dark:text-white tracking-wider border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <i className="fas fa-history text-cyan-500"></i> Últimos Marcajes de Hoy
                </h3>
                
                <div className="overflow-y-auto max-h-[300px] mt-4 space-y-3 pr-2">
                  {ultimasAsistencias.length > 0 ? (
                    ultimasAsistencias.map(a => (
                      <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <strong className="text-xs font-black text-slate-800 dark:text-white uppercase block">{a.nombreCompleto || `Colaborador Ficha ${a.ficha}`}</strong>
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">FICHA: {a.ficha}</span>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase border ${a.salida && a.salida !== "--:--" ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                            {!a.salida || a.salida === "--:--" ? `ENTRADA: ${a.entrada}` : `SALIDA: ${a.salida}`}
                          </span>
                          <span className="block text-[9px] text-slate-400 mt-0.5 font-bold font-mono">TIPO: {a.tipoPersonal || "INVECEM"}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-12 font-mono">Sin marcajes registrados hoy</p>
                  )}
                </div>
                {ultimasAsistencias.length > 0 && (
                  <button 
                    onClick={() => router.push("/inspector/registro-asistencia")} 
                    className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xxs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Ver panel de asistencia
                  </button>
                )}
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}

