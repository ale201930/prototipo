"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, registrarAccion } from "@/app/lib/firebase";
import { 
  collection, addDoc, onSnapshot, query, where, orderBy, 
  doc, updateDoc, Timestamp 
} from "firebase/firestore";

// --- COMPONENTE AUXILIAR: PARSEO DE FECHA Y CRONÓMETRO INDUSTRIAL ---
export function parseFechaIngreso(fechaIngreso, entradaStr) {
  if (fechaIngreso) {
    if (typeof fechaIngreso.toDate === "function") {
      const d = fechaIngreso.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof fechaIngreso.seconds === "number") {
      const d = new Date(fechaIngreso.seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    if (fechaIngreso instanceof Date && !isNaN(fechaIngreso.getTime())) {
      return fechaIngreso;
    }
    if (typeof fechaIngreso === "string" || typeof fechaIngreso === "number") {
      const d = new Date(fechaIngreso);
      if (!isNaN(d.getTime())) return d;
    }
  }

  if (entradaStr && typeof entradaStr === "string") {
    try {
      const hoy = new Date();
      const match = entradaStr.match(/(\d{1,2}):(\d{2})\s*(a\.\s*m\.|p\.\s*m\.|AM|PM)?/i);
      if (match) {
        let horas = parseInt(match[1], 10);
        const minutos = parseInt(match[2], 10);
        const ampm = match[3]?.toLowerCase();

        if (ampm) {
          if ((ampm.includes("p") || ampm.includes("pm")) && horas < 12) horas += 12;
          if ((ampm.includes("a") || ampm.includes("am")) && horas === 12) horas = 0;
        }
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), horas, minutos, 0);
        if (!isNaN(d.getTime())) return d;
      }
    } catch (e) {
      console.error("Error parseando hora de entrada:", e);
    }
  }

  return null;
}

export function ContadorEstancia({ fechaIngreso, entradaStr }) {
  const [estancia, setEstancia] = useState("00:00:00");

  useEffect(() => {
    const calcular = () => {
      const entrada = parseFechaIngreso(fechaIngreso, entradaStr);
      if (!entrada) {
        setEstancia("00:00:00");
        return;
      }

      const ahora = new Date();
      const diferenciaMs = ahora - entrada;

      if (diferenciaMs < 0) {
        setEstancia("00:00:00");
        return;
      }

      const totalSegundos = Math.floor(diferenciaMs / 1000);
      const horas = Math.floor(totalSegundos / 3600);
      const minutos = Math.floor((totalSegundos % 3600) / 60);
      const segundos = totalSegundos % 60;

      const horasStr = String(horas).padStart(2, "0");
      const minutosStr = String(minutos).padStart(2, "0");
      const segundosStr = String(segundos).padStart(2, "0");

      setEstancia(`${horasStr}:${minutosStr}:${segundosStr}`);
    };

    calcular();
    const intervalo = setInterval(calcular, 1000);
    return () => clearInterval(intervalo);
  }, [fechaIngreso, entradaStr]);

  return (
    <span className="inline-flex items-center gap-1.5 text-cyan-400 font-mono text-xs font-black tracking-widest bg-slate-900 border border-cyan-500/30 px-3 py-1 rounded-xl shadow-md shadow-cyan-950/20 select-none">
      <i className="fas fa-stopwatch text-cyan-400 text-[11px] animate-pulse"></i>
      <span>{estancia}</span>
    </span>
  );
}

export function calcularEstanciaMinutos(v) {
  if (v.minutosEstancia !== undefined && v.minutosEstancia !== null && !isNaN(parseInt(v.minutosEstancia, 10))) {
    const min = parseInt(v.minutosEstancia, 10);
    if (min >= 0) return min;
  }

  const isEnPlanta = v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--");
  const entrada = parseFechaIngreso(v.fechaIngreso, v.entrada);
  if (!entrada) return 0;

  if (isEnPlanta) {
    const ahora = new Date();
    const diffMs = ahora - entrada;
    return diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
  } else if (v.salida && v.salida !== "--:--") {
    const salidaDate = parseFechaIngreso(null, v.salida);
    if (salidaDate && salidaDate > entrada) {
      return Math.floor((salidaDate - entrada) / 60000);
    }
  }

  return 0;
}

export default function RegistroVisitantes() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [visitantes, setVisitantes] = useState([]);
  const [stats, setStats] = useState({ hoy: 0, enPlanta: 0, tiempoTotal: "0 min" });

  const [formData, setFormData] = useState({
    cedula: "", nombre: "", empresa: "", autoriza: "", area: "", motivo: ""
  });

  useEffect(() => { setMounted(true); }, []);

  const formatAMPM = (date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  useEffect(() => {
    if (!mounted) return;

    const unsub = onSnapshot(collection(db, "visitantes"), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      docs.sort((a, b) => {
        const dA = parseFechaIngreso(a.fechaIngreso, a.entrada);
        const dB = parseFechaIngreso(b.fechaIngreso, b.entrada);
        const msA = dA ? dA.getTime() : 0;
        const msB = dB ? dB.getTime() : 0;
        return msB - msA;
      });

      const inicioHoy = new Date(); 
      inicioHoy.setHours(0, 0, 0, 0);

      const visitantesRelevantes = docs.filter(v => {
        const isEnPlanta = v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--");
        if (isEnPlanta) return true;
        const fechaObj = parseFechaIngreso(v.fechaIngreso, v.entrada);
        return fechaObj && fechaObj >= inicioHoy;
      });

      setVisitantes(visitantesRelevantes);

      const enPlantaCount = docs.filter(v => v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--")).length;
      
      // Calcular la estancia total acumulada en minutos para todos los visitantes del día
      const estancias = visitantesRelevantes.map(v => calcularEstanciaMinutos(v));
      const totalMin = estancias.reduce((acc, min) => acc + min, 0);

      setStats({ hoy: visitantesRelevantes.length, enPlanta: enPlantaCount, tiempoTotal: `${totalMin} min` });
    }, (err) => {
      console.error("Error en tiempo real de visitantes:", err);
    });

    return () => unsub();
  }, [mounted]);

  const handleIngreso = async (e) => {
    e.preventDefault();
    if (!formData.cedula || !formData.nombre) return alert("Cédula y Nombre requeridos");
    try {
      await addDoc(collection(db, "visitantes"), {
        ...formData, 
        entrada: formatAMPM(new Date()), 
        salida: "--:--", 
        estado: "En Planta", 
        fechaIngreso: new Date()
      });
      registrarAccion(
        null, 
        null, 
        `Visitante registrado: ${formData.nombre} (Cédula: ${formData.cedula}) - Autorizado por: ${formData.autoriza || 'N/E'} - Destino: ${formData.area}`, 
        "Control de Visitantes"
      );
      setFormData({ cedula: "", nombre: "", empresa: "", autoriza: "", area: "", motivo: "" });
    } catch { alert("Error al guardar en la base de datos"); }
  };

  const handleSalida = async (id, fechaIngreso, entradaStr) => {
    try {
      const entrada = parseFechaIngreso(fechaIngreso, entradaStr) || new Date();
      const ahora = new Date();
      
      let minutos = Math.floor((ahora.getTime() - entrada.getTime()) / 60000);
      if (minutos < 0) minutos = 0; 
  
      await updateDoc(doc(db, "visitantes", id), { 
        salida: formatAMPM(ahora), 
        estado: "Finalizado", 
        minutosEstancia: minutos 
      });

      const visitor = visitantes.find(v => v.id === id);
      const visitorName = visitor ? visitor.nombre : id;
      registrarAccion(
        null, 
        null, 
        `Salida de visitante registrada: ${visitorName} (Estancia: ${minutos} min)`, 
        "Control de Visitantes"
      );
    } catch { alert("Error en salida"); }
  };

  const handlePrint = () => { window.print(); };

  const handlePDF = async () => {
    if (typeof window === "undefined") return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const docPdf = new jsPDF();
      const fecha = new Date().toLocaleDateString();

      const loadImage = (url) => new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
      const imgLogo = await loadImage('/logo.png');

      docPdf.setFillColor(248, 250, 252);
      docPdf.rect(0, 0, 210, 40, 'F');
      docPdf.setDrawColor(226, 232, 240);
      docPdf.line(0, 40, 210, 40);

      if (imgLogo) {
        docPdf.addImage(imgLogo, 'PNG', 15, 5, 30, 30);
        docPdf.setFontSize(18);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text("INVECEM - CONTROL DE ACCESO", 50, 20);
        docPdf.setFontSize(10);
        docPdf.setTextColor(71, 85, 105);
        docPdf.text(`Reporte generado el: ${fecha}`, 50, 30);
      } else {
        docPdf.setFontSize(18);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text("INVECEM - CONTROL DE ACCESO", 15, 20);
        docPdf.setFontSize(10);
        docPdf.setTextColor(71, 85, 105);
        docPdf.text(`Reporte generado el: ${fecha}`, 15, 30);
      }

      const columns = ["Visitante", "Empresa", "Cédula", "Área", "Entrada", "Salida", "Estado"];
      const rows = listaFiltrada.map(v => [
        v.nombre,
        v.empresa || "Particular",
        v.cedula,
        v.area,
        v.entrada,
        v.salida,
        v.estado
      ]);

      autoTable(docPdf, {
        head: [columns],
        body: rows,
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
      });

      docPdf.save(`Reporte_INVECEM_${fecha.replace(/\//g, '-')}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Error al cargar las herramientas de PDF.");
    }
  };

  if (!mounted) return null;

  const listaFiltrada = visitantes.filter(v => 
    v.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || v.cedula?.includes(busqueda)
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/inspector")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">
        
      {/* ENCABEZADO DE IMPRESIÓN */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6 w-full">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo Invecem" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-black uppercase text-indigo-955 tracking-tight">INVECEM</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Control de Visitantes - Reporte de Acceso</p>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-slate-500">
            <div>Fecha: {new Date().toLocaleDateString()}</div>
            <div>Tipo: Visitantes de Planta</div>
          </div>
        </div>

        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
              Control de Visitantes
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
              Registro y trazabilidad de accesos externos a las instalaciones de planta
            </p>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-cyan-600 uppercase self-start sm:self-auto shadow-md font-mono">
            FECHA: {new Date().toLocaleDateString()}
          </div>
        </header>

        {/* METRICS RESUMEN */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
          
          <div className="p-6 bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl flex items-center justify-between shadow-neon-cyan">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div>
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-1">Visitas Hoy</span>
              <p className="text-4xl font-black text-indigo-950">{stats.hoy}</p>
            </div>
            <div className="text-cyan-600/10 text-5xl group-hover:text-cyan-600/25 transition-colors">
              <i className="fas fa-address-book"></i>
            </div>
          </div>

          <div className="p-6 bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl flex items-center justify-between shadow-neon-red">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div>
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-1">Activos en Planta</span>
              <p className="text-4xl font-black text-red-600">{stats.enPlanta}</p>
            </div>
            <div className="text-red-500/10 text-5xl group-hover:text-red-500/25 transition-colors animate-pulse">
              <i className="fas fa-user-clock"></i>
            </div>
          </div>

          <div className="p-6 bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl relative overflow-hidden group hover:border-slate-300 transition-all duration-300 shadow-xl flex items-center justify-between shadow-neon-cyan">
            {/* Tech Corners */}
            <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div>
              <span className="text-xxs font-black text-slate-500 uppercase tracking-widest block mb-1">Tiempo Total Estancia</span>
              <p className="text-4xl font-black text-indigo-950">{stats.tiempoTotal}</p>
            </div>
            <div className="text-emerald-500/10 text-5xl group-hover:text-emerald-500/25 transition-colors">
              <i className="fas fa-history"></i>
            </div>
          </div>

        </section>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* SECCIÓN FORMULARIO DE REGISTRO */}
          <section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-2xl space-y-6 print:hidden relative shadow-neon-cyan">
            {/* Tech Corners */}
            <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

            <h3 className="text-sm font-black uppercase text-indigo-950 tracking-wider border-b border-slate-200/60 pb-3 flex items-center gap-2">
              <i className="fas fa-user-plus text-cyan-600"></i> Registrar Visitante
            </h3>
            
            <form onSubmit={handleIngreso} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 font-mono">CÉDULA</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Número de cédula (máx. 8 dígitos)" 
                    value={formData.cedula} 
                    onChange={e => setFormData({...formData, cedula: e.target.value.replace(/\D/g, "").slice(0, 8)})} 
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold focus:shadow-neon-cyan/40"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 font-mono">NOMBRE_COMPLETO</label>
                  <input 
                    type="text" 
                    placeholder="Nombres del visitante" 
                    value={formData.nombre} 
                    onChange={e => setFormData({...formData, nombre: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold focus:shadow-neon-cyan/40"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 font-mono">EMPRESA_ORIGEN</label>
                  <input 
                    type="text" 
                    placeholder="Procedencia o particular" 
                    value={formData.empresa} 
                    onChange={e => setFormData({...formData, empresa: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 font-mono">QUIEN_AUTORIZA</label>
                  <input 
                    type="text" 
                    placeholder="Personal de planta responsable" 
                    value={formData.autoriza} 
                    onChange={e => setFormData({...formData, autoriza: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 font-mono">ÁREA DE DESTINO</label>
                  <input 
                    list="areas-destino-sugeridas"
                    value={formData.area} 
                    onChange={e => setFormData({...formData, area: e.target.value})}
                    placeholder="Seleccione o escriba el área de destino..."
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold focus:shadow-neon-cyan/40 transition-all duration-200"
                  />
                  <datalist id="areas-destino-sugeridas">
                    <option value="Mantenimiento" />
                    <option value="Almacén" />
                    <option value="Producción" />
                    <option value="Protección Física" />
                    <option value="Compras" />
                    <option value="Finanzas" />
                    <option value="Tecnología" />
                    <option value="Automatización" />
                    <option value="Centro de Formación" />
                    <option value="OAC" />
                    <option value="Recursos Humanos" />
                    <option value="Logística" />
                    <option value="Administración" />
                    <option value="Plantas" />
                  </datalist>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">MOTIVO</label>
                  <input 
                    type="text" 
                    placeholder="Razón de visita" 
                    value={formData.motivo} 
                    onChange={e => setFormData({...formData, motivo: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold focus:shadow-neon-cyan/40"
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                className="w-full py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-sign-in-alt"></i> Ingresar a Planta
              </button>
            </form>
          </section>

          {/* SECCIÓN BASE DE DATOS VISITANTES */}
          <section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-2xl xl:col-span-2 space-y-6 relative shadow-neon-cyan">
            {/* Tech Corners */}
            <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200/60 pb-4 print:hidden">
              <div className="relative w-full md:flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                  <i className="fas fa-search"></i>
                </span>
                <input 
                  type="text" 
                  placeholder="Buscar por Nombre o Cédula..." 
                  onChange={e => setBusqueda(e.target.value)} 
                  className="w-full pl-11 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto justify-end">
                <button 
                  className="px-4 py-2 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-655 hover:text-red-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  onClick={handlePDF}
                >
                  <i className="fas fa-file-pdf"></i> PDF
                </button>
                <button 
                  className="px-4 py-2 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-655 hover:text-red-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  onClick={handlePrint}
                >
                  <i className="fas fa-print"></i> Imprimir
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-left font-mono">VISITANTE / ORIGEN</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center font-mono">CÉDULA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center font-mono">ÁREA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center font-mono">ENTRADA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center font-mono">ESTADO</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center print:hidden font-mono">GESTIÓN // ESTANCIA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-2 text-center hidden print:table-cell font-mono">SALIDA</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((v) => {
                    const isEnPlanta = v.estado?.toLowerCase() === "en planta" || (!v.salida || v.salida === "--:--");
                    return (
                      <tr key={v.id} className="border-b border-slate-100/60 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-2 text-left">
                          <strong className="text-xs font-black text-indigo-950 dark:text-white uppercase block">{v.nombre}</strong>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase mt-0.5 block font-mono">{v.empresa || "Particular"}</span>
                        </td>
                        <td className="py-4 px-2 text-center font-bold text-slate-600 dark:text-slate-200 text-xs font-mono">
                          {v.cedula}
                        </td>
                        <td className="py-4 px-2 text-center">
                          <span className="px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-300 rounded-lg text-xxs font-bold uppercase tracking-wider font-mono">
                            {v.area}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-center font-bold text-slate-700 dark:text-slate-200 text-xs font-mono">
                          {v.entrada}
                        </td>
                        <td className="py-4 px-2 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xxs font-extrabold tracking-wider uppercase inline-block border ${isEnPlanta ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}>
                            {isEnPlanta ? "EN PLANTA" : "RETIRADO"}
                          </span>
                        </td>
                        
                        {/* ACCIONES Y CRONÓMETRO DIGITAL */}
                        <td className="py-4 px-2 text-center print:hidden font-mono">
                          {isEnPlanta ? (
                            <div className="flex flex-col gap-2 items-center">
                              <ContadorEstancia fechaIngreso={v.fechaIngreso} entradaStr={v.entrada} />
                              <button 
                                className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 active:scale-90 text-white text-[10px] font-black tracking-wider uppercase rounded-lg shadow-md shadow-red-600/20 transition-all cursor-pointer hover:shadow-neon-red"
                                onClick={() => handleSalida(v.id, v.fechaIngreso, v.entrada)}
                              >
                                Marcar Salida
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase">
                              Salió: {v.salida} <span className="text-slate-400 dark:text-slate-400">({v.minutosEstancia || 0} min)</span>
                            </span>
                          )}
                        </td>
 
                        <td className="py-4 px-2 text-center font-bold text-slate-700 dark:text-slate-200 text-xs hidden print:table-cell font-mono">
                          {v.salida !== "--:--" ? v.salida : "EN PLANTA"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

