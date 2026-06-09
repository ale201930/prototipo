/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, storage, registrarAccion } from "../../lib/firebase";
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

  const [showModal, setShowModal] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [usuarioParaEstado, setUsuarioParaEstado] = useState(null);
  const [fechas, setFechas] = useState({ inicio: "", fin: "" });
  const [showExpediente, setShowExpediente] = useState(false);
  const [usuarioExpediente, setUsuarioExpediente] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null
  });

  // Nuevos estados para archivos y modales
  const [pdfFile, setPdfFile] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  // Estados para modal de PIN y Alertas personalizadas
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinIngresado, setPinIngresado] = useState("");
  const [usuarioPendienteExpediente, setUsuarioPendienteExpediente] = useState(null);
  const [errorPin, setErrorPin] = useState("");

  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    title: "",
    message: ""
  });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTipo, setPreviewTipo] = useState("");

  const mostrarAlerta = (title, message) => {
    setAlertDialog({
      isOpen: true,
      title,
      message
    });
  };

  const usuarioExpedienteActual = usuarios.find(u => u.id === usuarioExpediente?.id) || usuarioExpediente;

  const normalizarFecha = (fechaStr) => {
    if (!fechaStr) return "";
    return fechaStr.replace(/-/g, '/').split('/').map(num => parseInt(num, 10)).join('/');
  };

  const limpiarID = (val) => val ? val.toString().trim().toLowerCase() : "";

  // Lógica para verificar si la fecha de retorno ya pasó
  const verificarRetornoAutomatico = async (usuario) => {
    if (!usuario.fechaFin || usuario.estatus === "Activo (En funciones)") return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [year, month, day] = usuario.fechaFin.split("-").map(Number);
    const fechaFin = new Date(year, month - 1, day);

    if (hoy > fechaFin) {
      try {
        await updateDoc(doc(db, "personal", usuario.id), {
          estatus: "Activo (En funciones)",
          estado: "Activo",
          fechaSalida: null,
          fechaRegreso: null,
          fechaFin: null
        });
      } catch (error) {
        console.error("Error al reactivar usuario:", error);
      }
    }
  };

  useEffect(() => {
    setIsClient(true);

    const d = new Date();
    const hoyLimpio = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

    const qPersonal = query(collection(db, "personal"), orderBy("fechaRegistro", "desc"));
    const unsubscribePersonal = onSnapshot(qPersonal, (snapshot) => {
      const listaUsuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsuarios(listaUsuarios);
      setLoading(false);

      listaUsuarios.forEach(user => {
        if (user.estatus !== "Activo (En funciones)") {
          verificarRetornoAutomatico(user);
        }
      });
    });

    const qAsistencias = query(collection(db, "asistencias"));
    const unsubscribeAsistencias = onSnapshot(qAsistencias, (snapshot) => {
      const marcadosHoy = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        let fechaDoc = "";
        if (data.fecha) {
          fechaDoc = normalizarFecha(data.fecha);
        } else if (data.fechaHora) {
          const fDate = data.fechaHora.toDate ? data.fechaHora.toDate() : new Date(data.fechaHora);
          fechaDoc = `${fDate.getDate()}/${fDate.getMonth() + 1}/${fDate.getFullYear()}`;
        }
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
    return asistenciasHoy.some(valorMarcado => (fichaUser && valorMarcado === fichaUser) || (cedulaUser && valorMarcado === cedulaUser) || (u4 && valorMarcado === u4) || (u5 && valorMarcado === u5));
  };


  const verificarSiDebeMarcarFalta = (usuario) => {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const horaSalidaDefinida = usuario.horaSalida ? parseInt(usuario.horaSalida.split(':')[0]) : 16;
    return horaActual >= horaSalidaDefinida;
  };



  const registrarInasistenciaAutomatica = async (usuario) => {
    const d = new Date();
    const hoyStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const yaRegistrada = usuario.historialIncidencias?.some(inc => inc.tipo === "FALTA" && inc.descripcion.includes(hoyStr));
    if (!yaRegistrada && !verificarPresenciaHoy(usuario) && verificarSiDebeMarcarFalta(usuario)) {
      try {
        const userRef = doc(db, "personal", usuario.id);
        const nuevaFalta = { id: Date.now(), tipo: "FALTA", descripcion: `Inasistencia ${hoyStr} - INJUSTIFICADA`, fecha: new Date().toLocaleString('es-ES'), registradoPor: "SISTEMA AUTOMÁTICO" };
        await updateDoc(userRef, { historialIncidencias: arrayUnion(nuevaFalta) });
        setUsuarioExpediente(prev => ({ ...prev, historialIncidencias: prev.historialIncidencias ? [...prev.historialIncidencias, nuevaFalta] : [nuevaFalta] }));
      } catch (error) { console.error("Error en registro automático:", error); }
    }
  };



  const handleSubirAmonestacion = async () => {
    if (!pdfFile) return mostrarAlerta("Atención", "⚠️ Por favor, seleccione un archivo PDF.");
    setSubiendoArchivo(true);
    try {
      const fileRef = ref(storage, `amonestaciones/${usuarioExpediente.id}/${Date.now()}_${pdfFile.name}`);
      const snapshot = await uploadBytes(fileRef, pdfFile);
      const url = await getDownloadURL(snapshot.ref);
      
      const userRef = doc(db, "personal", usuarioExpediente.id);
      const operador = Cookies.get("user_name") || "Admin RRHH";
      const nuevaIncidencia = {
        id: Date.now(),
        tipo: "AMONESTACIÓN",
        descripcion: `Amonestación PDF: ${pdfFile.name}`,
        fecha: new Date().toLocaleString('es-ES'),
        registradoPor: operador,
        url: url
      };
      
      await updateDoc(userRef, { historialIncidencias: arrayUnion(nuevaIncidencia) });
      setPdfFile(null);
      setUsuarioExpediente(prev => ({
        ...prev,
        historialIncidencias: prev.historialIncidencias ? [...prev.historialIncidencias, nuevaIncidencia] : [nuevaIncidencia]
      }));

      registrarAccion(
        null,
        null,
        `Amonestación PDF subida para ${usuarioExpediente.nombres} ${usuarioExpediente.apellidos}: ${pdfFile.name}`,
        "Personal Registrado"
      );
      mostrarAlerta("Éxito", "✅ Amonestación guardada correctamente.");
    } catch (error) {
      mostrarAlerta("Error", "Error al subir archivo: " + error.message);
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const cambiarEstatusFaltaItem = async (item, nuevoEstatus, urlJustificativo = null) => {
    try {
      const userRef = doc(db, "personal", usuarioExpediente.id);
      const userActual = usuarios.find(u => u.id === usuarioExpediente.id) || usuarioExpediente;
      let historial = userActual.historialIncidencias ? [...userActual.historialIncidencias] : [];
      
      const idx = historial.findIndex(inc => inc.id === item.id);
      if (idx === -1) return;

      const operador = Cookies.get("user_name") || "Admin RRHH";
      const descOriginal = historial[idx].descripcion;
      let descNueva = descOriginal;
      if (descOriginal.includes(" - ")) {
        const parts = descOriginal.split(" - ");
        descNueva = `${parts[0]} - ${nuevoEstatus}`;
      } else {
        descNueva = `${descOriginal} - ${nuevoEstatus}`;
      }

      historial[idx] = {
        ...historial[idx],
        descripcion: descNueva,
        registradoPor: operador,
        url: urlJustificativo || null
      };

      await updateDoc(userRef, { historialIncidencias: historial });
      setUsuarioExpediente(prev => ({ ...prev, historialIncidencias: historial }));
      
      registrarAccion(
        null, 
        null, 
        `Estatus de inasistencia actualizado para ${usuarioExpediente.nombres} ${usuarioExpediente.apellidos} a ${nuevoEstatus} ${urlJustificativo ? `(Récipe adjunto)` : ''}`, 
        "Personal Registrado"
      );

      mostrarAlerta("Éxito", `✅ Inasistencia modificada a ${nuevoEstatus.toLowerCase()}.`);
    } catch (error) {
      mostrarAlerta("Error", "Error: " + error.message);
    }
  };

  const handleSubirJustificativoParaItem = async (e, item) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubiendoArchivo(true);
    try {
      const fileRef = ref(storage, `justificaciones/${usuarioExpediente.id}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      await cambiarEstatusFaltaItem(item, "JUSTIFICADA", url);
    } catch (error) {
      mostrarAlerta("Error", "Error al subir justificativo: " + error.message);
    } finally {
      setSubiendoArchivo(false);
      e.target.value = "";
    }
  };

  const handleCambioEstatusFalta = (item, valor) => {
    if (valor === "JUSTIFICADA") {
      const fileInput = document.getElementById(`input-justificar-${item.id}`);
      if (fileInput) {
        fileInput.click();
      }
    } else {
      setConfirmDialog({
        isOpen: true,
        title: "Cambiar Estatus a Injustificada",
        message: "¿Estás seguro de cambiar el estatus a INJUSTIFICADA? Esto eliminará el récipe médico/soporte adjunto si existe.",
        onConfirm: () => cambiarEstatusFaltaItem(item, "INJUSTIFICADA", null)
      });
    }
  };

  const eliminarIncidencia = (item) => {
    setConfirmDialog({
      isOpen: true,
      title: "Eliminar Incidencia",
      message: "¿Estás seguro de eliminar este registro del historial?",
      onConfirm: async () => {
        try {
          const userRef = doc(db, "personal", usuarioExpediente.id);
          await updateDoc(userRef, { historialIncidencias: arrayRemove(item) });
          setUsuarioExpediente(prev => ({ ...prev, historialIncidencias: prev.historialIncidencias.filter(i => i.id !== item.id) }));
          
          registrarAccion(
            null, 
            null, 
            `Incidencia eliminada del historial de ${usuarioExpediente.nombres} ${usuarioExpediente.apellidos}: ${item.tipo} - ${item.descripcion}`, 
            "Personal Registrado"
          );
        } catch (error) {
          mostrarAlerta("Error", "Error al eliminar: " + error.message);
        }
      }
    });
  };

  const actualizarClaveMaestra = async () => {
    if (!confirmarVieja || !nuevaClave) { mostrarAlerta("Atención", "⚠️ Debes completar ambos campos."); return; }
    if (confirmarVieja !== claveMaestra) { mostrarAlerta("Error", "❌ La clave actual es incorrecta."); return; }
    try {
      await updateDoc(doc(db, "configuracion", "seguridad"), { claveExpedientes: nuevaClave });
      mostrarAlerta("Éxito", "🔐 Clave de expedientes actualizada correctamente.");
      setNuevaClave(""); setConfirmarVieja(""); setEditandoClave(false);
    } catch (error) { mostrarAlerta("Error", error.message); }
  };

  const manejarAccesoExpediente = (user) => {
    setUsuarioPendienteExpediente(user);
    setPinIngresado("");
    setErrorPin("");
    setShowPinModal(true);
  };

  const confirmarAccesoExpediente = () => {
    if (pinIngresado === claveMaestra) {
      setUsuarioExpediente(usuarioPendienteExpediente);
      setShowExpediente(true);
      setShowPinModal(false);
      if (!verificarPresenciaHoy(usuarioPendienteExpediente)) {
        registrarInasistenciaAutomatica(usuarioPendienteExpediente);
      }
      setPinIngresado("");
      setErrorPin("");
    } else {
      setErrorPin("❌ Clave incorrecta. Por favor, intente de nuevo.");
    }
  };

  const handleEliminar = (id, nombre) => {
    setConfirmDialog({
      isOpen: true,
      title: "Eliminar Colaborador",
      message: `¿Estás seguro de eliminar a ${nombre}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "personal", id));
          registrarAccion(
            null, 
            null, 
            `Colaborador eliminado: ${nombre}`, 
            "Personal Registrado"
          );
        } catch (error) {
          alert("Error al eliminar: " + error.message);
        }
      }
    });
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

      const targetUser = usuarios.find(u => u.id === id);
      const targetName = targetUser ? `${targetUser.nombres} ${targetUser.apellidos}` : id;
      registrarAccion(
        null, 
        null, 
        `Estatus de colaborador actualizado (${targetName}) a ${nuevoEstatus} ${!esActivo ? `(Desde: ${inicio || 'N/A'}, Hasta: ${fin || 'N/A'})` : ''}`, 
        "Personal Registrado"
      );
    } catch (error) {
      console.error(error);
      mostrarAlerta("Error", "Error al actualizar el estatus.");
    }
  };

  const confirmarAusenciaModulo = async () => {
    if (!fechas.inicio || !fechas.fin) {
      mostrarAlerta("Atención", "⚠️ Debe rellenar la fecha de inicio y de regreso.");
      return;
    }
    await cambiarEstatusFirebase(usuarioParaEstado.id, tipoSeleccionado, fechas.inicio, fechas.fin);
    setShowModal(false);
    setUsuarioParaEstado(null);
  };

  const irAEditar = (id) => router.push(`/recursos-humanos/personal-registrado/registrar-nuevo-personal?edit=${id}`);

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

      const loadImage = (url) => new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
      const imgLogo = await loadImage('/logo.png');

      docPdf.setFillColor(248, 250, 252); docPdf.rect(0, 0, 297, 40, 'F');
      docPdf.setDrawColor(226, 232, 240); docPdf.line(0, 40, 297, 40);

      if (imgLogo) {
        docPdf.addImage(imgLogo, 'PNG', 15, 5, 30, 30);
        docPdf.setFontSize(18);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text(`REPORTE DE PERSONAL - INVECEM`, 50, 20);
        docPdf.setFontSize(10);
        docPdf.setTextColor(71, 85, 105);
        docPdf.text(`Fecha de emisión: ${new Date().toLocaleDateString()} | Tipo: ${filtroTipo}`, 50, 30);
      } else {
        docPdf.setFontSize(18);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text(`REPORTE DE PERSONAL - INVECEM`, 15, 20);
        docPdf.setFontSize(10);
        docPdf.setTextColor(71, 85, 105);
        docPdf.text(`Fecha de emisión: ${new Date().toLocaleDateString()} | Tipo: ${filtroTipo}`, 15, 30);
      }

      const tableRows = usuariosFiltrados.map(u => [
        u.ficha || "---", u.cedula || "N/A", `${u.nombres} ${u.apellidos}`.toUpperCase(), u.tipoPersonal || "INVECEM", u.cargo || "N/A", u.area || "N/A", u.estatus || "Activo"
      ]);

      autoTable(docPdf, {
        head: [['Ficha', 'Cédula', 'Nombre Completo', 'Tipo', 'Cargo', 'Área', 'Estado']],
        body: tableRows,
        startY: 45,
        headStyles: { fillColor: [6, 182, 212], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });
      docPdf.save(`Reporte_Personal_${filtroTipo}.pdf`);
    } catch (e) {
      console.error(e);
      mostrarAlerta("Error", "Error al generar PDF.");
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-10 cyber-grid">
      {/* Background glowing decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full blur-3xl opacity-15 animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-3xl opacity-10 animate-pulse-glow delay-1000"></div>

      {/* BARRA DE NAVEGACIÓN CORPORATIVA */}
      <nav className="top-nav print:hidden bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-6 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)" }}><i className="fas fa-fingerprint text-white" style={{ fontSize: "11px" }}></i></div><span className="text-base font-black tracking-tight text-slate-900 uppercase">INVECEM</span></div>
        <button
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer text-white hover:shadow-neon-cyan"
          onClick={() => router.push("/recursos-humanos")}
        >
          <i className="fas fa-arrow-left mr-2"></i> Volver
        </button>
      </nav>

      {/* CONTENEDOR CENTRAL */}
      <div className="max-w-7xl mx-auto px-6 py-10 z-10 relative">

        {/* MODAL DE SELECCIÓN DE FECHAS */}
        {showModal && usuarioParaEstado && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative shadow-neon-cyan/20">
              {/* Tech Corners */}
              <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                <i className="fas fa-calendar-plus text-cyan-600"></i> Registrar {tipoSeleccionado}
              </h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest pb-4 border-b border-slate-100 font-mono">
                EMPLEADO: <span className="text-cyan-600 font-extrabold">{usuarioParaEstado.nombres} {usuarioParaEstado.apellidos}</span>
              </p>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_INICIO</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer"
                    value={fechas.inicio}
                    onChange={(e) => setFechas({ ...fechas, inicio: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">FECHA_RETORNO</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold cursor-pointer"
                    value={fechas.fin}
                    onChange={(e) => setFechas({ ...fechas, fin: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  onClick={() => { setShowModal(false); setUsuarioParaEstado(null); }}
                >
                  Cancelar
                </button>
                <button
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer hover:shadow-neon-cyan"
                  onClick={confirmarAusenciaModulo}
                >
                  Confirmar Registro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EXPEDIENTE (HISTORIAL) */}
        {showExpediente && usuarioExpediente && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-8 w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] text-slate-800 relative shadow-neon-cyan/20">
              {/* Tech Corners */}
              <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              {/* Header Modal */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-200/60 mb-6">
                <div>
                  <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                    <i className="fas fa-folder-open text-cyan-600"></i> Expediente del Personal
                  </h2>
                  <p className="text-3xs font-bold text-slate-500 uppercase tracking-widest mt-0.5 font-mono">SYS_REGISTRAR // HISTORIAL_INCIDENCIAS</p>
                </div>
                <span className="px-3 py-1 bg-slate-50 border border-slate-200 text-cyan-600 rounded-xl text-xxs font-black tracking-wider uppercase font-mono">
                  FICHA: {usuarioExpedienteActual.ficha || "---"}
                </span>
              </div>

              {/* Body Modal */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-1">

                {/* Columna Izquierda: Detalles e Ingreso de Notas */}
                <div className="space-y-6">

                  {/* Datos Maestros Grid */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">EMPLEADO</p>
                      <p className="text-xs font-black text-indigo-955 uppercase mt-0.5">{usuarioExpedienteActual.nombres} {usuarioExpedienteActual.apellidos}</p>
                    </div>
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">CÉDULA</p>
                      <p className="text-xs font-extrabold text-slate-600 uppercase mt-0.5 font-mono">{usuarioExpedienteActual.cedula}</p>
                    </div>
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">
                        {usuarioExpedienteActual.tipoPersonal === "Pasante" 
                          ? "CARRERA" 
                          : usuarioExpedienteActual.tipoPersonal === "Estudiante INCES"
                          ? "PROGRAMA"
                          : "CARGO"}
                      </p>
                      <p className="text-xs font-extrabold text-cyan-705 uppercase mt-0.5">
                        {usuarioExpedienteActual.tipoPersonal === "Pasante" 
                          ? (usuarioExpedienteActual.carreraPasante || "Pasante") 
                          : usuarioExpedienteActual.tipoPersonal === "Estudiante INCES"
                          ? (usuarioExpedienteActual.programaInces || "Estudiante INCES")
                          : (usuarioExpedienteActual.cargo || "Sin cargo")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">
                        {usuarioExpedienteActual.tipoPersonal === "Pasante" 
                          ? "UNIVERSIDAD" 
                          : usuarioExpedienteActual.tipoPersonal === "Estudiante INCES"
                          ? "COHORTE"
                          : "ÁREA"}
                      </p>
                      <p className="text-xs font-extrabold text-slate-600 uppercase mt-0.5">
                        {usuarioExpedienteActual.tipoPersonal === "Pasante" 
                          ? (usuarioExpedienteActual.universidadPasante || "Sin Universidad") 
                          : usuarioExpedienteActual.tipoPersonal === "Estudiante INCES"
                          ? (usuarioExpedienteActual.cohorteInces || "Sin Cohorte")
                          : (usuarioExpedienteActual.area || "Sin área")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">HORARIO_TURNO</p>
                      <p className="text-xs font-black text-slate-700 uppercase mt-0.5">
                        {usuarioExpedienteActual.horaEntrada && usuarioExpedienteActual.horaSalida
                          ? `${usuarioExpedienteActual.horaEntrada} a ${usuarioExpedienteActual.horaSalida}`
                          : (usuarioExpedienteActual.regimenLaboral || "No asignado")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">FECHA_INGRESO</p>
                      <p className="text-xs font-extrabold text-slate-500 mt-0.5 font-mono">{usuarioExpedienteActual.fechaIngreso || "No registrada"}</p>
                    </div>
                    <div>
                      <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">STATUS_ACTUAL</p>
                      <p className="text-xs font-black text-emerald-600 uppercase mt-0.5">{usuarioExpedienteActual.estatus}</p>
                    </div>
                    {usuarioExpedienteActual.tipoPersonal === "Pasante" && (
                      <div>
                        <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider font-mono">CULMINACIÓN_PASANTÍA</p>
                        <p className="text-xs font-black text-amber-600 mt-0.5 font-mono">
                          {usuarioExpedienteActual.fechaEgreso ? usuarioExpedienteActual.fechaEgreso.split("-").reverse().join("/") : "No registrada"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Input Amonestación (Subir PDF) */}
                  <div className="space-y-3 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                    <label className="text-xxs font-black uppercase text-red-650 tracking-wider flex items-center gap-1.5 font-mono">
                      <i className="fas fa-file-pdf"></i> SYS_ADJUNTAR // AMONESTACIÓN (PDF)
                    </label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 bg-white hover:border-cyan-500/50 transition-colors relative cursor-pointer group">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={subiendoArchivo}
                      />
                      <i className="fas fa-file-pdf text-red-500 text-2xl mb-2 group-hover:scale-110 transition-transform"></i>
                      <span className="text-xs font-bold text-slate-700 truncate max-w-full">
                        {pdfFile ? pdfFile.name : "Seleccionar archivo PDF..."}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Haga clic para buscar</span>
                    </div>
                    <button
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-655 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                      onClick={handleSubirAmonestacion}
                      disabled={subiendoArchivo || !pdfFile}
                    >
                      {subiendoArchivo ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Subiendo PDF...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save"></i> Guardar Amonestación PDF
                        </>
                      )}
                    </button>
                  </div>

                </div>

                {/* Columna Derecha: Timeline del Expediente */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col h-[400px] lg:h-auto">
                  <p className="text-xxs font-black text-slate-500 uppercase tracking-widest mb-4">Historial de Registros</p>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {usuarioExpedienteActual.historialIncidencias?.length > 0 ? (
                      usuarioExpedienteActual.historialIncidencias.slice().reverse().map((item, index) => {
                        const esJustificada = item.descripcion.includes('JUSTIFICADA');
                        const isFalta = item.tipo === 'FALTA';

                        return (
                          <div
                            key={item.id || index}
                            className={`p-3.5 bg-white border border-slate-200 rounded-xl relative border-l-4 ${esJustificada ? "border-l-cyan-500" : (isFalta ? "border-l-red-500" : "border-l-purple-500")}`}
                          >
                            <button
                              onClick={() => eliminarIncidencia(item)}
                              className="absolute right-3 top-3 text-slate-400 hover:text-red-500 transition-colors text-xs font-extrabold cursor-pointer"
                              title="Eliminar registro"
                            >
                              <i className="fas fa-times"></i>
                            </button>

                            <div className="flex justify-between items-center mb-1">
                              <span className="text-3xs font-black text-slate-450 font-mono">{item.fecha}</span>
                              <span className={`text-4xs font-black tracking-widest uppercase px-1.5 py-0.5 rounded font-mono ${esJustificada ? "bg-cyan-50 text-cyan-600 border border-cyan-200" : (isFalta ? "bg-red-50 text-red-650 border border-red-200" : "bg-purple-50 text-purple-600 border border-purple-200")}`}>
                                {isFalta ? (esJustificada ? "JUSTIFICADA" : "INJUSTIFICADA") : item.tipo}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-slate-700 mt-2">{item.descripcion}</p>
                            
                            {isFalta ? (
                              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Estatus:</span>
                                  <select
                                    value={esJustificada ? "JUSTIFICADA" : "INJUSTIFICADA"}
                                    onChange={(e) => handleCambioEstatusFalta(item, e.target.value)}
                                    className={`px-2 py-1 bg-white border rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer focus:outline-none transition-all ${esJustificada ? "border-emerald-500/40 text-emerald-600 font-bold" : "border-red-500/40 text-red-600 font-bold"}`}
                                    disabled={subiendoArchivo}
                                  >
                                    <option value="INJUSTIFICADA" className="text-red-600 font-bold">INJUSTIFICADA</option>
                                    <option value="JUSTIFICADA" className="text-emerald-600 font-bold">JUSTIFICADA</option>
                                  </select>
                                </div>

                                <input
                                  type="file"
                                  id={`input-justificar-${item.id}`}
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleSubirJustificativoParaItem(e, item)}
                                  disabled={subiendoArchivo}
                                />

                                {item.url && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewUrl(item.url);
                                      setPreviewTipo(item.tipo);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[9px] font-black text-cyan-600 hover:text-cyan-700 uppercase tracking-widest font-mono bg-cyan-50 border border-cyan-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <i className="fas fa-file-medical"></i> Ver Récipe
                                  </button>
                                )}
                              </div>
                            ) : (
                              item.url && (
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewUrl(item.url);
                                      setPreviewTipo(item.tipo);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-cyan-600 hover:text-cyan-700 uppercase tracking-widest font-mono bg-cyan-50 border border-cyan-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <i className="fas fa-paperclip"></i> Ver Documento / Foto
                                  </button>
                                </div>
                              )
                            )}
                            <p className="text-4xs text-slate-500 text-right mt-1.5 italic font-bold font-mono">OPERATOR: {item.registradoPor}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <i className="fas fa-folder-open text-3xl mb-2"></i>
                        <p className="text-xxs font-bold uppercase tracking-wider font-sans">Sin incidencias en el historial</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer Modal */}
              <div className="border-t border-slate-200/60 pt-4 mt-6 flex justify-end">
                <button
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  onClick={() => setShowExpediente(false)}
                >
                  Finalizar Consulta
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ENCABEZADO DE IMPRESIÓN */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6 w-full">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo Invecem" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-black uppercase text-indigo-955 tracking-tight">INVECEM</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reporte de Personal Registrado</p>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-slate-500">
            <div>Fecha Emisión: {new Date().toLocaleDateString()}</div>
            <div>Total: {usuariosFiltrados.length} colaboradores</div>
          </div>
        </div>

        {/* ENCABEZADO PRINCIPAL DE LA VISTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-200/60 no-print">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-indigo-950 uppercase flex items-center gap-3">
              <i className="fas fa-users text-cyan-500"></i> Personal Registrado
            </h1>
            <div className="mt-2 inline-flex px-3 py-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 rounded-xl text-xxs font-black tracking-wider uppercase">
              Total: {usuariosFiltrados.length}
            </div>
          </div>

          {/* Gestión Clave de Expedientes */}
          <div className="no-print">
            <button
              onClick={() => {
                setConfirmarVieja("");
                setNuevaClave("");
                setEditandoClave(true);
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-650 hover:text-indigo-950 font-black uppercase text-xxs tracking-wider rounded-xl shadow-md transition-all duration-200 cursor-pointer flex items-center gap-2 font-mono"
            >
              <i className="fas fa-key text-cyan-500"></i> CLAVE DE ACCESO // EXPEDIENTES
            </button>
          </div>
        </div>

        {/* BARRA DE FILTRADO Y ACCIONES RÁPIDAS */}
        <div className="p-4 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl flex flex-col xl:flex-row justify-between items-center gap-4 mb-6 shadow-xl shadow-slate-200/10 no-print relative">
          {/* Tech Corners */}
          <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          {/* Tabs por Tipo */}
          <div className="flex flex-wrap gap-1.5 w-full xl:w-auto">
            {["TODOS", "INVECEM", "INCES", "PASANTES"].map(f => (
              <button
                key={f}
                className={`px-4 py-2 rounded-xl text-xxs font-black uppercase tracking-wider border transition-all duration-200 cursor-pointer ${filtroTipo === f ? "bg-gradient-to-r from-cyan-500 to-indigo-505 border-transparent text-white shadow-md shadow-indigo-500/20" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                onClick={() => setFiltroTipo(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative w-full xl:flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              <i className="fas fa-search"></i>
            </span>
            <input
              type="text"
              placeholder="Buscar por Nombre, Cédula, Ficha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold"
            />
          </div>

          {/* Acciones principales */}
          <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
            <button
              className="px-4 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-neon-cyan transition-all duration-200 cursor-pointer flex items-center gap-1.5"
              onClick={() => router.push("/recursos-humanos/personal-registrado/registrar-nuevo-personal")}
            >
              <i className="fas fa-plus"></i> Registrar Nuevo
            </button>

            <button
              className="px-4 py-3 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-600 hover:text-red-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
              onClick={generarPDF}
            >
              <i className="fas fa-file-pdf"></i> Descargar PDF
            </button>

            <button
              className="px-4 py-3 bg-red-50/50 hover:bg-red-100/50 border border-red-200 text-red-600 hover:text-red-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
              onClick={() => window.print()}
            >
              <i className="fas fa-print"></i> Imprimir
            </button>
          </div>

        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/10 p-4 md:p-6 relative shadow-neon-cyan/5">
          {/* Tech Corners */}
          <div className="absolute top-3 left-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>
          <div className="absolute top-3 right-3 font-mono text-[8px] text-slate-400 select-none">[+]</div>

          {loading ? (
            <div className="py-12 text-center text-xs font-black uppercase tracking-widest text-red-500 animate-pulse font-sans">
              <i className="fas fa-spinner fa-spin mr-2"></i> Conectando con la base de datos... Cargando registros...
            </div>
          ) : (
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60">
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center w-24 font-mono">FICHA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">CÉDULA</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">NOMBRES Y APELLIDOS</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">TIPO</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-left font-mono">CARGO / ÁREA (ACADEMIA)</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center font-mono">ESTATUS OPERACIONAL</th>
                    <th className="text-slate-500 font-bold text-xxs tracking-wider uppercase py-4 px-3 text-center no-print font-mono">ACCIONES EXPEDIENTE</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-450 font-bold italic text-sm font-sans">
                        No se encontraron colaboradores registrados.
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 border-b border-slate-100/60 transition-colors">

                        {/* Ficha */}
                        <td className="py-4 px-3 text-center font-black text-cyan-600 text-sm font-mono">
                          {user.ficha || "---"}
                        </td>

                        {/* Cédula */}
                        <td className="py-4 px-3 text-center font-bold text-slate-600 text-sm font-mono">
                          {user.cedula}
                        </td>

                        {/* Nombre y Apellido */}
                        <td className="py-4 px-3 text-left font-extrabold text-indigo-950 text-sm uppercase">
                          {user.nombres} {user.apellidos}
                        </td>

                        {/* ID (Tipo de personal) */}
                        <td className="py-4 px-3 text-center">
                          {user.tipoPersonal === "Pasante" ? (
                            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[9px] font-black tracking-widest uppercase font-mono">
                              Pasante
                            </span>
                          ) : user.tipoPersonal === "Estudiante INCES" ? (
                            <span className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-[9px] font-black tracking-widest uppercase font-mono">
                              Estudiante INCES
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[9px] font-black tracking-widest uppercase font-mono">
                              {user.tipoPersonal || "INVECEM"}
                            </span>
                          )}
                        </td>

                        {/* Cargo / Área / Información Académica */}
                        <td className="py-4 px-3 text-left">
                          {user.tipoPersonal === "Pasante" ? (
                            <>
                              <div className="font-extrabold text-cyan-700 text-xs uppercase">
                                {user.carreraPasante || "Pasante"}
                              </div>
                              <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">
                                {user.universidadPasante || "Sin Universidad"}
                              </div>
                              {user.fechaEgreso && (
                                <div className="text-[10px] font-bold text-amber-600 uppercase mt-1 font-mono">
                                  Culmina: <span className="font-black">{user.fechaEgreso.split("-").reverse().join("/")}</span>
                                </div>
                              )}
                            </>
                          ) : user.tipoPersonal === "Estudiante INCES" ? (
                            <>
                              <div className="font-extrabold text-cyan-700 text-xs uppercase">
                                {user.programaInces || "Estudiante INCES"}
                              </div>
                              <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">
                                Cohorte: {user.cohorteInces || "Sin Cohorte"}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-extrabold text-cyan-700 text-xs uppercase">
                                {user.cargo || "Sin cargo asignado"}
                              </div>
                              <div className="font-bold text-slate-500 text-xxs uppercase tracking-wider mt-0.5 font-mono">
                                {user.area || "Sin área asignada"}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Estatus Dropdown */}
                        <td className="py-4 px-3 text-center">
                          <div className="relative inline-block w-48">
                            <select
                              className={`w-full px-3 py-1.5 bg-white border rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer focus:outline-none transition-all ${user.estatus?.toLowerCase().includes('activo') ? 'border-emerald-500/40 text-emerald-600' : 'border-red-500/40 text-red-600'}`}
                              value={user.estatus || "Activo (En funciones)"}
                              onChange={(e) => handleCambioEstatus(user, e.target.value)}
                            >
                              {ESTADOS_NOMINALES.map(e => (
                                <option key={e} value={e} className="bg-white text-slate-700">
                                  {e}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-4 px-3 text-center no-print">
                          <div className="flex gap-2 justify-center items-center">

                            <button
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-950 p-2 rounded-xl text-xxs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer h-8 px-3 flex items-center justify-center gap-1 shadow-sm"
                              onClick={() => manejarAccesoExpediente(user)}
                              title="Ver expediente e incidencias"
                            >
                              <i className="fas fa-file-medical-alt text-cyan-600"></i> Historial
                            </button>

                            <button
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-950 p-2 rounded-xl text-xxs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer w-8 h-8 flex items-center justify-center shadow-sm"
                              onClick={() => irAEditar(user.id)}
                              title="Editar datos"
                            >
                              <i className="fas fa-edit"></i>
                            </button>

                            <button
                              className="bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 p-2 rounded-xl text-xxs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer w-8 h-8 flex items-center justify-center shadow-sm"
                              onClick={() => handleEliminar(user.id, user.nombres)}
                              title="Eliminar colaborador"
                            >
                              <i className="fas fa-trash-alt text-red-500"></i>
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in no-print">
            <div className="bg-white/95 backdrop-blur-xl border border-red-500/30 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative shadow-neon-red/10 text-slate-800 animate-slide-up">
              {/* Tech Corners */}
              <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-red-500"></i> {confirmDialog.title}
              </h2>
              <p className="text-sm font-semibold text-slate-650 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                >
                  Cancelar
                </button>
                <button
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all duration-200 cursor-pointer hover:shadow-neon-red"
                  onClick={async () => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    if (confirmDialog.onConfirm) await confirmDialog.onConfirm();
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {showPinModal && usuarioPendienteExpediente && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in no-print">
            <div className="bg-white/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative shadow-neon-cyan/10 text-slate-800 animate-slide-up">
              {/* Tech Corners */}
              <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                <i className="fas fa-lock text-cyan-500"></i> Control de Acceso
              </h2>
              <p className="text-sm font-semibold text-slate-655 leading-relaxed">
                Ingrese la clave de Recursos Humanos para ver el expediente de <span className="font-extrabold text-cyan-600 uppercase">{usuarioPendienteExpediente.nombres} {usuarioPendienteExpediente.apellidos}</span>:
              </p>

              <div className="space-y-2">
                <input
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  placeholder="Clave de acceso..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold"
                  value={pinIngresado}
                  onChange={(e) => setPinIngresado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmarAccesoExpediente();
                  }}
                />
                {errorPin && (
                  <p className="text-xs font-bold text-red-500 mt-1">{errorPin}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinIngresado("");
                    setErrorPin("");
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer hover:shadow-neon-cyan"
                  onClick={confirmarAccesoExpediente}
                >
                  Ver Expediente
                </button>
              </div>
            </div>
          </div>
        )}

        {editandoClave && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in no-print">
            <div className="bg-white/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative shadow-neon-cyan/10 text-slate-800 animate-slide-up">
              {/* Tech Corners */}
              <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                <i className="fas fa-key text-cyan-500"></i> Modificar Clave de Expedientes
              </h2>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest pb-4 border-b border-slate-100 font-mono">
                SEGURIDAD // RECURSOS_HUMANOS
              </p>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">Clave de Expedientes Actual</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Clave actual..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold"
                    value={confirmarVieja}
                    onChange={(e) => setConfirmarVieja(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500 font-mono">Nueva Clave de Seguridad</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Nueva clave..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold"
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  onClick={() => setEditandoClave(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer hover:shadow-neon-cyan"
                  onClick={actualizarClaveMaestra}
                >
                  Actualizar Clave
                </button>
              </div>
            </div>
          </div>
        )}

        {alertDialog.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-fade-in no-print">
            <div className="bg-white/95 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-6 relative shadow-neon-cyan/10 text-slate-800 animate-slide-up">
              {/* Tech Corners */}
              <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>
              <div className="absolute top-2 right-2 font-mono text-[8px] text-slate-400 select-none">[+]</div>

              <h2 className="text-xl font-black uppercase text-indigo-950 tracking-tight flex items-center gap-2">
                <i className="fas fa-info-circle text-cyan-500"></i> {alertDialog.title}
              </h2>
              <p className="text-sm font-semibold text-slate-650 leading-relaxed font-sans">
                {alertDialog.message}
              </p>

              <div className="flex justify-end pt-2">
                <button
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer hover:shadow-neon-cyan"
                  onClick={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL LIGHTBOX DE VISTA PREVIA (FOTOS Y PDFS) */}
        {previewUrl && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-fade-in no-print">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-3xl shadow-2xl relative flex flex-col max-h-[90vh] text-slate-800">
              <button
                className="absolute right-4 top-4 text-slate-400 hover:text-red-500 transition-colors text-lg font-black cursor-pointer z-10 animate-pulse-glow"
                onClick={() => { setPreviewUrl(null); setPreviewTipo(""); }}
              >
                <i className="fas fa-times"></i>
              </button>
              
              <h3 className="text-lg font-black uppercase text-indigo-955 tracking-tight mb-4 flex items-center gap-2">
                <i className="fas fa-eye text-cyan-500"></i> Vista Previa de Soporte
              </h3>

              <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl p-4 min-h-[300px]">
                {previewTipo === "AMONESTACIÓN" || previewUrl.startsWith("data:application/pdf") || previewUrl.toLowerCase().includes(".pdf") ? (
                  <embed
                    src={previewUrl}
                    type="application/pdf"
                    className="w-full h-[60vh] rounded-xl border border-slate-205"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-100"
                  />
                )}
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <a
                  href={previewUrl}
                  download="soporte_documento"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fas fa-download"></i> Descargar Archivo
                </a>
                <button
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer hover:shadow-neon-cyan"
                  onClick={() => { setPreviewUrl(null); setPreviewTipo(""); }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

