"use client";

import React, { useState, useEffect, Suspense } from "react"; 
import { useRouter, useSearchParams } from "next/navigation";
import { db, registrarAccion } from "@/app/lib/firebase"; 
import { 
  collection, addDoc, query, where, getDocs, 
  serverTimestamp, doc, getDoc, updateDoc 
} from "firebase/firestore";

const estadoInicial = {
  cedula: "", nombres: "", apellidos: "", ficha: "",
  cargo: "", area: "", tipoPersonal: "INVECEM", 
  programaInces: "", cohorteInces: "",
  universidadPasante: "", carreraPasante: "",       
  regimenLaboral: "NORMAL",
  fechaInicioCiclo: "", 
  horaEntrada: "07:00", horaSalida: "16:00", esNocturno: false,
  horaAlmuerzoInicio: "12:00", horaAlmuerzoFin: "13:00",
  estatus: "Activo (En funciones)", fechaIngreso: "",
  fechaEgreso: "", telefono: "", correo: "", fechaNacimiento: "",
};

function FormularioRegistro() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [fechaHoy, setFechaHoy] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(estadoInicial);

  useEffect(() => {
    if (editId) {
      const obtenerDatos = async () => {
        setLoading(true);
        try {
          const docRef = doc(db, "personal", editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
              const data = docSnap.data();
              setFormData({ ...data, esNocturno: data.esNocturno === true });
            }
        } catch (error) { console.error("Error:", error); }
        setLoading(false);
      };
      obtenerDatos();
    }
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    setFechaHoy(new Date().toLocaleDateString('es-ES', opciones).toUpperCase());
  }, [editId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const personalRef = collection(db, "personal");

      // Sanitizar campos según el tipo de personal para evitar datos residuales
      const datosASalvar = { ...formData };
      if (datosASalvar.tipoPersonal !== "Pasante") {
        datosASalvar.fechaEgreso = "";
        datosASalvar.universidadPasante = "";
        datosASalvar.carreraPasante = "";
      }
      if (datosASalvar.tipoPersonal !== "Estudiante INCES") {
        datosASalvar.programaInces = "";
        datosASalvar.cohorteInces = "";
      }
      if (datosASalvar.tipoPersonal !== "INVECEM") {
        datosASalvar.cargo = "";
        datosASalvar.area = "";
      }
      
      if (editId) {
        await updateDoc(doc(db, "personal", editId), { ...datosASalvar, ultimaActualizacion: serverTimestamp() });
        registrarAccion(
          null, 
          null, 
          `Colaborador modificado: ${datosASalvar.nombres} ${datosASalvar.apellidos} (Ficha: ${datosASalvar.ficha})`, 
          "Personal Registrado"
        );
        alert("✅ Registro actualizado.");
        router.push("/recursos-humanos/personal-registrado");
      } else {
        // Validación de Ficha
        const qFicha = query(personalRef, where("ficha", "==", datosASalvar.ficha));
        const queryFicha = await getDocs(qFicha);
        if (!queryFicha.empty) { 
            alert(`⚠️ La ficha ${datosASalvar.ficha} ya existe.`); 
            setLoading(false); 
            return; 
        }

        // Validación de Cédula
        const qCedula = query(personalRef, where("cedula", "==", datosASalvar.cedula));
        const queryCedula = await getDocs(qCedula);
        if (!queryCedula.empty) { 
            alert(`⚠️ La cédula ${datosASalvar.cedula} ya está registrada.`); 
            setLoading(false); 
            return; 
        }

        await addDoc(personalRef, { ...datosASalvar, fechaRegistro: serverTimestamp() });
        registrarAccion(
          null, 
          null, 
          `Nuevo colaborador registrado: ${datosASalvar.nombres} ${datosASalvar.apellidos} (Ficha: ${datosASalvar.ficha})`, 
          "Personal Registrado"
        );
        alert("✅ Personal registrado exitosamente.");
        setFormData(estadoInicial);
      }
    } catch (error) { alert("Error: " + error.message); }
    setLoading(false);
  };

  if (loading && editId && !formData.ficha) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-bold uppercase tracking-widest text-red-500 animate-pulse font-sans">
          <i className="fas fa-spinner fa-spin mr-2"></i> Conectando con la base de datos... Cargando expediente...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/recursos-humanos/personal-registrado")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-4xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-indigo-955 uppercase">
              {editId ? "Modificar Expediente" : "Registro de Personal"}
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
              {editId ? "Actualización de ficha técnica de planta" : "Ingreso de nuevo colaborador al sistema de nómina"}
            </p>
          </div>
          <div className="px-4 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-black text-cyan-600 uppercase self-start sm:self-auto shadow-md font-mono">
            {fechaHoy}
          </div>
        </header>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          {/* SECCIÓN 1: IDENTIFICACIÓN Y ESTATUS */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2 font-mono">
              <i className="fas fa-id-card"></i> IDENTIFICACION // STATUS
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">TIPO_PERSONAL</label>
                <select 
                  name="tipoPersonal" 
                  value={formData.tipoPersonal} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                >
                  <option value="INVECEM">TRABAJADOR INVECEM (FIJO)</option>
                  <option value="Estudiante INCES">ESTUDIANTE INCES</option>
                  <option value="Pasante">PASANTE (UNIVERSITARIO)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">ESTATUS_EXPEDIENTE</label>
                <select 
                  name="estatus" 
                  value={formData.estatus} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                >
                  <option>Activo (En funciones)</option>
                  <option>Reposo Médico</option>
                  <option>Vacaciones</option>
                  <option>Inactivo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">CÉDULA</label>
                <input 
                  type="text" 
                  name="cedula" 
                  value={formData.cedula} 
                  onChange={handleChange} 
                  required 
                  disabled={!!editId} 
                  placeholder="V-00000000"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed" 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">NOMBRES</label>
                <input 
                  type="text" 
                  name="nombres" 
                  value={formData.nombres} 
                  onChange={handleChange} 
                  required 
                  placeholder="Nombres"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">APELLIDOS</label>
                <input 
                  type="text" 
                  name="apellidos" 
                  value={formData.apellidos} 
                  onChange={handleChange} 
                  required 
                  placeholder="Apellidos"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: DATOS DEL CARGO / FORMACIÓN */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2 font-mono">
              <i className="fas fa-briefcase"></i> CARGO // ACADEMIA
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">NRO_FICHA</label>
                <input 
                  type="text" 
                  name="ficha" 
                  value={formData.ficha} 
                  onChange={handleChange} 
                  required 
                  placeholder="Ej. 12345"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                />
              </div>

              {formData.tipoPersonal === "INVECEM" && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">CARGO</label>
                    <input 
                      type="text" 
                      name="cargo" 
                      value={formData.cargo} 
                      onChange={handleChange} 
                      required 
                      placeholder="Cargo ocupado"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">ÁREA</label>
                    <select 
                      name="area" 
                      value={formData.area} 
                      onChange={handleChange} 
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Almacén">Almacén</option>
                      <option value="Producción">Producción</option>
                      <option value="Protección Física">Protección Física</option>
                      <option value="Administración">Administración</option>
                    </select>
                  </div>
                </>
              )}

              {formData.tipoPersonal === "Estudiante INCES" && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">PROGRAMA_INCES</label>
                    <input 
                      type="text" 
                      name="programaInces" 
                      value={formData.programaInces} 
                      onChange={handleChange} 
                      required 
                      placeholder="Ej. Electricidad"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono font-mono">COHORTE</label>
                    <input 
                      type="text" 
                      name="cohorteInces" 
                      value={formData.cohorteInces} 
                      onChange={handleChange} 
                      required 
                      placeholder="Ej. 2026-I"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                    />
                  </div>
                </>
              )}

              {formData.tipoPersonal === "Pasante" && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">UNIVERSIDAD</label>
                    <input 
                      type="text" 
                      name="universidadPasante" 
                      value={formData.universidadPasante} 
                      onChange={handleChange} 
                      required 
                      placeholder="Ej. UNEFA / UCV"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">CARRERA</label>
                    <input 
                      type="text" 
                      name="carreraPasante" 
                      value={formData.carreraPasante} 
                      onChange={handleChange} 
                      required 
                      placeholder="Ej. Ing. Mecánica"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold" 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA CULMINACIÓN PASANTÍA</label>
                    <input 
                      type="date" 
                      name="fechaEgreso" 
                      value={formData.fechaEgreso} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* SECCIÓN 3: JORNADA Y HORARIOS */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-600 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2 font-mono">
              <i className="fas fa-calendar-alt"></i> HORARIO // JORNADA_PLANTA
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">RÉGIMEN_LABORAL</label>
                <select 
                  name="regimenLaboral" 
                  value={formData.regimenLaboral} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                >
                  <option value="NORMAL">HORARIO NORMAL (Lun a Vie)</option>
                  <option value="TURNO_4X4">TURNO 4x4 (Rotativo)</option>
                </select>
              </div>

              {formData.regimenLaboral === "TURNO_4X4" && (
                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">SINCRONIZACION_CICLO (INICIO)</label>
                  <input 
                    type="date" 
                    name="fechaInicioCiclo" 
                    value={formData.fechaInicioCiclo} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer shadow-sm"
                  />
                  <span className="text-[10px] font-bold text-slate-400 block font-mono leading-relaxed">
                    Establece el inicio del ciclo de 8 días: 2 días de Día, 2 días de Noche y 4 días de Descanso. Permite calcular el turno actual según la fecha.
                  </span>
                </div>
              )}
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 space-y-6">
              <h4 className="text-xxs font-black text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <i className="fas fa-clock text-cyan-600"></i> Configuración de Horario
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bloque 1 */}
                <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Hora Entrada</label>
                      <input 
                        type="time" 
                        name="horaEntrada" 
                        value={formData.horaEntrada || ""} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs font-semibold cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Salida Almuerzo</label>
                      <input 
                        type="time" 
                        name="horaAlmuerzoInicio" 
                        value={formData.horaAlmuerzoInicio || ""} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs font-semibold cursor-pointer"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block font-mono">
                    {formData.regimenLaboral === "TURNO_4X4" 
                      ? "Ej. Turno Día: 07:00 a 12:00 | Ej. Turno Noche: 19:00 a 23:00" 
                      : "Ejemplo Normal: 07:00 a 12:00"}
                  </span>
                </div>

                {/* Bloque 2 */}
                <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Regreso Almuerzo</label>
                      <input 
                        type="time" 
                        name="horaAlmuerzoFin" 
                        value={formData.horaAlmuerzoFin || ""} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs font-semibold cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Hora Salida</label>
                      <input 
                        type="time" 
                        name="horaSalida" 
                        value={formData.horaSalida || ""} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-xs font-semibold cursor-pointer"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block font-mono">
                    {formData.regimenLaboral === "TURNO_4X4"
                      ? "Ej. Turno Día: 13:00 a 19:00 | Ej. Turno Noche: 00:00 a 07:00"
                      : "Ejemplo Normal: 13:00 a 16:00 (1:00 a 4:00)"}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center pt-2">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="esNocturno" 
                    checked={formData.esNocturno} 
                    onChange={handleChange}
                    className="w-5 h-5 rounded border border-slate-200 bg-white text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">TURNO_NOCTURNO</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_INGRESO</label>
                <input 
                  type="date" 
                  name="fechaIngreso" 
                  value={formData.fechaIngreso} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_NACIMIENTO</label>
                <input 
                  type="date" 
                  name="fechaNacimiento" 
                  value={formData.fechaNacimiento || ""} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">TELÉFONO</label>
                <input 
                  type="tel" 
                  name="telefono" 
                  value={formData.telefono} 
                  onChange={handleChange} 
                  required 
                  placeholder="Ej. 04121234567"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">CORREO</label>
                <input 
                  type="email" 
                  name="correo" 
                  value={formData.correo} 
                  onChange={handleChange} 
                  required 
                  placeholder="colaborador@invecem.com"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold"
                />
              </div>
            </div>
          </section>

          {/* FOOTER ACCIÓN */}
          <div className="pt-6 border-t border-slate-200/60 flex justify-end">
            <button 
              type="submit" 
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-650 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 transform cursor-pointer flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Sincronizando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Guardar Expediente
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function RegistrarPersonal() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-bold uppercase tracking-widest text-red-500 animate-pulse font-sans">
          <i className="fas fa-spinner fa-spin mr-2"></i> Cargando interfaz de registro...
        </div>
      </div>
    }>
      <FormularioRegistro />
    </Suspense>
  );
}

