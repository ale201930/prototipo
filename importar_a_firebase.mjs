import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

// Copia aquí la configuración de tu proyecto Firebase (puedes verla en app/lib/firebase.js)
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
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  if (!fs.existsSync("db_export.json")) {
    console.error("❌ No se encontró el archivo db_export.json. Por favor ejecute primero 'node export_db.mjs' para generar el archivo.");
    return;
  }

  const dbData = JSON.parse(fs.readFileSync("db_export.json", "utf8"));
  
  console.log("🚀 Iniciando migración de datos hacia Firebase en la nube...");

  console.log("🔑 Iniciando sesión en Firebase Auth para obtener permisos de escritura...");
  try {
    await signInWithEmailAndPassword(auth, "testadmin@invecem.com", "admin123");
    console.log("✅ Sesión iniciada como testadmin@invecem.com");
  } catch (err) {
    console.warn("⚠️ No se pudo iniciar sesión como testadmin@invecem.com. Intentando con alexander@invecem.com...");
    try {
      await signInWithEmailAndPassword(auth, "alexander@invecem.com", "201980");
      console.log("✅ Sesión iniciada como alexander@invecem.com");
    } catch (err2) {
      console.warn("⚠️ No se pudo iniciar sesión de forma automática. Intentando continuar sin autenticación...");
    }
  }


  // 1. Subir Colecciones Estándar
  const collectionsToUpload = ["personal", "contratistas", "asistencias", "visitantes", "configuracion", "auditoria"];
  for (const colName of collectionsToUpload) {
    const docs = dbData[colName] || [];
    console.log(`\nSubiendo colección: ${colName} (${docs.length} documentos)...`);
    for (const docData of docs) {
      const { id, ...data } = docData;
      // Convertir arrays vacíos o campos especiales
      await setDoc(doc(db, colName, id), data);
      console.log(`  + Doc: ${id} subido.`);
    }
  }

  // 2. Crear usuarios en Firebase Auth e insertar perfiles en Firestore usuarios
  const usuarios = dbData.usuarios || [];
  console.log(`\nProcesando ${usuarios.length} usuarios para Firebase Auth y Firestore...`);
  
  for (const user of usuarios) {
    const { id, correo, clave, ...profileData } = user;
    if (!correo || !clave) {
      console.log(`⚠️ Saltando usuario ${user.nombres || id} porque no tiene correo o contraseña definida.`);
      continue;
    }
    
    try {
      console.log(`Creando usuario en Firebase Auth: ${correo}...`);
      const userCredential = await createUserWithEmailAndPassword(auth, correo, clave);
      const uid = userCredential.user.uid;
      
      console.log(`Guardando perfil en Firestore para el UID: ${uid}...`);
      await setDoc(doc(db, "usuarios", uid), {
        uid,
        correo,
        ...profileData,
        fechaRegistro: profileData.fechaRegistro || new Date().toISOString()
      });
      
      // Cerrar sesión inmediatamente para evitar conflictos en bucle
      await signOut(auth);
      console.log(`✅ Usuario ${correo} creado y perfil guardado con éxito.`);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        console.log(`ℹ️ El correo ${correo} ya está registrado en Firebase Auth.`);
        console.log(`Intentando guardar/actualizar el perfil en Firestore...`);
        // Usar id original o el que tiene asignado
        await setDoc(doc(db, "usuarios", id), {
          uid: id,
          correo,
          ...profileData,
          fechaRegistro: profileData.fechaRegistro || new Date().toISOString()
        });
        console.log(`✅ Perfil de ${correo} guardado en Firestore.`);
      } else {
        console.error(`❌ Error al crear usuario ${correo}:`, err.message);
      }
    }
  }

  console.log("\n🎉 ¡Proceso de importación a Firebase finalizado con éxito!");
}

main().catch(console.error);
