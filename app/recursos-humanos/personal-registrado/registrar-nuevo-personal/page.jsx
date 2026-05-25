"use client";

import React, { useState, useEffect, Suspense } from "react"; 
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/app/lib/firebase"; 
import { 
  collection, addDoc, query, where, getDocs, 
  serverTimestamp, doc, getDoc, updateDoc 
} from "firebase/firestore";

const estadoInicial = {
  cedula: "", nombres: "", apellidos: "", ficha: "",
  cargo: "", area: "", tipoPersonal: "INVECEM", 
  programaInces: "", cohorteInces: "",
  universidadPasante: "", carreraPasante: "",       
  regimenLaboral: "NORMAL", // Cambiado de ADMINISTRATIVO a NORMAL
  fechaInicioCiclo: "", 
  horaEntrada: "07:00", horaSalida: "16:00", esNocturno: false,
  estatus: "Activo (En funciones)", fechaIngreso: "",
  fechaEgreso: "", telefono: "", correo: "",
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
          if (docSnap.exists()) setFormData(docSnap.data());
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
      if (editId) {
        await updateDoc(doc(db, "personal", editId), { ...formData, ultimaActualizacion: serverTimestamp() });
        alert("✅ Registro actualizado.");
        router.push("/recursos-humanos/usuarios-registrados");
      } else {
        const qFicha = query(personalRef, where("ficha", "==", formData.ficha));
        const queryFicha = await getDocs(qFicha);
        if (!queryFicha.empty) { alert(`⚠️ La ficha ${formData.ficha} ya existe.`); setLoading(false); return; }
        await addDoc(personalRef, { ...formData, fechaRegistro: serverTimestamp() });
        alert("✅ Personal registrado exitosamente.");
        setFormData(estadoInicial);
      }
    } catch (error) { alert("Error: " + error.message); }
    setLoading(false);
  };

  return (
    <div className="main-wrapper">
      <div className="container">
        <header className="nav-header">
          <button className="btn-back-minimal" onClick={() => router.push("/recursos-humanos/personal-registrado")}>
            <span>←</span> Volver al Panel Principal
          </button>
        </header>

        <div className="form-card-invecem">
          <div className="red-accent-bar"></div>
          
          <div className="form-top-info">
            <div className="brand-section">
              <h1 className="company-name">INVECEM</h1>
              <span className="badge-status">{editId ? "EDICIÓN DE PERFIL" : "REGISTRO DE PERSONAL"}</span>
            </div>
            <div className="date-display">{fechaHoy}</div>
          </div>

          <form onSubmit={handleSubmit} className="styled-form">
            
            <div className="section-block">
              <h2 className="block-title">Identificación y Estatus</h2>
              <div className="form-row row-2">
                <div className="input-box select-box highlight">
                  <label>Tipo de Personal</label>
                  <select name="tipoPersonal" value={formData.tipoPersonal} onChange={handleChange}>
                    <option value="INVECEM">TRABAJADOR INVECEM (FIJO)</option>
                    <option value="Estudiante INCES">ESTUDIANTE INCES</option>
                    <option value="Pasante">PASANTE (UNIVERSITARIO)</option>
                  </select>
                </div>
                <div className="input-box select-box">
                  <label>Estatus del Colaborador</label>
                  <select name="estatus" value={formData.estatus} onChange={handleChange}>
                    <option>Activo (En funciones)</option>
                    <option>Reposo Médico</option>
                    <option>Vacaciones</option>
                    <option>Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="form-row row-3">
                <div className="input-box"><label>Cédula</label><input type="text" name="cedula" value={formData.cedula} onChange={handleChange} required disabled={!!editId} placeholder="V-00000000" /></div>
                <div className="input-box"><label>Nombres</label><input type="text" name="nombres" value={formData.nombres} onChange={handleChange} required /></div>
                <div className="input-box"><label>Apellidos</label><input type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} required /></div>
              </div>
            </div>

            <div className="section-block">
              <h2 className="block-title">Datos del Cargo / Formación</h2>
              <div className="form-row row-3">
                <div className="input-box"><label>Nro. de Ficha</label><input type="text" name="ficha" value={formData.ficha} onChange={handleChange} required placeholder="Ej. 12345" /></div>
                
                {formData.tipoPersonal === "INVECEM" && (
                  <>
                    <div className="input-box"><label>Cargo</label><input type="text" name="cargo" value={formData.cargo} onChange={handleChange} required /></div>
                    <div className="input-box">
                      <label>Área</label>
                      <select name="area" value={formData.area} onChange={handleChange} required>
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
                    <div className="input-box"><label>Programa</label><input type="text" name="programaInces" value={formData.programaInces} onChange={handleChange} required /></div>
                    <div className="input-box"><label>Cohorte</label><input type="text" name="cohorteInces" value={formData.cohorteInces} onChange={handleChange} required /></div>
                  </>
                )}

                {formData.tipoPersonal === "Pasante" && (
                  <>
                    <div className="input-box"><label>Universidad</label><input type="text" name="universidadPasante" value={formData.universidadPasante} onChange={handleChange} required /></div>
                    <div className="input-box"><label>Carrera</label><input type="text" name="carreraPasante" value={formData.carreraPasante} onChange={handleChange} required /></div>
                  </>
                )}
              </div>
            </div>

            <div className="section-block">
              <h2 className="block-title">Jornada y Horarios de Planta</h2>
              <div className="form-row row-2">
                <div className="input-box">
                  <label>Régimen Laboral</label>
                  <select name="regimenLaboral" value={formData.regimenLaboral} onChange={handleChange} className="select-primary">
                    <option value="NORMAL">HORARIO NORMAL (Lun a Vie)</option>
                    <option value="TURNO_4X4">TURNO 4x4 (Rotativo)</option>
                  </select>
                </div>

                {/* La sincronización solo aparece si es 4x4 */}
                {formData.regimenLaboral === "TURNO_4X4" && (
                  <div className="input-box highlight-input">
                    <label>Sincronización de Ciclo</label>
                    <input type="date" name="fechaInicioCiclo" value={formData.fechaInicioCiclo} onChange={handleChange} required />
                  </div>
                )}
              </div>

              <div className="form-row row-3 mt-15">
                <div className="input-box"><label>Entrada</label><input type="time" name="horaEntrada" value={formData.horaEntrada} onChange={handleChange} /></div>
                <div className="input-box"><label>Salida</label><input type="time" name="horaSalida" value={formData.horaSalida} onChange={handleChange} /></div>
                <div className="input-box checkbox-center">
                  <label className="checkbox-label">
                    <input type="checkbox" name="esNocturno" checked={formData.esNocturno} onChange={handleChange} />
                    <span>¿Turno Nocturno?</span>
                  </label>
                </div>
              </div>

              <div className="form-row row-3 mt-15">
                <div className="input-box"><label>Fecha Ingreso</label><input type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={handleChange} required /></div>
                <div className="input-box"><label>Teléfono</label><input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} required /></div>
                <div className="input-box"><label>Correo</label><input type="email" name="correo" value={formData.correo} onChange={handleChange} required /></div>
              </div>
            </div>

            <div className="form-footer">
              <button type="submit" className="btn-submit-invecem" disabled={loading}>
                {loading ? "Procesando..." : "GUARDAR REGISTRO"}
              </button>
            </div>
          </form>
        </div>
      </div>

     <style jsx>{`
        /* Fondos y Tipografía - ACTUALIZADO PARA MÁS ESTILO */
        .main-wrapper { 
          /* Fondo con gradiente sutil y patrón de puntos profesional */
          background-color: #f0f4f8;
          background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px);
          background-size: 24px 24px;
          min-height: 100vh; 
          padding: 60px 20px; 
          font-family: 'Inter', system-ui, -apple-system, sans-serif; 
          position: relative;
        }

        /* Añadimos un resplandor de color muy suave al fondo para que no sea solo gris */
        .main-wrapper::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 10% 20%, rgba(227, 6, 19, 0.03) 0%, transparent 40%),
                      radial-gradient(circle at 90% 80%, rgba(15, 23, 42, 0.03) 0%, transparent 40%);
          pointer-events: none;
        }
        
        .container { max-width: 1000px; margin: 0 auto; position: relative; z-index: 1; }
        
        /* Tarjeta Principal - EFECTO CRISTAL Y ELEVACIÓN */
        .form-card-invecem { 
          background: rgba(255, 255, 255, 0.94); /* Un toque de transparencia */
          backdrop-filter: blur(10px); /* Desenfoque de fondo tipo iOS/Mac */
          border-radius: 28px; 
          position: relative; 
          overflow: hidden; 
          border: 1px solid rgba(255, 255, 255, 0.7); 
          /* Sombra mucho más profunda y llamativa */
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.15), 
                      0 10px 10px -5px rgba(15, 23, 42, 0.04),
                      inset 0 0 0 1px rgba(255, 255, 255, 0.5); 
          padding: 60px; 
        }

        /* Títulos de sección con un toque de color para romper el blanco */
        .block-title { 
          font-size: 14px; 
          font-weight: 800; 
          color: #0f172a; 
          text-transform: uppercase; 
          margin-bottom: 30px; 
          display: flex; 
          align-items: center; 
          gap: 15px; 
          letter-spacing: 1px;
        }

        /* Indicador de color en el título para que se vea "Brutal" */
        .block-title::before {
          content: "";
          width: 10px;
          height: 10px;
          background: #e30613;
          border-radius: 3px;
          display: inline-block;
          box-shadow: 0 0 10px rgba(227, 6, 19, 0.4);
        }

        /* ... El resto de tus estilos se mantienen iguales ... */
        
        .nav-header { margin-bottom: 30px; }
        .btn-back-minimal { 
          background: white; border: 1px solid #e2e8f0; color: #475569; padding: 10px 16px;
          border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; 
          display: flex; align-items: center; gap: 10px; transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .btn-back-minimal:hover { color: #e30613; border-color: #e30613; transform: translateX(-5px); }

        .red-accent-bar { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #e30613 0%, #b8050f 100%); }
        .form-top-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; }
        .company-name { font-size: 38px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -2px; line-height: 1; }
        .badge-status { background: #f8fafc; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; margin-top: 8px; display: inline-block; border: 1px solid #e2e8f0; text-transform: uppercase; }
        .date-display { background: #0f172a; padding: 12px 24px; border-radius: 12px; font-weight: 700; color: #ffffff; font-size: 13px; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2); }
        .section-block { margin-bottom: 50px; }
        .block-title::after { content: ""; flex: 1; height: 2px; background: #f1f5f9; }
        .form-row { display: grid; gap: 30px; margin-bottom: 20px; }
        .row-2 { grid-template-columns: 1fr 1fr; }
        .row-3 { grid-template-columns: repeat(3, 1fr); }
        .input-box { display: flex; flex-direction: column; gap: 10px; }
        .input-box label { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; padding-left: 4px; }
        input, select { padding: 15px; border: 2px solid #f1f5f9; border-radius: 14px; font-size: 15px; font-weight: 600; transition: all 0.2s ease; background: #f8fafc; color: #1e293b; }
        input:hover, select:hover { border-color: #e2e8f0; }
        input:focus, select:focus { border-color: #e30613; outline: none; background: white; box-shadow: 0 0 0 4px rgba(227, 6, 19, 0.1); transform: translateY(-2px); }
        .select-primary { border-color: #0f172a; background: #ffffff; }
        .highlight-input input { border: 2px solid #3b82f6; background: #eff6ff; color: #1e40af; }
        .checkbox-center { justify-content: center; align-items: center; }
        .checkbox-label { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 700; color: #0f172a; font-size: 13px; padding: 10px 20px; border-radius: 12px; background: #f1f5f9; transition: 0.3s; }
        .checkbox-label:hover { background: #e2e8f0; }
        .checkbox-label input { width: 18px; height: 18px; accent-color: #e30613; cursor: pointer; }
        .form-footer { margin-top: 30px; display: flex; justify-content: flex-end; }
        .btn-submit-invecem { background: #e30613; color: white; border: none; padding: 20px 60px; border-radius: 16px; font-weight: 800; font-size: 16px; cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 20px rgba(227, 6, 19, 0.3); text-transform: uppercase; letter-spacing: 1px; }
        .btn-submit-invecem:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 15px 30px rgba(227, 6, 19, 0.4); background: #c20510; }
        .btn-submit-invecem:active { transform: translateY(0); }
        .mt-15 { margin-top: 15px; }
        @media (max-width: 850px) { .row-3, .row-2 { grid-template-columns: 1fr; } .form-card-invecem { padding: 30px; border-radius: 0; } .form-top-info { flex-direction: column; gap: 20px; align-items: flex-start; } }
      `}</style>
    </div>
  );
}

export default function RegistrarPersonal() {
  return (
    <Suspense fallback={<div>Cargando Aplicación...</div>}>
      <FormularioRegistro />
    </Suspense>
  );
}