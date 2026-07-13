"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';

export default function MonitoreoPage() {
  const router = useRouter();
  const [auditoria, setAuditoria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [agruparAsistencia, setAgruparAsistencia] = useState(true);
  const [expandedDays, setExpandedDays] = useState({});

  // Lógica de fechas por defecto
  const obtenerHoyStr = () => {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const obtenerSieteDiasAtrasStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const defaultFechaFin = useMemo(() => obtenerHoyStr(), []);
  const defaultFechaInicio = useMemo(() => obtenerSieteDiasAtrasStr(), []);

  const [fechaInicio, setFechaInicio] = useState(defaultFechaInicio);
  const [fechaFin, setFechaFin] = useState(defaultFechaFin);

  const restablecerFechas = () => {
    setFechaInicio(defaultFechaInicio);
    setFechaFin(defaultFechaFin);
  };

  const esAsistenciaOVisita = (r) => {
    const mod = (r.modulo || '').toLowerCase();
    const acc = (r.accion || '').toLowerCase();
    return mod === 'control de asistencia' || 
           mod === 'control de visitantes' || 
           mod === 'asistencia' || 
           acc.includes('entrada registrada') || 
           acc.includes('salida registrada') || 
           acc.includes('ingreso por beneficio') ||
           acc.includes('visitante registrado') ||
           acc.includes('salida de visitante');
  };

  const toggleDayExpanded = (diaKey) => {
    setExpandedDays(prev => ({
      ...prev,
      [diaKey]: !prev[diaKey]
    }));
  };

  const cargarAuditoria = async (showMainSpinner = false) => {
    if (showMainSpinner) {
      setLoading(true);
    } else {
      setLoadingRefresh(true);
    }
    try {
      const q = query(
        collection(db, "auditoria"),
        orderBy("fecha", "desc"),
        limit(200) // Cambiado de 500 a 200 para mejorar velocidad de carga
      );
      const snapshot = await getDocs(q);
      const datos = snapshot.docs.map(doc => {
        const data = doc.data();
        const fechaReal = typeof data.fecha?.toDate === 'function'
          ? data.fecha.toDate()
          : (data.fecha ? new Date(data.fecha) : null);
        const fechaFormateada = fechaReal
          ? fechaReal.toLocaleString('es-VE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false,
            })
          : '—';
        const diaKey = fechaReal
          ? fechaReal.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : 'Sin fecha';
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
        let diaLabel = diaKey;
        if (fechaReal) {
          if (fechaReal.toDateString() === hoy.toDateString()) diaLabel = 'Hoy';
          else if (fechaReal.toDateString() === ayer.toDateString()) diaLabel = 'Ayer';
          else {
            diaLabel = fechaReal.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            diaLabel = diaLabel.charAt(0).toUpperCase() + diaLabel.slice(1);
          }
        }
        return { id: doc.id, ...data, fechaFormateada, fechaReal, diaKey, diaLabel };
      });
      setAuditoria(datos);
    } catch (err) {
      console.error("Error al cargar auditoría:", err);
    } finally {
      setLoading(false);
      setLoadingRefresh(false);
    }
  };

  useEffect(() => {
    cargarAuditoria(true);
  }, []);

  // Filtro de búsqueda y fecha
  const registrosFiltrados = useMemo(() => {
    let filtrados = auditoria;

    // Filtro por fecha
    if (fechaInicio || fechaFin) {
      const start = fechaInicio ? new Date(fechaInicio + "T00:00:00") : null;
      const end = fechaFin ? new Date(fechaFin + "T23:59:59") : null;
      filtrados = filtrados.filter(r => {
        if (!r.fechaReal) return false;
        return (!start || r.fechaReal >= start) && (!end || r.fechaReal <= end);
      });
    }

    if (!busqueda.trim()) return filtrados;
    const q = busqueda.toLowerCase();
    return filtrados.filter(r =>
      (r.usuario || '').toLowerCase().includes(q) ||
      (r.rol || '').toLowerCase().includes(q) ||
      (r.accion || '').toLowerCase().includes(q) ||
      (r.modulo || '').toLowerCase().includes(q) ||
      (r.ip || '').toLowerCase().includes(q)
    );
  }, [auditoria, busqueda, fechaInicio, fechaFin]);

  // Agrupación por día
  const agrupadosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const r of registrosFiltrados) {
      if (!mapa.has(r.diaKey)) {
        mapa.set(r.diaKey, { diaLabel: r.diaLabel, registros: [] });
      }
      mapa.get(r.diaKey).registros.push(r);
    }
    return Array.from(mapa.values());
  }, [registrosFiltrados]);

  // Exportar PDF (módulo aislado para evitar SSR trace de jsPDF en Turbopack)
  const exportarPDF = async () => {
    if (typeof window === 'undefined') return;
    try {
      const { generarPDFAuditoria } = await import('./pdf-generator.js');
      await generarPDFAuditoria(agrupadosPorDia, registrosFiltrados);
    } catch (err) {
      console.error('Error generando PDF:', err);
    }
  };

  // Badge de rol
  const getRolBadgeClass = (rol) => {
    const r = (rol || '').toLowerCase();
    if (r.includes('admin'))   return 'bg-red-50 text-red-700 border-red-200';
    if (r.includes('inspector')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (r.includes('rrhh') || r.includes('recursos')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (r.includes('protec')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans cyber-grid">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-100 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Cargando auditoría...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow" />

      {/* ── BARRA DE NAVEGACIÓN SUPERIOR (igual a todos los módulos) ── */}
      <nav className="top-nav no-print bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
            <i className="fas fa-fingerprint text-white" style={{ fontSize: '11px' }} />
          </div>
          <span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span>
        </div>

        {/* Botón volver */}
        <div className="flex items-center gap-3">
          {/* Botón Volver */}
          <button
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan flex items-center gap-2"
            onClick={() => router.push('/administrador')}
          >
            <i className="fas fa-arrow-left" />
            Volver
          </button>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">

        {/* ENCABEZADO */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            Auditoría del Sistema
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Registro inmutable de todas las acciones realizadas en el sistema
          </p>
        </header>

        {/* BARRA DE ACCIONES */}
        <div className="p-5 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl flex flex-col gap-4 mb-6 shadow-xl shadow-slate-200/20">
          
          {/* Fila 1: Buscador y PDF */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Buscador */}
            <div className="relative w-full md:flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500">
                <i className="fas fa-search" />
              </span>
              <input
                type="text"
                placeholder="Buscar por usuario, acción, rol, IP..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold shadow-sm"
              />
            </div>
            
            {/* Botones de Acción */}
            <div className="flex w-full md:w-auto gap-3 flex-wrap">
              {/* Botón Refrescar */}
              <button
                onClick={() => cargarAuditoria(false)}
                disabled={loadingRefresh || loading}
                className="flex-1 md:flex-initial px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-md border border-slate-200 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className={`fas fa-sync ${loadingRefresh ? 'fa-spin' : ''}`} />
                Refrescar
              </button>

              {/* Botón PDF */}
              <button
                onClick={exportarPDF}
                className="flex-1 md:flex-initial px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-red-500/20 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fas fa-file-pdf" />
                Descargar PDF
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-200/65 w-full" />

          {/* Fila 2: Filtros de Fecha, Agrupación y Contador */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            
            {/* Rango de Fechas */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <i className="fas fa-calendar-alt text-cyan-500" /> Rango:
              </span>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm cursor-pointer"
                />
                <span className="text-slate-400 text-xs font-bold font-mono">al</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm cursor-pointer"
                />
              </div>

              {/* Botón para restablecer fechas */}
              {(fechaInicio !== defaultFechaInicio || fechaFin !== defaultFechaFin) && (
                <button
                  onClick={restablecerFechas}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-550 hover:text-slate-800 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer border border-slate-200"
                  title="Restablecer a la última semana"
                >
                  <i className="fas fa-undo mr-1" /> Restablecer
                </button>
              )}
            </div>

            {/* Agrupación y Contador */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto justify-end">
              {/* Selector de Agrupación */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm select-none w-full sm:w-auto justify-center sm:justify-start">
                <input
                  type="checkbox"
                  id="agrupar-toggle"
                  checked={agruparAsistencia}
                  onChange={(e) => setAgruparAsistencia(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                />
                <label
                  htmlFor="agrupar-toggle"
                  className="text-[10px] font-black text-slate-700 uppercase tracking-wider cursor-pointer"
                >
                  Agrupar Asistencias/Visitas
                </label>
              </div>

              {/* Contador */}
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono font-bold whitespace-nowrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                <span className="live-dot" />
                {registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? 's' : ''}
              </div>
            </div>

          </div>
        </div>

        {/* SIN RESULTADOS */}
        {registrosFiltrados.length === 0 && (
          <div className="bg-white/85 backdrop-blur-lg border border-slate-200/60 rounded-3xl p-16 text-center shadow-xl shadow-slate-200/20 relative">
            <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <i className="fas fa-clipboard-list text-5xl text-slate-200 mb-4 block" />
            <p className="text-slate-400 font-bold text-sm">
              {busqueda ? 'No se encontraron registros con ese criterio de búsqueda' : 'No hay registros de auditoría aún'}
            </p>
          </div>
        )}

        {/* GRUPOS POR DÍA */}
        {agrupadosPorDia.map((grupo, idx) => (
          <div key={grupo.diaKey ? `${grupo.diaKey}-${idx}` : `grupo-${idx}`} className="mb-8">

            {/* Separador del día */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #ef4444, transparent)' }} />
              <span className="flex items-center gap-2 bg-indigo-950 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-wide whitespace-nowrap shadow-md">
                <i className="fas fa-calendar-day text-cyan-400" style={{ fontSize: 10 }} />
                {grupo.diaLabel}
                <span className="bg-red-500 text-white rounded-full px-2 py-0 text-[10px] font-black ml-1">
                  {grupo.registros.length}
                </span>
              </span>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #e2e8f0)' }} />
            </div>

            {/* Tabla del día */}
            <div className="bg-white/85 backdrop-blur-lg border border-slate-200/60 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/20 relative">
              {/* Tech Corners */}
              <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <div className="overflow-x-auto w-full no-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-4 text-left">HORA</th>
                      <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-4 text-left">USUARIO</th>
                      <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-4 text-left">ROL</th>
                      <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-4 text-left">ACCIÓN / MÓDULO</th>
                      <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-4 text-center">ESTADO</th>
                      <th className="text-slate-500 font-mono text-[9px] font-black tracking-wider uppercase py-4 px-4 text-left">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const itemsAsistencia = grupo.registros.filter(esAsistenciaOVisita);
                      const itemsNormales = grupo.registros.filter(r => !esAsistenciaOVisita(r));
                      const isExpanded = !!expandedDays[grupo.diaKey];

                      const renderFilaRegistro = (r, isInner = false) => {
                        const esFallo = (r.accion || '').toLowerCase().includes('fallido');
                        const horaTexto = r.fechaFormateada.includes(' ')
                          ? r.fechaFormateada.split(' ')[1]
                          : r.fechaFormateada;
                        const esInvitado = (r.usuario || '').toLowerCase() === 'invitado';

                        return (
                          <tr key={r.id} className={`transition-colors border-b border-slate-100 ${isInner ? 'bg-slate-50/50 hover:bg-slate-100/60 border-l-4 border-cyan-500' : 'hover:bg-slate-50/80'}`}>
                            {/* HORA */}
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs font-bold text-slate-500">{horaTexto}</span>
                            </td>

                            {/* USUARIO */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: esInvitado ? 'linear-gradient(135deg,#94a3b8,#64748b)' : 'linear-gradient(135deg,#1e40af,#3b82f6)' }}
                                >
                                  <i className="fas fa-user text-white" style={{ fontSize: 11 }} />
                                </div>
                                <div>
                                  <span className={`font-extrabold text-sm uppercase ${esInvitado ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                                    {r.usuario || '—'}
                                  </span>
                                  {esInvitado && (
                                    <div className="text-[10px] text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                                      <i className="fas fa-exclamation-triangle" style={{ fontSize: 8 }} />
                                      Sin sesión activa
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* ROL */}
                            <td className="py-4 px-4">
                              <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-block border ${getRolBadgeClass(r.rol)}`}>
                                {r.rol || '—'}
                              </span>
                            </td>

                            {/* ACCIÓN / MÓDULO */}
                            <td className="py-4 px-4">
                              <div className="font-bold text-slate-800 text-sm">{r.accion || '—'}</div>
                              {r.modulo && (
                                <div className="font-bold text-indigo-500 text-xxs uppercase tracking-wider mt-0.5">{r.modulo}</div>
                              )}
                            </td>

                            {/* ESTADO */}
                            <td className="py-4 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-lg text-xxs font-black tracking-wider uppercase inline-flex items-center gap-1 border ${esFallo ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                <i className={`fas fa-${esFallo ? 'times-circle' : 'check-circle'}`} style={{ fontSize: 9 }} />
                                {esFallo ? 'Fallo' : 'Éxito'}
                              </span>
                            </td>

                            {/* IP */}
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs font-bold text-slate-500">{r.ip || '—'}</span>
                            </td>
                          </tr>
                        );
                      };

                      if (!agruparAsistencia || itemsAsistencia.length === 0) {
                        return grupo.registros.map(r => renderFilaRegistro(r));
                      }

                      return (
                        <>
                          {itemsNormales.map(r => renderFilaRegistro(r))}
                          
                          {/* Fila resumen interactiva */}
                          <tr className="bg-indigo-55/10 hover:bg-indigo-55/20 transition-colors border-b border-indigo-100/50">
                            <td colSpan="6" className="py-4 px-4">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
                                    <i className="fas fa-history text-sm" />
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-sm text-indigo-950 block">
                                      Resumen de Actividad ({itemsAsistencia.length} registros de Asistencia y Visitas)
                                    </span>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                      Entradas, salidas y controles de acceso de personal y visitantes
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => toggleDayExpanded(grupo.diaKey)}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-indigo-600/10 flex items-center gap-1.5 self-end sm:self-auto"
                                >
                                  <i className={`fas fa-${isExpanded ? 'eye-slash' : 'eye'}`} />
                                  {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && itemsAsistencia.map(r => renderFilaRegistro(r, true))}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {/* FOOTER */}
        {registrosFiltrados.length > 0 && (
          <div className="flex justify-between items-center px-4 py-3 bg-white/80 border border-slate-200/60 rounded-2xl shadow-sm mt-2">
            <span className="text-xs text-slate-500 font-bold">
              <i className="fas fa-database mr-2 text-cyan-500" />
              {registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? 's' : ''} en {agrupadosPorDia.length} día{agrupadosPorDia.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-2 text-xxs text-slate-400 font-bold uppercase tracking-wider font-mono">
              <span className="live-dot" />
              Tiempo real
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
