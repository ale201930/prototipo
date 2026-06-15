"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

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

export default function ProteccionFisica() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState("");

  // Real-time states
  const [stats, setStats] = useState({ enPlanta: 0, totalRegistrados: 0, entradasHoy: 0, salidasHoy: 0 });
  const [contratistasPlanta, setContratistasPlanta] = useState([]);
  const [distribucionEmpresas, setDistribucionEmpresas] = useState([]);
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

  const totalContratistasRef = React.useRef(0);

  useEffect(() => {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    // 1. Listener de contratistas (total registrados)
    const unsubContratistas = onSnapshot(collection(db, "contratistas"), (snapshot) => {
      totalContratistasRef.current = snapshot.docs.length;
    });

    // 2. Listener de asistencias de hoy (contratistas) — independiente
    const qAsistencias = query(
      collection(db, "asistencias"),
      where("fechaHora", ">=", inicioHoy)
    );

    const unsubAsistencias = onSnapshot(qAsistencias, (asistSnap) => {
      const allAsist = asistSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const asistDocs = allAsist.filter(a => a.tipoPersonal === "CONTRATISTA");

      const enPlantaDocs = asistDocs.filter(a => a.entrada && (!a.salida || a.salida === "--:--"));
      const entradasCount = asistDocs.filter(a => a.entrada).length;
      const salidasCount = asistDocs.filter(a => a.salida && a.salida !== "--:--").length;

      // Group by company for distribution
      const compMap = {};
      enPlantaDocs.forEach(a => {
        const comp = a.nombreContrata || "Sin Empresa";
        compMap[comp] = (compMap[comp] || 0) + 1;
      });

      const sortedComp = Object.keys(compMap).map(key => ({
        empresa: key,
        cantidad: compMap[key]
      })).sort((a, b) => b.cantidad - a.cantidad);

      setContratistasPlanta(enPlantaDocs);
      setDistribucionEmpresas(sortedComp.slice(0, 5));
      setStats({
        enPlanta: enPlantaDocs.length,
        totalRegistrados: totalContratistasRef.current,
        entradasHoy: entradasCount,
        salidasHoy: salidasCount
      });
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar asistencias de contratistas:", error);
      setLoading(false);
    });

    return () => {
      unsubContratistas();
      unsubAsistencias();
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

  const initial = nombreUsuario?.charAt(0)?.toUpperCase() || "P";

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
            style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}>
            Protección Física
          </span>
        </div>

        <nav className="flex-grow px-3 py-4 overflow-y-auto space-y-0.5">
          <SidebarItem icon="fa-home" label="Inicio" active={true} onClick={() => router.push("/proteccion-fisica")} />
          <SidebarItem icon="fa-user-gear" label="Mi Perfil" onClick={() => router.push("/perfil")} />

          <SidebarSection label="Módulos" />
          <SidebarItem icon="fa-users" label="Personal de Contratas" onClick={() => router.push("/proteccion-fisica/personal-de-contratas")} accent="#06b6d4" />
          <SidebarItem icon="fa-calendar-check" label="Asistencia del Día" onClick={() => router.push("/proteccion-fisica/asistencia-del-dia")} accent="#22d3ee" />

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
              <p className="text-slate-500 text-[10px]">Protección Física</p>
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
              style={{ background: 'linear-gradient(135deg, #22d3ee, #06b6d4)', boxShadow: '0 8px 24px rgba(34,211,238,0.4)' }}>
              <i className="fas fa-shield-halved text-3xl text-white" />
            </div>
            <div>
              <p className="text-cyan-300 text-xs font-bold uppercase tracking-widest mb-1">Control de Acceso</p>
              <h1 className="text-3xl font-black tracking-tight mb-2">
                Bienvenido, <span style={{ color: '#22d3ee' }}>{nombreUsuario || "Usuario"}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium">
                Controla el acceso de contratas y personal externo en la planta
              </p>
            </div>
            <div className="md:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="live-dot" />
              <span className="text-emerald-400 text-xs font-bold">Acceso Activo</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-cyan-500 animate-pulse font-sans">
            <i className="fas fa-spinner fa-spin mr-2"></i> Conectando con el sistema... Cargando contratistas...
          </div>
        ) : (
          <div className="space-y-8 animate-slide-up">
            
            {/* SECCIÓN 1: ESTADÍSTICAS GENERALES DE CONTRATISTAS */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="border-l-4 border-cyan-500 pl-4 mb-6">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Estadísticas de Contratas (Hoy)</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Monitoreo y control de personal externo en planta</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1: Contratistas en Planta */}
                <div className="stat-box-premium stat-box-premium-cyan cursor-pointer" onClick={() => router.push("/proteccion-fisica/asistencia-del-dia")}>
                  <i className="fas fa-sign-in-alt stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-cyan">
                      <i className="fas fa-sign-in-alt"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">En Planta Ahora</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.enPlanta}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Contratistas activos en planta</p>
                </div>

                {/* KPI 2: Total Registrados */}
                <div className="stat-box-premium stat-box-premium-purple cursor-pointer" onClick={() => router.push("/proteccion-fisica/personal-de-contratas")}>
                  <i className="fas fa-id-card stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-purple">
                      <i className="fas fa-id-card"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Total Registrados</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.totalRegistrados}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Personal externo homologado</p>
                </div>

                {/* KPI 3: Entradas Hoy */}
                <div className="stat-box-premium stat-box-premium-emerald cursor-pointer" onClick={() => router.push("/proteccion-fisica/asistencia-del-dia")}>
                  <i className="fas fa-arrow-right-to-bracket stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-emerald">
                      <i className="fas fa-sign-in-alt text-emerald-500"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Entradas Hoy</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.entradasHoy}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Registros de ingreso de hoy</p>
                </div>

                {/* KPI 4: Salidas Hoy */}
                <div className="stat-box-premium stat-box-premium-amber cursor-pointer" onClick={() => router.push("/proteccion-fisica/asistencia-del-dia")}>
                  <i className="fas fa-arrow-right-from-bracket stat-box-icon-bg"></i>
                  <div>
                    <div className="stat-box-icon-circle stat-box-icon-circle-amber">
                      <i className="fas fa-sign-out-alt text-amber-500"></i>
                    </div>
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Salidas Hoy</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.salidasHoy}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Registros de egreso de hoy</p>
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: DETALLE EN PLANTA */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* Contratistas en Planta */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
                <h3 className="text-sm font-black uppercase text-indigo-950 dark:text-white tracking-wider border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <i className="fas fa-users-gear text-cyan-500"></i> Contratistas en Planta Ahora
                </h3>
                
                <div className="overflow-y-auto max-h-[300px] mt-4 space-y-3 pr-2">
                  {contratistasPlanta.length > 0 ? (
                    contratistasPlanta.map(c => (
                      <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <strong className="text-xs font-black text-slate-800 dark:text-white uppercase block">{c.nombreCompleto}</strong>
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">{c.nombreContrata}</span>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-0.5 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-255 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 rounded-lg text-xxs font-black uppercase tracking-wider font-mono">
                            EN: {c.entrada}
                          </span>
                          <span className="block text-[9px] text-slate-450 mt-0.5 font-bold font-mono">ÁREA: {c.area || "N/A"}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-12 font-mono">No hay contratistas en planta en este momento</p>
                  )}
                </div>
                {contratistasPlanta.length > 0 && (
                  <button 
                    onClick={() => router.push("/proteccion-fisica/asistencia-del-dia")} 
                    className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xxs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Ver reporte de asistencia
                  </button>
                )}
              </div>

              {/* Distribución por Empresa */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
                <h3 className="text-sm font-black uppercase text-indigo-950 dark:text-white tracking-wider border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <i className="fas fa-chart-column text-cyan-500"></i> Distribución de Contratas en Planta
                </h3>
                
                <div className="overflow-y-auto max-h-[300px] mt-4 space-y-4 pr-2">
                  {distribucionEmpresas.length > 0 ? (
                    distribucionEmpresas.map((d, index) => {
                      const totalPresentes = stats.enPlanta || 1;
                      const pct = Math.max(8, Math.round((d.cantidad / totalPresentes) * 100));
                      
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="truncate max-w-[200px] uppercase font-black">{d.empresa}</span>
                            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-extrabold">{d.cantidad} persona(s) ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-850 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase text-center py-12 font-mono">Sin contratistas activos hoy</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
