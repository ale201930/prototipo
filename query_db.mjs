import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
  console.log("Signing in...");
  await signInWithEmailAndPassword(auth, "testadmin@invecem.com", "admin123");
  console.log("Logged in successfully!");

  console.log("\nFetching personal...");
  const personalSnap = await getDocs(collection(db, "personal"));
  console.log("PERSONAL:");
  personalSnap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, "=>", {
      ficha: data.ficha,
      cedula: data.cedula,
      nombres: data.nombres,
      apellidos: data.apellidos,
      tipoPersonal: data.tipoPersonal,
      fechaEgreso: data.fechaEgreso,
      estatus: data.estatus
    });
  });

  console.log("\nFetching asistencias...");
  const asistenciasSnap = await getDocs(collection(db, "asistencias"));
  console.log("ASISTENCIAS:");
  asistenciasSnap.forEach(doc => {
    console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
  });

  console.log("\nFetching contratistas...");
  const contratistasSnap = await getDocs(collection(db, "contratistas"));
  console.log("CONTRATISTAS:");
  contratistasSnap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, "=>", data);
  });

  console.log("\nFetching usuarios...");
  const usuariosSnap = await getDocs(collection(db, "usuarios"));
  console.log("USUARIOS:");
  usuariosSnap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, "=>", data);
  });
}

main().catch(console.error);
