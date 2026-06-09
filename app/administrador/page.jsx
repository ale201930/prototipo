"use client";

import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation"; 
import Cookies from "js-cookie";
import { auth, db } from "../lib/firebase"; 
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";

/* ── Sidebar item component ── */
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
      } : {
        color: '#94a3b8',
        borderLeft: '3px solid transparent',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.transform = 'translateX(3px)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.transform = ''; } }}
    >
      <i className={`fas ${icon} w-5 text-center`} style={{ color: active ? accent : 'inherit', fontSize: '0.95rem' }} />
      <span className="text-sm font-semibold">{label}</span>
    </li>
  );
}

/* ── Section label ── */
function SidebarSection({ label }) {
  return (
    <div className="px-4 pt-5 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest select-none">
      {label}
    </div>
  );
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState("Administrador");
  
  // Real-time states
  const [stats, setStats] = useState({ usuariosTotal: 0, auditoriaHoy: 0, personalTotal: 0, contratistasPlanta: 0 });

  const router = useRouter();

  useEffect(() => {
    const session = Cookies.get("user_session");
    const role = Cookies.get("user_role");

    if (!session || role !== "administrador") {
      router.push("/login?error=unauthorized");
    } else {
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
    }
  }, [router]);

  useEffect(() => {
    // 1. Escuchar usuarios
    const unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snap) => {
      const uCount = snap.docs.length;
      setStats(prev => ({ ...prev, usuariosTotal: uCount }));
    });

    // 2. Escuchar personal
    const unsubPersonal = onSnapshot(collection(db, "personal"), (snap) => {
      const pCount = snap.docs.filter(d => d.data().estatus === "Activo (En funciones)").length;
      setStats(prev => ({ ...prev, personalTotal: pCount }));
    });

    // 3. Escuchar contratistas/asistencias hoy
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const qContratistas = query(
      collection(db, "asistencias"),
      where("fechaHora", ">=", inicioHoy),
      where("tipoPersonal", "==", "CONTRATISTA")
    );

    const unsubContratistas = onSnapshot(qContratistas, (snap) => {
      const adentro = snap.docs.filter(d => d.data().entrada && (!d.data().salida || d.data().salida === "--:--")).length;
      setStats(prev => ({ ...prev, contratistasPlanta: adentro }));
    });

    // 4. Escuchar auditoria (actividad de hoy, alertas y logs recientes)
    const qAuditoria = query(
      collection(db, "auditoria"),
      orderBy("fecha", "desc"),
      limit(50)
    );

    const unsubAuditoria = onSnapshot(qAuditoria, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Activity of today
      const hoyDocs = docs.filter(d => {
        const f = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha || 0);
        return f >= inicioHoy;
      });

      setStats(prev => ({ ...prev, auditoriaHoy: hoyDocs.length }));
      setCargando(false);
    });

    return () => {
      unsubUsuarios();
      unsubPersonal();
      unsubContratistas();
      unsubAuditoria();
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
      console.error("Error al cerrar sesión:", error);
    }
  };

  if (cargando) return null;

  const initial = nombreUsuario?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="page-dashboard">

      {/* ── Botón menú móvil ── */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-11 h-11 flex items-center justify-center rounded-xl shadow-lg cursor-pointer transition-all duration-200"
        style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
      </button>

      {/* ── Overlay móvil ── */}
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
            Administrador
          </span>
        </div>

        <nav className="flex-grow px-3 py-4 overflow-y-auto space-y-0.5">
          <SidebarItem icon="fa-home" label="Inicio" active={true} onClick={() => router.push("/administrador")} />
          <SidebarItem icon="fa-user-gear" label="Mi Perfil" onClick={() => router.push("/perfil")} />

          <SidebarSection label="Módulos" />
          <SidebarItem icon="fa-user-shield" label="Inspector" onClick={() => router.push("/inspector")} accent="#06b6d4" />
          <SidebarItem icon="fa-users-cog" label="Recursos Humanos" onClick={() => router.push("/recursos-humanos")} accent="#3b82f6" />
          <SidebarItem icon="fa-shield-halved" label="Protección Física" onClick={() => router.push("/proteccion-fisica")} accent="#22d3ee" />

          <SidebarSection label="Sistema" />
          <SidebarItem icon="fa-users-gear" label="Usuarios" onClick={() => router.push("/administrador/usuarios")} />
          <SidebarItem icon="fa-desktop" label="Monitoreo" onClick={() => router.push("/administrador/monitoreo")} />
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-bold truncate">{nombreUsuario}</p>
              <p className="text-slate-500 text-[10px]">Administrador</p>
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

      {/* MAIN CONTENT */}
      <main className="page-main animate-fade-in">

        {/* Bienvenida */}
        <div className="welcome-card p-8 mb-8 text-white">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 animate-float"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 8px 24px rgba(6,182,212,0.4)' }}>
              <i className="fas fa-user-tie text-3xl text-white" />
            </div>

            <div>
              <p className="text-cyan-300 text-xs font-bold uppercase tracking-widest mb-1">Panel de Control</p>
              <h1 className="text-3xl font-black tracking-tight mb-2">
                Bienvenido, <span style={{ color: '#22d3ee' }}>{nombreUsuario}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium">
                Has ingresado a <strong className="text-white">INVECEM Sistema</strong> con el rol de{' '}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}>
                  <i className="fas fa-user-tie text-[10px]" /> Administrador
                </span>
              </p>
            </div>

            <div className="md:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="live-dot" />
              <span className="text-emerald-400 text-xs font-bold">Sistema en Línea</span>
            </div>
          </div>
        </div>

        <div className="space-y-8 animate-slide-up">
          
          {/* SECCIÓN 1: MÉTRICAS GLOBALES DEL SISTEMA */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
            <div className="border-l-4 border-cyan-500 pl-4 mb-6">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Estadísticas del Sistema</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Indicadores generales y uso de recursos de la plataforma</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* KPI 1: Usuarios Registrados */}
              <div className="stat-box-premium stat-box-premium-cyan cursor-pointer" onClick={() => router.push("/administrador/usuarios")}>
                <i className="fas fa-users-gear stat-box-icon-bg"></i>
                <div>
                  <div className="stat-box-icon-circle stat-box-icon-circle-cyan">
                    <i className="fas fa-users-gear"></i>
                  </div>
                  <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Usuarios del Sistema</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.usuariosTotal}</h3>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Cuentas activas/inactivas</p>
              </div>

              {/* KPI 2: Actividad del Día */}
              <div className="stat-box-premium stat-box-premium-purple cursor-pointer" onClick={() => router.push("/administrador/monitoreo")}>
                <i className="fas fa-desktop stat-box-icon-bg"></i>
                <div>
                  <div className="stat-box-icon-circle stat-box-icon-circle-purple">
                    <i className="fas fa-desktop"></i>
                  </div>
                  <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Actividades Hoy</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.auditoriaHoy}</h3>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Eventos de auditoría de hoy</p>
              </div>

              {/* KPI 3: Personal Registrado */}
              <div className="stat-box-premium stat-box-premium-emerald cursor-pointer" onClick={() => router.push("/recursos-humanos")}>
                <i className="fas fa-id-card stat-box-icon-bg"></i>
                <div>
                  <div className="stat-box-icon-circle stat-box-icon-circle-emerald">
                    <i className="fas fa-id-card"></i>
                  </div>
                  <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Personal Activo</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.personalTotal}</h3>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Colaboradores en funciones</p>
              </div>

              {/* KPI 4: Contratistas en Planta */}
              <div className="stat-box-premium stat-box-premium-cyan cursor-pointer" onClick={() => router.push("/proteccion-fisica")}>
                <i className="fas fa-shield-halved stat-box-icon-bg"></i>
                <div>
                  <div className="stat-box-icon-circle stat-box-icon-circle-cyan">
                    <i className="fas fa-shield-halved"></i>
                  </div>
                  <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Contratas en Planta</p>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{stats.contratistasPlanta}</h3>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Personal externo hoy</p>
              </div>
            </div>
          </section>

        </div>

      </main>
    </div>
  );
}

