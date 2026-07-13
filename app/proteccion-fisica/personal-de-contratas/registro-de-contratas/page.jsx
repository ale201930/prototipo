"use client";

import React, { useState, useEffect, Suspense } from "react";
import { db } from "@/app/lib/firebase";
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

function RegistroFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [formData, setFormData] = useState({
    cedula: "",
    idAccAccess: "", // ID de acceso auto-generado o ingresado
    idAcceso: "", // Los 5 dígitos para la "ficha" de contrata
    nombreContrata: "",
    nombres: "",
    apellidos: "",
    areaTrabajo: "Mantenimiento",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editId) {
      const cargarDatos = async () => {
        try {
          const docRef = doc(db, "contratistas", editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setFormData(docSnap.data());
          }
        } catch (error) {
          console.error("Error al cargar:", error);
        }
      };
      cargarDatos();
    }
  }, [editId]);

  const handleCedulaChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
    const ultimosCinco = val.slice(-5);
    setFormData({
      ...formData,
      cedula: val,
      idAcceso: editId ? formData.idAcceso : ultimosCinco
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.idAcceso.length !== 5) {
      alert("⚠️ El ID de acceso debe ser de exactamente 5 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const contratasRef = collection(db, "contratistas");

      if (editId) {
        const docRef = doc(db, "contratistas", editId);
        await updateDoc(docRef, {
          ...formData,
          ultimaActualizacion: serverTimestamp()
        });
        alert("✅ Datos actualizados con éxito");
        router.push("/proteccion-fisica/personal-de-contratas"); 
      } else {
        // VALIDACIÓN: Cédula duplicada
        const qCedula = query(contratasRef, where("cedula", "==", formData.cedula));
        const snapCedula = await getDocs(qCedula);
        
        if (!snapCedula.empty) {
          alert("⚠️ Esta cédula ya está registrada en el sistema de contratas.");
          setLoading(false);
          return;
        }

        // VALIDACIÓN: ID duplicado
        const qId = query(contratasRef, where("idAcceso", "==", formData.idAcceso));
        const snapId = await getDocs(qId);
        
        if (!snapId.empty) {
          alert(`⚠️ El ID ${formData.idAcceso} ya está asignado. Verifique los últimos 5 dígitos.`);
          setLoading(false);
          return;
        }

        await addDoc(contratasRef, {
          ...formData,
          tipoPersonal: "CONTRATISTA",
          estadoNominal: "Activo (Acceso Permitido)",
          fechaRegistro: serverTimestamp(),
        });
        
        alert("✅ Contratista registrado exitosamente");

        setFormData({
          cedula: "",
          idAcceso: "",
          nombreContrata: "",
          nombres: "",
          apellidos: "",
          areaTrabajo: "Mantenimiento",
        });
        
        router.push("/proteccion-fisica/personal-de-contratas");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Hubo un error al procesar el registro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN */}
      <nav className="top-nav bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#06b6d4,#3b82f6)"}}><i className="fas fa-fingerprint text-white" style={{fontSize:"11px"}}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-650 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/proteccion-fisica/personal-de-contratas")}
        >
          <i className="fas fa-arrow-left"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-4xl mx-auto px-6 py-10 z-10 relative">
        
        {/* ENCABEZADO DE REPORTE */}
        <header className="mb-8 border-l-6 border-cyan-500 pl-5">
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase">
            {editId ? "Modificar Contratista" : "Registro de Contratas"}
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Sistema de control de acceso y enrolamiento para personal externo
          </p>
        </header>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-cyan-605 tracking-wider border-b border-dashed border-cyan-500/20 pb-2 flex items-center gap-2 font-mono">
              <i className="fas fa-user-plus"></i> DATOS_ENROLAMIENTO // CONTRATA
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Cédula */}
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">CÉDULA_IDENTIDAD</label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="Ej: 25123456"
                  value={formData.cedula}
                  onChange={handleCedulaChange}
                  disabled={!!editId}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* ID Acceso */}
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-cyan-600 font-mono">ID_ACCESO (5 DÍGITOS)</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="00000"
                  value={formData.idAcceso}
                  onChange={(e) => setFormData({...formData, idAcceso: e.target.value.slice(0, 5)})}
                  className="w-full px-4 py-3 bg-white border border-cyan-305 rounded-xl text-cyan-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-extrabold tracking-widest"
                />
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Nombres */}
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">NOMBRES</label>
                <input
                  type="text"
                  required
                  placeholder="NOMBRES"
                  value={formData.nombres}
                  onChange={(e) => setFormData({...formData, nombres: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold"
                />
              </div>

              {/* Apellidos */}
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">APELLIDOS</label>
                <input
                  type="text"
                  required
                  placeholder="APELLIDOS"
                  value={formData.apellidos}
                  onChange={(e) => setFormData({...formData, apellidos: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold"
                />
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Empresa Contrata */}
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">EMPRESA_CONTRATA</label>
                <input
                  type="text"
                  required
                  placeholder="EMPRESA"
                  value={formData.nombreContrata}
                  onChange={(e) => setFormData({...formData, nombreContrata: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:shadow-neon-cyan/40 transition-all duration-200 text-sm font-semibold"
                />
              </div>

              {/* Área de Trabajo */}
              <div className="flex flex-col gap-2">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">AREA_TRABAJO</label>
                <select 
                  value={formData.areaTrabajo}
                  onChange={(e) => setFormData({...formData, areaTrabajo: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 text-sm font-semibold cursor-pointer"
                >
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Obras Civiles">Obras Civiles</option>
                  <option value="Servicios Generales">Servicios Generales</option>
                  <option value="Seguridad / Prevención">Seguridad / Prevención</option>
                </select>
              </div>

            </div>
          </section>

          {/* ACCIÓN DE GUARDADO */}
          <div className="pt-6 border-t border-slate-200/60 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-655 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Guardando...
                </>
              ) : editId ? (
                <>
                  <i className="fas fa-save"></i> Actualizar Registro
                </>
              ) : (
                <>
                  <i className="fas fa-user-check"></i> Enrolar Contratista
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}

export default function RegistroContratista() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center font-sans">
        <div className="text-xs font-black uppercase tracking-widest text-cyan-600 animate-pulse font-mono">
          <i className="fas fa-spinner fa-spin mr-2"></i> LOADING_INTERFACE...
        </div>
      </div>
    }>
      <RegistroFormContent />
    </Suspense>
  );
}
