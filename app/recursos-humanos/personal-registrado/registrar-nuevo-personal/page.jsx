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
  regimenLaboral: "NORMAL",
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
        router.push("/recursos-humanos/personal-registrado");
      } else {
        // Validación de Ficha
        const qFicha = query(personalRef, where("ficha", "==", formData.ficha));
        const queryFicha = await getDocs(qFicha);
        if (!queryFicha.empty) { 
            alert(`⚠️ La ficha ${formData.ficha} ya existe.`); 
            setLoading(false); 
            return; 
        }

        // Validación de Cédula (NUEVA VALIDACIÓN)
        const qCedula = query(personalRef, where("cedula", "==", formData.cedula));
        const queryCedula = await getDocs(qCedula);
        if (!queryCedula.empty) { 
            alert(`⚠️ La cédula ${formData.cedula} ya está registrada.`); 
            setLoading(false); 
            return; 
        }

        await addDoc(personalRef, { ...formData, fechaRegistro: serverTimestamp() });
        alert("✅ Personal registrado exitosamente.");
        setFormData(estadoInicial);
      }
    } catch (error) { alert("Error: " + error.message); }
    setLoading(false);
  };

  return (
    <div className="main-wrapper">
      {/* HEADER MOVIDO AFUERA DEL CONTAINER PARA QUE OCUPE EL 100% */}
      <header className="invecem-header">
        <div className="logo-box">
          SYSTEM-CONTROL<span className="red-text"> INVECEM</span>
        </div>
        <button className="btn-return" onClick={() => router.push("/recursos-humanos/personal-registrado")}>VOLVER </button>
      </header>

      <div className="container">
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
        .invecem-header { 
          background: #0f172a; 
          color: white; 
          padding: 12px 25px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 4px solid #e30613; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          width: 100%;
        }
        .logo-box { font-weight: 900; font-size: 20px; letter-spacing: -1px; }
        .red-text { color: #e30613; }
        
        .btn-return { 
          background: #e30613; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; text-transform: uppercase; transition: 0.3s;
        }
        .btn-return:hover { background: #b8050f; transform: translateY(-2px); }
        
        .main-wrapper { 
          background-color: #f0f4f8;
          background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px);
          background-size: 24px 24px;
          min-height: 100vh; 
          font-family: 'Inter', sans-serif; 
        }
        .container { max-width: 1000px; margin: 0 auto; position: relative; z-index: 1; padding: 40px 20px; }
        
        .form-card-invecem { 
          background: rgba(255, 255, 255, 0.94); 
          backdrop-filter: blur(10px); 
          border-radius: 28px; 
          position: relative; 
          overflow: hidden; 
          border: 1px solid rgba(255, 255, 255, 0.7); 
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.15); 
          padding: 60px; 
        }
        .block-title { font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 30px; display: flex; align-items: center; gap: 15px; letter-spacing: 1px; }
        .block-title::before { content: ""; width: 10px; height: 10px; background: #e30613; border-radius: 3px; display: inline-block; }
        .block-title::after { content: ""; flex: 1; height: 2px; background: #f1f5f9; }
        
        .red-accent-bar { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #e30613 0%, #b8050f 100%); }
        .form-top-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; }
        .company-name { font-size: 38px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -2px; }
        .badge-status { background: #f8fafc; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; margin-top: 8px; display: inline-block; border: 1px solid #e2e8f0; text-transform: uppercase; }
        .date-display { background: #0f172a; padding: 12px 24px; border-radius: 12px; font-weight: 700; color: #ffffff; font-size: 13px; }
        
        .form-row { display: grid; gap: 30px; margin-bottom: 20px; }
        .row-2 { grid-template-columns: 1fr 1fr; }
        .row-3 { grid-template-columns: repeat(3, 1fr); }
        .input-box { display: flex; flex-direction: column; gap: 10px; }
        .input-box label { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; padding-left: 4px; }
        input, select { padding: 15px; border: 2px solid #f1f5f9; border-radius: 14px; font-size: 15px; font-weight: 600; background: #f8fafc; color: #1e293b; }
        input:focus, select:focus { border-color: #e30613; outline: none; background: white; }
        .checkbox-center { justify-content: center; align-items: center; }
        .checkbox-label { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 700; color: #0f172a; font-size: 13px; padding: 10px 20px; border-radius: 12px; background: #f1f5f9; }
        .btn-submit-invecem { background: #e30613; color: white; border: none; padding: 20px 60px; border-radius: 16px; font-weight: 800; font-size: 16px; cursor: pointer; text-transform: uppercase; }
        .btn-submit-invecem:hover { background: #c20510; }
        .mt-15 { margin-top: 15px; }
        @media (max-width: 850px) { .row-3, .row-2 { grid-template-columns: 1fr; } .form-card-invecem { padding: 30px; border-radius: 0; } }
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