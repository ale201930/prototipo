"use client";

import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation"; 
import Cookies from "js-cookie";
import { auth, db } from "../lib/firebase"; 
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

/* â”€â”€ Sidebar item component â”€â”€ */
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

/* â”€â”€ Section label â”€â”€ */
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
        setCargando(false);
      };
      obtenerDatos();
    }
  }, [router]);

  const handleLogout = async () => {
    try {
      Cookies.remove("user_session");
      Cookies.remove("user_role");
      localStorage.clear();
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Error al cerrar sesiÃ³n:", error);
    }
  };

  if (cargando) return null;

  const initial = nombreUsuario?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="page-dashboard">

      {/* â”€â”€ BotÃ³n menÃº mÃ³vil â”€â”€ */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-11 h-11 flex items-center justify-center rounded-xl shadow-lg cursor-pointer transition-all duration-200"
        style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
      </button>

      {/* â”€â”€ Overlay mÃ³vil â”€â”€ */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SIDEBAR NAVY
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <aside
        className={`fixed md:relative top-0 bottom-0 left-0 z-40 flex flex-col transition-transform duration-300 md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 272, background: 'linear-gradient(180deg, #0d1117 0%, #161b27 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >

        {/* Logo */}
        <div className="p-6 flex flex-col items-center gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 4px 14px rgba(6,182,212,0.35)' }}>
            <i className="fas fa-building-columns text-white text-xl" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-white uppercase">INVECEM</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
            style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
            Administrador
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-grow px-3 py-4 overflow-y-auto space-y-0.5">
          <SidebarItem icon="fa-home" label="Inicio" active={true} onClick={() => router.push("/administrador")} />
          <SidebarItem icon="fa-user-gear" label="Mi Perfil" onClick={() => router.push("/perfil")} />

          <SidebarSection label="MÃ³dulos" />
          <SidebarItem icon="fa-user-shield" label="Inspector" onClick={() => router.push("/inspector")} accent="#06b6d4" />
          <SidebarItem icon="fa-users-cog" label="Recursos Humanos" onClick={() => router.push("/recursos-humanos")} accent="#3b82f6" />
          <SidebarItem icon="fa-shield-halved" label="ProtecciÃ³n FÃ­sica" onClick={() => router.push("/proteccion-fisica")} accent="#22d3ee" />

          <SidebarSection label="Sistema" />
          <SidebarItem icon="fa-users-gear" label="Usuarios" onClick={() => router.push("/administrador/usuarios")} />
          <SidebarItem icon="fa-desktop" label="Monitoreo" onClick={() => router.push("/administrador/monitoreo")} />
        </nav>

        {/* User footer */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* User info */}
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
            <i className="fas fa-right-from-bracket" /> Cerrar SesiÃ³n
          </button>
        </div>
      </aside>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MAIN CONTENT
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <main className="page-main animate-fade-in">

        {/* Bienvenida */}
        <div className="welcome-card p-8 mb-8 text-white">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">

            {/* Avatar */}
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

            {/* Status badge */}
            <div className="md:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="live-dot" />
              <span className="text-emerald-400 text-xs font-bold">Sistema en LÃ­nea</span>
            </div>
          </div>
        </div>

        {/* Quick actions grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: 'fa-user-shield', label: 'Inspector', sub: 'Registro de asistencia', route: '/inspector', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
            { icon: 'fa-users-cog', label: 'Recursos Humanos', sub: 'Personal y reportes', route: '/recursos-humanos', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
            { icon: 'fa-shield-halved', label: 'ProtecciÃ³n FÃ­sica', sub: 'Control de contratas', route: '/proteccion-fisica', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
            { icon: 'fa-desktop', label: 'Monitoreo', sub: 'Estado del sistema', route: '/administrador/monitoreo', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.route)}
              className="card p-5 text-left cursor-pointer group animate-slide-up"
              style={{ border: `1px solid ${item.color}20` }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                style={{ background: item.bg, border: `1px solid ${item.color}25` }}>
                <i className={`fas ${item.icon} text-lg`} style={{ color: item.color }} />
              </div>
              <p className="font-black text-slate-800 text-sm">{item.label}</p>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">{item.sub}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-bold transition-all duration-200 group-hover:gap-2" style={{ color: item.color }}>
                Acceder <i className="fas fa-arrow-right text-[10px]" />
              </div>
            </button>
          ))}
        </div>

        {/* System links */}
        <div className="card p-6">
          <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
            <i className="fas fa-cog text-cyan-500 text-base" />
            ConfiguraciÃ³n del Sistema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: 'fa-users-gear', label: 'GestiÃ³n de Usuarios', sub: 'Alta, baja y modificaciÃ³n', route: '/administrador/usuarios' },
              { icon: 'fa-user-circle', label: 'Mi Perfil', sub: 'Datos y contraseÃ±a', route: '/perfil' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => router.push(item.route)}
                className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 text-left"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                onMouseEnter={e => { e.currentTarget.style.background='#f0f9ff'; e.currentTarget.style.borderColor='rgba(6,182,212,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#e2e8f0'; }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(6,182,212,0.1)' }}>
                  <i className={`fas ${item.icon} text-cyan-600 text-sm`} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                  <p className="text-slate-400 text-xs font-medium">{item.sub}</p>
                </div>
                <i className="fas fa-chevron-right text-slate-300 text-xs ml-auto" />
              </button>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
