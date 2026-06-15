"use client";

/**
 * useAutoInasistencias — v2
 *
 * Mejoras sobre v1:
 * ─ Solo procesa un día si existe al menos UN registro de asistencia ese día
 *   (evidencia de que el sistema estaba activo). Si nadie marcó entrada ese
 *   día, se omite el día completo para evitar marcar faltas masivas falsas.
 * ─ Verifica que la fecha sea >= fechaIngreso del trabajador.
 * ─ Reduce lookback a 30 días para limitar el alcance retroactivo.
 * ─ Primera ejecución: limpia las faltas del 16/4/2026 que se registraron
 *   incorrectamente antes de la corrección.
 */

import { useEffect, useRef } from "react";
import { db } from "@/app/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

// ─── Helpers ────────────────────────────────────────────────────────────────

function esDiaLaboral(fecha, worker) {
  const diaSemana = fecha.getDay();
  if (worker.regimenLaboral === "TURNO_4X4") {
    let fechaBase;
    if (worker.fechaInicioCiclo) {
      const [y, m, d] = worker.fechaInicioCiclo.split("-").map(Number);
      fechaBase = new Date(y, m - 1, d);
    } else {
      fechaBase = new Date(2026, 0, 1);
    }
    const diffDays = Math.floor((fecha - fechaBase) / (1000 * 60 * 60 * 24));
    const ciclo = ((diffDays % 8) + 8) % 8;
    return ciclo < 4;
  } else {
    return diaSemana >= 1 && diaSemana <= 5;
  }
}

function horaSalidaNum(worker) {
  if (worker.horaSalida) return parseInt(worker.horaSalida.split(":")[0], 10);
  return worker.esNocturno ? 8 : 16;
}

function fechaAStr(fecha) {
  return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
}

function claveAsistencia(ficha, fecha) {
  return `${ficha}_${fecha.getFullYear()}_${fecha.getMonth()}_${fecha.getDate()}`;
}

/** Convierte "YYYY-MM-DD" a Date a medianoche */
function parseFechaIngreso(fechaStr) {
  if (!fechaStr) return null;
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─── Limpieza de faltas incorrectas (una sola vez) ───────────────────────────
// Elimina del historialIncidencias cualquier FALTA del 16/4/2026 que fue
// registrada erróneamente cuando no había datos de asistencia de ese período.
async function limpiarFaltasIncorrectas(workers) {
  const FECHAS_INCORRECTAS = ["16/4/2026"]; // Agrega más si aparecen otras
  const promesas = [];

  for (const worker of workers) {
    if (!worker.historialIncidencias?.length) continue;

    const historialLimpio = worker.historialIncidencias.filter((inc) => {
      if (inc.tipo !== "FALTA") return true;
      if (inc.registradoPor !== "SISTEMA AUTOMÁTICO") return true;
      // Eliminar si coincide con alguna de las fechas incorrectas
      return !FECHAS_INCORRECTAS.some((f) => inc.descripcion.includes(f));
    });

    if (historialLimpio.length !== worker.historialIncidencias.length) {
      promesas.push(
        updateDoc(doc(db, "personal", worker.id), {
          historialIncidencias: historialLimpio,
        })
      );
    }
  }

  if (promesas.length > 0) {
    await Promise.all(promesas);
    console.log(
      `[AutoInasistencias] Limpieza: ${promesas.length} trabajador(es) corregido(s).`
    );
  }
}

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useAutoInasistencias() {
  const ejecutando = useRef(false);

  useEffect(() => {
    if (ejecutando.current) return;
    ejecutando.current = true;

    const procesar = async () => {
      try {
        // ── 1. Leer configuración de fechas procesadas ────────────────────
        const configRef = doc(db, "configuracion", "procesamiento-faltas");
        const configSnap = await getDoc(configRef);
        const configData = configSnap.exists() ? configSnap.data() : {};
        const fechasProcesadas = new Set(configData.fechasProcesadas || []);
        const limpiezaRealizada = configData.limpiezaV2 === true;

        // ── 2. Cargar todos los trabajadores activos ───────────────────────
        const personalSnap = await getDocs(collection(db, "personal"));
        const workers = personalSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((w) => w.estatus !== "Inactivo");

        if (workers.length === 0) {
          ejecutando.current = false;
          return;
        }

        // ── 3. Limpieza única de faltas incorrectas (solo una vez) ─────────
        if (!limpiezaRealizada) {
          await limpiarFaltasIncorrectas(workers);
          // Refrescar los datos de workers tras la limpieza
          const personalSnapFresh = await getDocs(collection(db, "personal"));
          const workersFresh = personalSnapFresh.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          // Actualizar en memoria
          workers.length = 0;
          workersFresh
            .filter((w) => w.estatus !== "Inactivo")
            .forEach((w) => workers.push(w));

          await setDoc(configRef, { limpiezaV2: true }, { merge: true });
        }

        // ── 4. Calcular días candidatos (últimos 30 días hasta HOY) ───────
        const ahora = new Date();
        const hoy = new Date(ahora);
        hoy.setHours(0, 0, 0, 0);

        const candidatos = [];
        for (let diasAtras = 0; diasAtras <= 30; diasAtras++) {
          const fecha = new Date(hoy);
          fecha.setDate(hoy.getDate() - diasAtras);
          const fechaStr = `${fecha.getFullYear()}-${String(
            fecha.getMonth() + 1
          ).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
          if (!fechasProcesadas.has(fechaStr)) {
            candidatos.push({ fecha, fechaStr });
          }
        }

        if (candidatos.length === 0) {
          ejecutando.current = false;
          return;
        }

        // ── 5. Cargar asistencias del período ─────────────────────────────
        const limite = new Date(hoy);
        limite.setDate(hoy.getDate() - 35); // margen extra sobre los 30 días
        const limiteTs = Timestamp.fromDate(limite);

        const asistSnap = await getDocs(
          query(
            collection(db, "asistencias"),
            where("fechaHora", ">=", limiteTs)
          )
        );

        // Mapa de asistencia: clave → true
        const asistenciasMap = new Map(); // clave → true
        // También: qué días tienen al menos 1 registro (días "activos")
        const diasConRegistros = new Set(); // "YYYY-MM-DD"

        asistSnap.docs.forEach((d) => {
          const data = d.data();
          const fA = data.fechaHora?.toDate
            ? data.fechaHora.toDate()
            : data.fechaHora
            ? new Date(data.fechaHora)
            : null;
          if (!fA) return;

          // Marca el día como activo (el sistema funcionó ese día)
          const dayKey = `${fA.getFullYear()}-${String(
            fA.getMonth() + 1
          ).padStart(2, "0")}-${String(fA.getDate()).padStart(2, "0")}`;
          diasConRegistros.add(dayKey);

          if (data.ficha) {
            asistenciasMap.set(claveAsistencia(data.ficha, fA), true);
          }
        });

        // ── 6. Procesar cada día candidato ────────────────────────────────
        const nuevasFechasProcesadas = [...fechasProcesadas];
        const promesasUpdate = [];

        for (const { fecha, fechaStr } of candidatos) {
          const esHoy = fecha.getTime() === hoy.getTime();

          // ★ REGLA CLAVE: Si no hay ningún registro de asistencia ese día,
          //   el sistema no estaba activo → no registrar faltas.
          //   Excepción: HOY (puede ser que aún no marque nadie porque es
          //   temprano, pero igual procesamos para la verificación de hora).
          if (!esHoy && !diasConRegistros.has(fechaStr)) {
            // Marcar como procesado igualmente para no revisarlo de nuevo
            nuevasFechasProcesadas.push(fechaStr);
            continue;
          }

          const hString = fechaAStr(fecha); // "D/M/YYYY"

          for (const worker of workers) {
            // Excluir pasantes cuya pasantía culminó
            if (worker.tipoPersonal === "Pasante" && worker.fechaEgreso) {
              const [ey, em, ed] = worker.fechaEgreso.split("-").map(Number);
              if (fecha > new Date(ey, em - 1, ed)) continue;
            }

            // ★ Verificar que el trabajador ya estaba contratado en esa fecha
            const ingreso = parseFechaIngreso(worker.fechaIngreso);
            if (ingreso && fecha < ingreso) continue;

            // Verificar si ese día era laboral para este trabajador
            if (!esDiaLaboral(fecha, worker)) continue;

            // Si es HOY, solo marcar si ya pasó la hora de salida
            if (esHoy) {
              const horaActual = ahora.getHours();
              if (horaActual < horaSalidaNum(worker)) continue;
            }

            // Verificar si asistió
            const clave = claveAsistencia(worker.ficha, fecha);
            if (asistenciasMap.has(clave)) continue;

            // Verificar si ya tiene la falta registrada para esa fecha
            const yaRegistrada = worker.historialIncidencias?.some(
              (inc) =>
                inc.tipo === "FALTA" && inc.descripcion.includes(hString)
            );
            if (yaRegistrada) continue;

            // ✅ Registrar la inasistencia
            const nuevaFalta = {
              id: Date.now() + Math.random(),
              tipo: "FALTA",
              descripcion: `Inasistencia ${hString} - INJUSTIFICADA`,
              fecha: fecha.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }),
              registradoPor: "SISTEMA AUTOMÁTICO",
            };

            promesasUpdate.push(
              updateDoc(doc(db, "personal", worker.id), {
                historialIncidencias: arrayUnion(nuevaFalta),
              })
            );

            // Actualizar copia local para no duplicar en el mismo lote
            if (!worker.historialIncidencias) worker.historialIncidencias = [];
            worker.historialIncidencias.push(nuevaFalta);
          }

          if (!esHoy) {
            nuevasFechasProcesadas.push(fechaStr);
          }
        }

        // ── 7. Ejecutar todas las escrituras en paralelo ──────────────────
        if (promesasUpdate.length > 0) {
          await Promise.all(promesasUpdate);
          console.log(
            `[AutoInasistencias] ${promesasUpdate.length} inasistencia(s) nueva(s) registrada(s).`
          );
        }

        // ── 8. Persistir fechas procesadas ────────────────────────────────
        if (nuevasFechasProcesadas.length > fechasProcesadas.size) {
          await setDoc(
            configRef,
            {
              fechasProcesadas: nuevasFechasProcesadas.slice(-90),
              ultimaEjecucion: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error("[AutoInasistencias] Error:", err);
      } finally {
        ejecutando.current = false;
      }
    };

    procesar();
  }, []);
}
