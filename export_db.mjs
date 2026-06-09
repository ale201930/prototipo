import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

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

async function exportDatabase() {
  console.log("Iniciando sesión en Firebase...");
  await signInWithEmailAndPassword(auth, "testadmin@invecem.com", "admin123");
  console.log("Sesión iniciada con éxito.");

  const collections = ["personal", "contratistas", "asistencias", "usuarios", "auditoria", "visitantes", "configuracion"];
  const dbData = {};

  for (const colName of collections) {
    console.log(`Exportando colección: ${colName}...`);
    const snap = await getDocs(collection(db, colName));
    dbData[colName] = [];
    snap.forEach(doc => {
      const data = doc.data();
      // Convertir Timestamps de Firestore a strings ISO legibles
      const cleanedData = { id: doc.id };
      for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === "object" && val.toDate) {
          cleanedData[key] = val.toDate().toISOString();
        } else if (val && typeof val === "object" && val.seconds !== undefined) {
          cleanedData[key] = new Date(val.seconds * 1000).toISOString();
        } else {
          cleanedData[key] = val;
        }
      }
      dbData[colName].push(cleanedData);
    });
  }

  // 1. Guardar como JSON
  fs.writeFileSync("db_export.json", JSON.stringify(dbData, null, 2), "utf-8");
  console.log("✅ Base de datos exportada en formato JSON: db_export.json");

  // 2. Generar SQL de volcado para MySQL (Laragon)
  let sqlContent = `-- Volcado de base de datos de INVECEM (Firebase a SQL para Laragon)\n`;
  sqlContent += `CREATE DATABASE IF NOT EXISTS invecem;\nUSE invecem;\n\n`;

  for (const [colName, docs] of Object.entries(dbData)) {
    if (docs.length === 0) continue;

    // Obtener todas las columnas únicas de la colección
    const columnsSet = new Set(["id"]);
    docs.forEach(doc => {
      Object.keys(doc).forEach(k => columnsSet.add(k));
    });
    const columns = Array.from(columnsSet);

    sqlContent += `-- Tabla: ${colName}\n`;
    sqlContent += `DROP TABLE IF EXISTS \`${colName}\`;\n`;
    sqlContent += `CREATE TABLE \`${colName}\` (\n`;
    sqlContent += columns.map(col => `  \`${col}\` TEXT`).join(",\n");
    sqlContent += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

    docs.forEach(doc => {
      const values = columns.map(col => {
        const val = doc[col];
        if (val === undefined || val === null) {
          return "NULL";
        }
        if (typeof val === "object") {
          return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        }
        return `'${val.toString().replace(/'/g, "''")}'`;
      });
      sqlContent += `INSERT INTO \`${colName}\` (${columns.map(c => `\`${c}\``).join(", ")}) VALUES (${values.join(", ")});\n`;
    });
    sqlContent += `\n`;
  }

  fs.writeFileSync("db_export.sql", sqlContent, "utf-8");
  console.log("✅ Base de datos exportada en formato SQL: db_export.sql");
}

exportDatabase().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
