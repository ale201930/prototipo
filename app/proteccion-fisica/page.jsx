"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: 'fa-users', label: 'Personal de Contratas', sub: 'Gestión y registro del personal de contratas', route: '/proteccion-fisica/personal-de-contratas', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
            { icon: 'fa-calendar-check', label: 'Asistencia del Día', sub: 'Control de acceso en tiempo real', route: '/proteccion-fisica/asistencia-del-dia', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
          ].map(item => (
            <button key={item.label} onClick={() => router.push(item.route)}
              className="card p-6 text-left cursor-pointer group animate-slide-up"
              style={{ border: `1px solid ${item.color}20` }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                style={{ background: item.bg, border: `1px solid ${item.color}25` }}>
                <i className={`fas ${item.icon} text-xl`} style={{ color: item.color }} />
              </div>
              <p className="font-black text-slate-800 text-base">{item.label}</p>
              <p className="text-slate-500 text-sm mt-1 font-medium">{item.sub}</p>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-bold transition-all duration-200 group-hover:gap-2.5" style={{ color: item.color }}>
                Abrir módulo <i className="fas fa-arrow-right text-xs" />
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
