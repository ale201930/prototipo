
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import Cookies from "js-cookie";

const firebaseConfig = {
  apiKey: "AIzaSyDDwbu6jA8o_9UKZUPQWPNCVElMJ-EQFtg",
  authDomain: "invecem-d8972.firebaseapp.com",
  projectId: "invecem-d8972",
  storageBucket: "invecem-d8972.firebasestorage.app",
  messagingSenderId: "726612092652",
  appId: "1:726612092652:web:81f4356532156e07a4e7c9",
  measurementId: "G-0YYJYX3T4D"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "es"; // Configura el idioma de los correos de Firebase en español
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- FUNCIÓN PARA EL MONITOREO Y AUDITORÍA ---
// Esta función guardará quién hizo qué, en qué módulo, a qué hora y desde qué IP.
export const registrarAccion = async (usuario, rol, accion, modulo) => {
  try {
    let finalUsuario = usuario || Cookies.get("user_name") || "Invitado";
    if (finalUsuario === "undefined" || finalUsuario === "null") finalUsuario = "Invitado";
    let finalRol = rol || Cookies.get("user_role") || "Invitado";
    if (finalRol === "undefined" || finalRol === "null") finalRol = "Invitado";

    let ip = "Desconocida";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        ip = data.ip || "Desconocida";
      }
    } catch (e) {
      console.warn("No se pudo obtener la IP para auditoría:", e);
    }

    await addDoc(collection(db, "auditoria"), {
      usuario: finalUsuario,
      rol: finalRol,
      accion: accion,
      modulo: modulo,
      fecha: serverTimestamp(), // Esto pone la hora exacta del servidor
      ip: ip
    });
    console.log("Evento registrado con éxito en INVECEM");
  } catch (error) {
    console.error("Error al registrar en auditoría:", error);
  }
};