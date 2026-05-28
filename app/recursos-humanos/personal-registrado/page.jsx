"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase"; 
import Cookies from "js-cookie";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  updateDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";

const ESTADOS_NOMINALES = [
  "Activo (En funciones)",
  "Reposo Médico",
  "Vacaciones",
  "Inactivo"
];

export default function PersonalRegistrado() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("TODOS");

  const [claveMaestra, setClaveMaestra] = useState("");
  const [confirmarVieja, setConfirmarVieja] = useState(""); 
  const [nuevaClave, setNuevaClave] = useState("");
  const [editandoClave, setEditandoClave] = useState(false);

  // --- CONTROL DE AUSENCIAS ---
  const [showModal, setShowModal] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [usuarioParaEstado, setUsuarioParaEstado] = useState(null);
  const [fechas, setFechas] = useState({ inicio: "", fin: "" });

  const [showExpediente, setShowExpediente] = useState(false);
  const [usuarioExpediente, setUsuarioExpediente] = useState(null);
  const [notaAmonestacion, setNotaAmonestacion] = useState("");

  const normalizarFecha = (fechaStr) => {
    if (!fechaStr) return "";
    return fechaStr.replace(/-/g, '/').split('/').map(num => parseInt(num, 10)).join('/');
  };

  const limpiarID = (val) => val ? val.toString().trim().toLowerCase() : "";

  useEffect(() => {
    setIsClient(true);
    
    const d = new Date();
    const hoyLimpio = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

    const qPersonal = query(collection(db, "personal"), orderBy("fechaRegistro", "desc"));
    const unsubscribePersonal = onSnapshot(qPersonal, (snapshot) => {
      setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qAsistencias = query(collection(db, "asistencias"));
    const unsubscribeAsistencias = onSnapshot(qAsistencias, (snapshot) => {
      const marcadosHoy = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const fechaDoc = normalizarFecha(data.fecha); 
        
        if (fechaDoc === hoyLimpio) {
          if (data.cedula) marcadosHoy.push(limpiarID(data.cedula));
          if (data.ficha) marcadosHoy.push(limpiarID(data.ficha));
        }
      });
      setAsistenciasHoy(marcadosHoy);
    });

    const unsubscribeClave = onSnapshot(doc(db, "configuracion", "seguridad"), (doc) => {
      if (doc.exists()) setClaveMaestra(doc.data().claveExpedientes);
    });

    return () => {
      unsubscribePersonal();
      unsubscribeAsistencias();
      unsubscribeClave();
    };
  }, []);

  const verificarPresenciaHoy = (usuario) => {
    if (!usuario || asistenciasHoy.length === 0) return false;
    
    const fichaUser = limpiarID(usuario.ficha);
    const cedulaUser = limpiarID(usuario.cedula);
    const u4 = cedulaUser.slice(-4);
    const u5 = cedulaUser.slice(-5);

    return asistenciasHoy.some(valorMarcado => {
      return (
        (fichaUser && valorMarcado === fichaUser) || 
        (cedulaUser && valorMarcado === cedulaUser) ||
        (u4 && valorMarcado === u4) ||
        (u5 && valorMarcado === u5)
      );
    });
  };

  const verificarSiDebeMarcarFalta = (usuario) => {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const horaSalidaDefinida = usuario.horaSalida ? parseInt(usuario.horaSalida.split(':')[0]) : 16;
    return horaActual >= horaSalidaDefinida;
  };

  const guardarIncidencia = async (tipo, descripcion) => {
    if (!descripcion) return alert("⚠️ Por favor, escriba el detalle.");
    try {
      const userRef = doc(db, "personal", usuarioExpediente.id);
      const nuevaIncidencia = {
        id: Date.now(), 
        tipo: tipo,
        descripcion: descripcion,
        fecha: new Date().toLocaleString('es-ES'),
        registradoPor: Cookies.get("user_session") || "Admin RRHH"
      };

      await updateDoc(userRef, {
        historialIncidencias: arrayUnion(nuevaIncidencia)
      });

      setNotaAmonestacion("");
      setUsuarioExpediente(prev => ({
        ...prev,
        historialIncidencias: prev.historialIncidencias ? [...prev.historialIncidencias, nuevaIncidencia] : [nuevaIncidencia]
      }));
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const registrarInasistenciaAutomatica = async (usuario) => {
    const d = new Date();
    const hoyStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    
    const yaRegistrada = usuario.historialIncidencias?.some(inc => 
      inc.tipo === "FALTA" && inc.descripcion.includes(hoyStr)
    );

    if (!yaRegistrada && !verificarPresenciaHoy(usuario) && verificarSiDebeMarcarFalta(usuario)) {
      try {
        const userRef = doc(db, "personal", usuario.id);
        const nuevaFalta = {
          id: Date.now(),
          tipo: "FALTA",
          descripcion: `Inasistencia ${hoyStr} - AUSENCIA TOTAL JORNADA`,
          fecha: new Date().toLocaleString('es-ES'),
          registradoPor: "SISTEMA AUTOMÁTICO"
        };

        await updateDoc(userRef, {
          historialIncidencias: arrayUnion(nuevaFalta)
        });
        
        setUsuarioExpediente(prev => ({
          ...prev,
          historialIncidencias: prev.historialIncidencias ? [...prev.historialIncidencias, nuevaFalta] : [nuevaFalta]
        }));
      } catch (error) {
        console.error("Error en registro automático:", error);
      }
    }
  };

  const eliminarIncidencia = async (item) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro del historial?")) return;
    try {
      const userRef = doc(db, "personal", usuarioExpediente.id);
      await updateDoc(userRef, {
        historialIncidencias: arrayRemove(item)
      });
      setUsuarioExpediente(prev => ({
        ...prev,
        historialIncidencias: prev.historialIncidencias.filter(i => i.id !== item.id)
      }));
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  };

  const actualizarClaveMaestra = async () => {
    if (!confirmarVieja || !nuevaClave) { alert("⚠️ Debes completar ambos campos."); return; }
    if (confirmarVieja !== claveMaestra) { alert("❌ La clave actual es incorrecta."); return; }
    try {
      await updateDoc(doc(db, "configuracion", "seguridad"), { claveExpedientes: nuevaClave });
      alert("🔐 Clave Maestra actualizada.");
      setNuevaClave(""); setConfirmarVieja(""); setEditandoClave(false);
    } catch (error) { alert(error.message); }
  };

  const manejarAccesoExpediente = (user) => {
    const pin = prompt("🔐 SEGURIDAD INVECEM: Ingrese clave de Recursos Humanos:");
    if (pin === claveMaestra) {
      setUsuarioExpediente(user);
      setShowExpediente(true);
      if (!verificarPresenciaHoy(user)) {
        registrarInasistenciaAutomatica(user);
      }
    } else if (pin !== null) { alert("❌ Clave incorrecta."); }
  };

  const handleEliminar = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${nombre}?`)) {
      try { await deleteDoc(doc(db, "personal", id)); } catch (error) { alert(error.message); }
    }
  };

  const handleCambioEstatus = (user, nuevoEstatus) => {
    if (nuevoEstatus === "Vacaciones" || nuevoEstatus === "Reposo Médico") {
      setUsuarioParaEstado(user);
      setTipoSeleccionado(nuevoEstatus);
      setFechas({ inicio: "", fin: "" });
      setShowModal(true);
    } else {
      cambiarEstatusFirebase(user.id, nuevoEstatus, null, null);
    }
  };

  const cambiarEstatusFirebase = async (id, nuevoEstatus, inicio, fin) => {
    try {
      const esActivo = nuevoEstatus.includes("Activo");
      await updateDoc(doc(db, "personal", id), { 
        estatus: nuevoEstatus, 
        estado: esActivo ? "Activo" : nuevoEstatus,
        fechaSalida: esActivo ? null : (inicio || null),
        fechaRegreso: esActivo ? null : (fin || null),
        fechaFin: esActivo ? null : (fin || null)
      });
    } catch (error) { 
      console.error(error); 
      alert("Error al actualizar el estatus.");
    }
  };

  const confirmarAusenciaMódulo = async () => {
    if (!fechas.inicio || !fechas.fin) {
      alert("⚠️ Debe rellenar la fecha de inicio y de regreso.");
      return;
    }
    await cambiarEstatusFirebase(usuarioParaEstado.id, tipoSeleccionado, fechas.inicio, fechas.fin);
    setShowModal(false);
    setUsuarioParaEstado(null);
  };

  const irAEditar = (id) => router.push(`/recursos-humanos/registro-personal?edit=${id}`);

  const usuariosFiltrados = usuarios.filter(u => {
    const texto = busqueda.toLowerCase();
    const coincideBusqueda = u.nombres?.toLowerCase().includes(texto) || u.apellidos?.toLowerCase().includes(texto) || u.ficha?.toLowerCase().includes(texto) || u.cedula?.includes(texto);
    const tipoUser = (u.tipoPersonal || "INVECEM").toUpperCase();
    let coincideTipo = filtroTipo === "TODOS" || (filtroTipo === "INVECEM" && tipoUser === "INVECEM") || (filtroTipo === "INCES" && tipoUser.includes("INCES")) || (filtroTipo === "PASANTES" && tipoUser === "PASANTE");
    return coincideBusqueda && coincideTipo;
  });

  const generarPDF = async () => {
    if (typeof window === "undefined") return;
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const docPdf = new jsPDF('l', 'mm', 'a4');
      docPdf.setFontSize(18);
      docPdf.setTextColor(0, 139, 139); 
      docPdf.text(`REPORTE DE PERSONAL - INVECEM`, 14, 20);
      docPdf.setFontSize(10);
      docPdf.setTextColor(100);
      docPdf.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 14, 28);
      const tableRows = usuariosFiltrados.map(u => [
        u.ficha || "---", u.cedula || "N/A", `${u.nombres} ${u.apellidos}`.toUpperCase(), u.tipoPersonal || "INVECEM", u.cargo || "N/A", u.area || "N/A", u.estatus || "Activo"
      ]);
      autoTable(docPdf, {
        head: [['Ficha', 'Cédula', 'Nombre Completo', 'ID', 'Cargo', 'Área', 'Estado']],
        body: tableRows,
        startY: 35,
        headStyles: { fillColor: [0, 139, 139], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });
      docPdf.save(`Reporte_Personal_${filtroTipo}.pdf`);
    } catch (error) { alert("Error al generar PDF."); }
  };

  if (!isClient) return null;

  return (
    <div className="container main-wrapper">
      <header className="invecem-header">
        <div className="logo-box">
          SYSTEM-CONTROL<span className="red-text"> INVECEM</span>
        </div>
        <button className="btn-return" onClick={() => router.push("/recursos-humanos")}>VOLVER </button>
      </header>

      {/* MODAL DE SELECCIÓN DE FECHAS */}
      {showModal && usuarioParaEstado && (
        <div className="modal-overlay">
          <div className="modal-content shadow-relief" style={{ width: '450px', border: '3px solid #e30613' }}>
            <h2 className="title" style={{ fontSize: '24px', marginBottom: '10px', textTransform: 'uppercase' }}>
              Registrar {tipoSeleccionado}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', marginBottom: '20px' }}>
              Trabajador: <span style={{ color: '#0f172a' }}>{usuarioParaEstado.nombres} {usuarioParaEstado.apellidos}</span>
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="exp-label" style={{ marginBottom: '6px', display: 'block' }}>Fecha de Inicio:</label>
                <input 
                  type="date" 
                  className="search-input" 
                  style={{ width: '100%', padding: '10px' }} 
                  value={fechas.inicio}
                  onChange={(e) => setFechas({ ...fechas, inicio: e.target.value })}
                />
              </div>
              
              <div>
                <label className="exp-label" style={{ marginBottom: '6px', display: 'block' }}>Fecha de Retorno / Fin:</label>
                <input 
                  type="date" 
                  className="search-input" 
                  style={{ width: '100%', padding: '10px' }} 
                  value={fechas.fin}
                  onChange={(e) => setFechas({ ...fechas, fin: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px', justifyContent: 'flex-end' }}>
              <button 
                className="btn-delete" 
                style={{ background: '#64748b', boxShadow: '0 3px 0px #475569' }} 
                onClick={() => { setShowModal(false); setUsuarioParaEstado(null); }}
              >
                Cancelar
              </button>
              <button 
                className="btn-print" 
                style={{ padding: '8px 20px' }} 
                onClick={confirmarAusenciaMódulo}
              >
                Confirmar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPEDIENTE */}
      {showExpediente && usuarioExpediente && (
        <div className="modal-overlay">
          <div className="modal-content shadow-relief border-turquesa-full" style={{ width: '950px', maxWidth: '95vw' }}>
            <div className="modal-header-exp">
                <h2 className="modal-title">Expediente de Personal</h2>
                <span className="badge-id">Ficha: {usuarioExpediente.ficha}</span>
            </div>
            
            <div className="expediente-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px' }}>
              <div className="registro-seccion">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <div className="exp-section"><p className="exp-label">Empleado</p><p className="exp-value">{usuarioExpediente.nombres} {usuarioExpediente.apellidos}</p></div>
                  <div className="exp-section"><p className="exp-label">Cédula</p><p className="exp-value">{usuarioExpediente.cedula}</p></div>
                  <div className="exp-section"><p className="exp-label">Cargo</p><p className="exp-value">{usuarioExpediente.cargo}</p></div>
                  <div className="exp-section">
                    <p className="exp-label">Horario / Turno</p>
                    <p className="exp-value" style={{color: '#0369a1'}}>
                      {usuarioExpediente.horaEntrada && usuarioExpediente.horaSalida 
                        ? `${usuarioExpediente.horaEntrada} a ${usuarioExpediente.horaSalida}` 
                        : (usuarioExpediente.regimenLaboral || "No asignado")}
                    </p>
                  </div>
                  <div className="exp-section"><p className="exp-label">Fecha de Ingreso</p><p className="exp-value">{usuarioExpediente.fechaIngreso || "No registrada"}</p></div>
                  <div className="exp-section"><p className="exp-label">Estatus Actual</p><p className="exp-value" style={{color: '#008b8b'}}>{usuarioExpediente.estatus}</p></div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

                <div>
                  <p className="exp-label">Registrar Amonestación / Observación</p>
                  <textarea 
                    className="search-input" 
                    style={{ width: '100%', height: '80px', margin: '10px 0', border: '1px solid #008b8b' }}
                    placeholder="Escriba aquí los detalles..."
                    value={notaAmonestacion}
                    onChange={(e) => setNotaAmonestacion(e.target.value)}
                  />
                  <button className="btn-print" style={{ width: '100%' }} onClick={() => guardarIncidencia("AMONESTACIÓN", notaAmonestacion)}>
                    Guardar en Historial
                  </button>
                </div>

                <div className="exp-info-box" style={{ marginTop: '20px', background: '#fff7ed', padding: '15px', borderRadius: '10px', border: '1px solid #fdba74' }}>
                  <p className="exp-label" style={{ color: '#c2410c' }}>Control de Asistencia (Estado Hoy)</p>
                  
                  {verificarPresenciaHoy(usuarioExpediente) ? (
                    <div style={{ marginTop: '10px', textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                      <p style={{ fontSize: '13px', color: '#16a34a', fontWeight: 'bold' }}>✅ Presente: Registro confirmado en sistema.</p>
                    </div>
                  ) : (
                    verificarSiDebeMarcarFalta(usuarioExpediente) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        <p style={{fontSize: '12px', fontWeight: 'bold', color: '#e30613'}}>⚠️ INASISTENCIA: No se detectó presencia hoy.</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button className="btn-historial" style={{flex: 1, border: '1px solid #008b8b', background: '#008b8b', color: 'white'}} onClick={() => guardarIncidencia("FALTA", `Inasistencia ${new Date().toLocaleDateString()} - JUSTIFICADA`)}>Justificar</button>
                          <button className="btn-delete" style={{flex: 1, background: '#e30613', color: 'white'}} onClick={() => guardarIncidencia("FALTA", `Inasistencia ${new Date().toLocaleDateString()} - INJUSTIFICADA`)}>Injustificada</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '10px', textAlign: 'center', padding: '10px', background: '#f0f9ff', borderRadius: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#0369a1' }}>
                          ⏳ Jornada en curso: Esperando registro del trabajador.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="historial-lista" style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', maxHeight: '550px', overflowY: 'auto', border: '1px solid #e2e8f0' }}>
                <p className="exp-label" style={{ marginBottom: '10px' }}>Línea de Tiempo del Trabajador</p>
                {usuarioExpediente.historialIncidencias?.length > 0 ? (
                  usuarioExpediente.historialIncidencias.slice().reverse().map((item, index) => {
                    const esJustificada = item.descripcion.includes('JUSTIFICADA');
                    const colorBorde = esJustificada ? '#008b8b' : (item.tipo === 'FALTA' ? '#e30613' : '#008b8b');
                    
                    return (
                      <div key={item.id || index} style={{ position: 'relative', background: 'white', padding: '12px', borderRadius: '8px', marginBottom: '12px', borderLeft: `5px solid ${colorBorde}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <button 
                          onClick={() => eliminarIncidencia(item)}
                          style={{ position: 'absolute', right: '10px', top: '10px', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                        >
                          ×
                        </button>
                        <div style={{display: 'flex', justifyContent: 'space-between', paddingRight: '20px'}}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>{item.fecha}</span>
                          <span style={{ fontSize: '9px', color: colorBorde, fontWeight: '900' }}>{item.tipo}</span>
                        </div>
                        <p style={{ fontSize: '13px', margin: '5px 0', color: '#334155' }}>{item.descripcion}</p>
                        <p style={{ fontSize: '9px', textAlign: 'right', color: '#94a3b8', fontStyle: 'italic' }}>Reg: {item.registradoPor}</p>
                      </div>
                    )
                  })
                ) : (
                  <div style={{ textAlign: 'center', marginTop: '50px' }}><p style={{ fontSize: '12px', color: '#94a3b8' }}>Este expediente no posee registros aún.</p></div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-confirm" onClick={() => setShowExpediente(false)}>Finalizar Consulta</button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA PRINCIPAL */}
      <div className="header-section no-print" style={{marginTop: '20px'}}>
        <div className="title-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div>
            <h1 className="title">Personal Registrado</h1>
            <div className="total-badge">Registros encontrados: {usuariosFiltrados.length}</div>
          </div>
          <div className="seguridad-box shadow-relief no-print">
             <label className="exp-label">🔐 Gestión Clave de Expedientes</label>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
               {editandoClave ? (
                 <>
                   <input type="password" placeholder="Clave ACTUAL..." className="clave-input full-width" onChange={(e) => setConfirmarVieja(e.target.value)} />
                   <input type="password" placeholder="Nueva Clave..." className="clave-input full-width" onChange={(e) => setNuevaClave(e.target.value)} />
                   <div style={{ display: 'flex', gap: '5px' }}>
                     <button className="btn-save-clave" style={{ flex: 1 }} onClick={actualizarClaveMaestra}>Confirmar</button>
                     <button className="btn-cancel-clave" onClick={() => setEditandoClave(false)}>X</button>
                   </div>
                 </>
               ) : (
                 <button className="btn-edit-clave" onClick={() => setEditandoClave(true)}>Configurar Clave Maestra</button>
               )}
             </div>
          </div>
        </div>
      </div>

      <div className="filters-bar no-print">
        <div className="btn-group">
          {["TODOS", "INVECEM", "INCES", "PASANTES"].map(f => (
            <button key={f} className={`btn-toggle ${filtroTipo === f ? "active" : ""}`} onClick={() => setFiltroTipo(f)}>{f}</button>
          ))}
        </div>
        <input type="text" placeholder="Buscar por nombre, ficha o cédula..." className="search-input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <div className="actions-buttons" style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn-record-new" 
              onClick={() => router.push("/recursos-humanos/personal-registrado/registrar-nuevo-personal")}
            >
              ➕ Registrar Nuevo Personal
            </button>
            <button className="btn-pdf" onClick={generarPDF}>Descargar PDF</button>
            <button className="btn-print" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      <div className="table-card shadow-relief">
        {loading ? (
          <div className="loader">Sincronizando...</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ficha</th><th>Cédula</th><th>Nombre y Apellido</th><th>ID</th><th>Cargo</th><th>Estatus</th><th className="text-center no-print">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((user) => (
                  <tr key={user.id}>
                    <td className="font-bold">{user.ficha || "---"}</td>
                    <td>{user.cedula}</td>
                    <td className="name-text">{user.nombres} {user.apellidos}</td>
                    <td><span className="badge-id">{user.tipoPersonal || "INVECEM"}</span></td>
                    <td className="cargo-text">{user.cargo}</td>
                    <td>
                      <select className={`status-select ${user.estatus?.toLowerCase().includes('activo') ? 'border-turquesa' : 'border-rojo'}`} value={user.estatus || "Activo (En funciones)"} onChange={(e) => handleCambioEstatus(user, e.target.value)}>
                        {ESTADOS_NOMINALES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>
                    <td className="actions-cell no-print">
                      <button className="btn-historial" onClick={() => manejarAccesoExpediente(user)}>Historial</button>
                      <button className="btn-edit" onClick={() => irAEditar(user.id)}>Editar</button>
                      <button className="btn-delete" onClick={() => handleEliminar(user.id, user.nombres)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .container { padding: 40px 20px; max-width: 1450px; margin: 0 auto; background-color: #f0f4f8; background-image: radial-gradient(#d1d5db 0.8px, transparent 0.8px); background-size: 24px 24px; min-height: 100vh; font-family: 'Inter', sans-serif; }
        
       /* --- CABECERA ESTILO PANEL (UNIFICADA) --- */
        .invecem-header { 
          background: #0f172a; 
          color: white; 
          padding: 12px 25px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 4px solid #e30613; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .logo-box { font-weight: 900; font-size: 20px; letter-spacing: -1px; }
        .red-text { color: #e30613; }
        
        .btn-return { 
          background: #e30613; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 8px; 
          cursor: pointer; 
          font-size: 11px; 
          font-weight: 800; 
          text-transform: uppercase;
          transition: 0.3s;
        }
        .btn-return:hover { background: #b8050f; transform: translateY(-2px); }

        .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-left: 8px solid #e30613; padding-left: 20px; }
        .seguridad-box { background: white; padding: 15px; border-radius: 12px; border: 2px solid #0f172a; width: 280px; box-shadow: 6px 6px 0px rgba(15, 23, 42, 0.1); }
        .clave-input { padding: 10px; border: 2px solid #f1f5f9; border-radius: 8px; font-size: 12px; width: 100%; margin-bottom: 8px; outline: none; }
        .title { color: #0f172a; font-size: 38px; font-weight: 900; letter-spacing: -1.5px; margin: 0; }
        .total-badge { font-weight: 900; color: white; background: #0f172a; padding: 8px 18px; border-radius: 12px; font-size: 13px; display: inline-block; margin-top: 10px; }
        .filters-bar { display: flex; gap: 15px; margin-bottom: 25px; align-items: center; background: white; padding: 15px; border-radius: 18px; border: 1px solid #e2e8f0; }
        .btn-record-new { background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 13px; box-shadow: 0 4px 0px #16a34a; }
        .btn-print, .btn-pdf { background: #e30613; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 13px; box-shadow: 0 4px 0px #b8050f; }
        .btn-pdf { background: #0f172a; box-shadow: 0 4px 0px #000; }
        .btn-group { display: flex; background: #f1f5f9; padding: 5px; border-radius: 12px; }
        .btn-toggle { border: none; padding: 10px 22px; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; }
        .btn-toggle.active { background: #0f172a; color: white; }
        .search-input { flex-grow: 1; padding: 14px; border: 2px solid #f1f5f9; border-radius: 12px; outline: none; font-weight: 600; }
        .table-card { background: white; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 10px 10px 0px #0f172a; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 20px 15px; text-align: left; color: #94a3b8; font-size: 11px; text-transform: uppercase; border-bottom: 3px solid #e30613; font-weight: 900; }
        td { padding: 18px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; }
        .name-text { font-weight: 800; text-transform: uppercase; color: #0f172a; }
        .cargo-text { font-weight: 800; color: #e30613; font-size: 12px; }
        .status-select { padding: 10px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid #e2e8f0; border-left: 6px solid #e30613; background: white; }
        .actions-cell { display: flex; gap: 8px; align-items: center; }
        .btn-historial { background: #e30613; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 10px; }
        .btn-edit { background: #3b82f6; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 10px; }
        .btn-delete { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 10px; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.9); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
        .modal-content { background: white; padding: 40px; border-radius: 24px; border: 2px solid #e30613; }
        .shadow-relief { box-shadow: 10px 10px 0px #0f172a; }
        .exp-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
        @media print { .no-print { display: none !important; } .container { background: white; padding: 0; } .table-card { box-shadow: none; border: 1px solid #000; } }
      `}</style>
    </div>
  );
}