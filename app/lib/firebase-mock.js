// Firebase Client SDK Mock for Offline Mode (Connecting to Laragon MySQL)

export class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromDate(date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
  }

  static now() {
    return Timestamp.fromDate(new Date());
  }

  static fromMillis(ms) {
    return Timestamp.fromDate(new Date(ms));
  }

  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
  }

  toISOString() {
    return this.toDate().toISOString();
  }
}

export function reviveTimestamps(data) {
  if (data === null || data === undefined) return data;
  
  if (typeof data === "object") {
    if (data.seconds !== undefined && data.nanoseconds !== undefined) {
      return new Timestamp(data.seconds, data.nanoseconds);
    }
    if (data instanceof Date || typeof data.toDate === "function") {
      return data;
    }
  }

  if (Array.isArray(data)) {
    return data.map(item => reviveTimestamps(item));
  }

  if (typeof data === "object") {
    const revived = {};
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        try {
          const date = new Date(val);
          if (!isNaN(date.getTime())) {
            revived[key] = Timestamp.fromDate(date);
          } else {
            revived[key] = val;
          }
        } catch {
          revived[key] = val;
        }
      } else {
        revived[key] = reviveTimestamps(val);
      }
    }
    return revived;
  }

  return data;
}

class MockAuth {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    // Intentar recuperar sesión mock del localStorage
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("mock_auth_user");
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    }
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    // Ejecutar callback inmediatamente con el estado actual
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentUser));
  }
}

const mockAuthInstance = new MockAuth();

// --- firebase/app ---
export function initializeApp() {
  return {};
}

// --- firebase/auth ---
export function getAuth() {
  return mockAuthInstance;
}

export async function signInWithEmailAndPassword(authInstance, email, password) {
  // Autenticar consultando la tabla de usuarios local
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getDocs",
      collection: "usuarios",
      wheres: [{ field: "correo", operator: "==", value: email }]
    })
  });
  const data = await res.json();
  const userDoc = data.docs?.[0];

  if (!userDoc) {
    throw new Error("auth/user-not-found");
  }

  // Comparación robusta de contraseñas (soportando números/strings y recortando espacios)
  const dbPass = userDoc.clave?.toString().trim();
  const inputPass = password.toString().trim();

  if (dbPass !== inputPass) {
    throw new Error("auth/wrong-password");
  }

  const user = {
    uid: userDoc.id,
    email: userDoc.correo,
    displayName: userDoc.nombres,
  };

  authInstance.currentUser = user;
  if (typeof window !== "undefined") {
    localStorage.setItem("mock_auth_user", JSON.stringify(user));
  }
  authInstance.notifyListeners();

  return { user };
}

export async function signOut(authInstance) {
  authInstance.currentUser = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("mock_auth_user");
  }
  authInstance.notifyListeners();
}

export async function createUserWithEmailAndPassword(authInstance, email, password) {
  const uid = Math.random().toString(36).substring(2, 15);
  await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addDoc",
      collection: "usuarios",
      id: uid,
      data: {
        correo: email,
        clave: password,
        nombres: email.split("@")[0],
        estado: "Activo",
        rol: "Invitado",
        fechaRegistro: new Date().toISOString()
      }
    })
  });
  const user = { uid, email };
  return { user };
}

export async function updatePassword(user, newPassword) {
  if (!user || !user.uid) return;
  await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "updateDoc",
      collection: "usuarios",
      id: user.uid,
      data: { clave: newPassword }
    })
  });
}

export async function updateEmail(user, newEmail) {
  if (!user || !user.uid) return;
  await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "updateDoc",
      collection: "usuarios",
      id: user.uid,
      data: { correo: newEmail }
    })
  });
  user.email = newEmail;
  if (typeof window !== "undefined") {
    localStorage.setItem("mock_auth_user", JSON.stringify(user));
  }
  mockAuthInstance.currentUser = user;
  mockAuthInstance.notifyListeners();
}

export async function sendPasswordResetEmail(authInstance, email) {
  // 1. Buscar el uid en la base de datos de usuarios
  const resUser = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getDocs",
      collection: "usuarios",
      wheres: [{ field: "correo", operator: "==", value: email }]
    })
  });
  const data = await resUser.json();
  const userDoc = data.docs?.[0];
  if (!userDoc) {
    throw new Error("auth/user-not-found");
  }

  // 2. Obtener el origen actual (ej. http://localhost:3000)
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const resetLink = `${origin}/restablecer-clave?uid=${userDoc.id}`;

  // 3. Crear el mensaje del correo
  const text = `Hola ${userDoc.nombres || "Usuario"},\n\nHemos recibido una solicitud para restablecer tu contraseña en el Sistema Integrado de Control de Personal de INVECEM.\n\nPara completar el restablecimiento de tu contraseña, ingresa al siguiente enlace:\n${resetLink}\n\nSi no solicitaste este cambio, puedes ignorar este correo de forma segura.`;

  // 4. Llamar a la API de envío de correo real
  const resEmail = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject: "Restablecer Contraseña - INVECEM",
      text: text
    })
  });

  const emailData = await resEmail.json();
  if (!emailData.success && !emailData.simulated) {
    throw new Error(emailData.error || "Fallo en el servicio SMTP al enviar el correo.");
  }
  return true;
}

export async function reauthenticateWithCredential() {
  return true;
}

export class EmailAuthProvider {
  static credential(email, password) {
    return { email, password };
  }
}

// --- firebase/firestore ---
export function getFirestore() {
  return {};
}

export function collection(db, name) {
  return { collection: name };
}

export function doc(db, collectionName, id) {
  if (typeof collectionName === "object") {
    return { collection: collectionName.collection, id: id };
  }
  return { collection: collectionName, id: id };
}

export function query(collectionRef, ...constraints) {
  const q = { collection: collectionRef.collection, wheres: [], orderBys: [], limitNumber: null };
  constraints.forEach(c => {
    if (c.type === "where") q.wheres.push(c);
    else if (c.type === "or") q.wheres.push(c);
    else if (c.type === "orderBy") q.orderBys.push(c);
    else if (c.type === "limit") q.limitNumber = c.number;
  });
  return q;
}

export function where(field, operator, value) {
  return { type: "where", field, operator, value };
}

export function orderBy(field, direction = "asc") {
  return { type: "orderBy", field, direction };
}

export function or(...filters) {
  return { type: "or", filters };
}

export function limit(number) {
  return { type: "limit", number };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function arrayUnion(...elements) {
  return { type: "arrayUnion", elements };
}

export function arrayRemove(...elements) {
  return { type: "arrayRemove", elements };
}

export async function getDoc(docRef) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getDoc",
      collection: docRef.collection,
      id: docRef.id
    })
  });
  const { data } = await res.json();
  const revivedData = reviveTimestamps(data);
  return {
    exists: () => data !== null && data !== undefined,
    data: () => revivedData,
    id: docRef.id
  };
}

function formatWheresForAPI(wheres) {
  if (!wheres) return [];
  return wheres.map(w => {
    if (w.type === "where") {
      let val = w.value;
      if (val instanceof Date) {
        val = val.toISOString();
      } else if (val && typeof val === "object" && val.seconds !== undefined && val.nanoseconds !== undefined) {
        val = new Timestamp(val.seconds, val.nanoseconds).toISOString();
      } else if (val && typeof val === "object" && typeof val.toDate === "function") {
        val = val.toDate().toISOString();
      }
      return { ...w, value: val };
    } else if (w.type === "or") {
      const formattedFilters = w.filters.map(subW => {
        let val = subW.value;
        if (val instanceof Date) {
          val = val.toISOString();
        } else if (val && typeof val === "object" && val.seconds !== undefined && val.nanoseconds !== undefined) {
          val = new Timestamp(val.seconds, val.nanoseconds).toISOString();
        } else if (val && typeof val === "object" && typeof val.toDate === "function") {
          val = val.toDate().toISOString();
        }
        return { ...subW, value: val };
      });
      return { ...w, filters: formattedFilters };
    }
    return w;
  });
}

export async function getDocs(queryRef) {
  const q = queryRef.collection ? queryRef : { collection: queryRef.collection, wheres: [], orderBys: [], limitNumber: null };
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getDocs",
      collection: q.collection,
      wheres: formatWheresForAPI(q.wheres),
      orderBys: q.orderBys,
      limitNumber: q.limitNumber
    })
  });
  const { docs } = await res.json();
  const docsArray = docs || [];
  const docsArrayMapped = docsArray.map(d => {
    const revivedData = reviveTimestamps(d);
    return {
      id: d.id,
      data: () => revivedData
    };
  });
  return {
    docs: docsArrayMapped,
    forEach: (callback) => docsArrayMapped.forEach(callback),
    empty: docsArray.length === 0,
    size: docsArray.length
  };
}

export async function addDoc(collectionRef, data) {
  // Evaluar funciones sentinela o timestamps locales
  const cleanedData = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && val.type === "arrayUnion") {
      cleanedData[key] = val.elements;
    } else {
      cleanedData[key] = val;
    }
  }

  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addDoc",
      collection: collectionRef.collection,
      data: cleanedData
    })
  });
  const result = await res.json();
  return { id: result.id };
}

export async function updateDoc(docRef, data) {
  // Cargar documento actual para evaluar arrayUnion / arrayRemove si existen
  let needsLoad = false;
  for (const val of Object.values(data)) {
    if (val && (val.type === "arrayUnion" || val.type === "arrayRemove")) {
      needsLoad = true;
      break;
    }
  }

  let finalData = { ...data };

  if (needsLoad) {
    const current = await getDoc(docRef);
    const currentData = current.data() || {};
    
    for (const [key, val] of Object.entries(data)) {
      if (val && val.type === "arrayUnion") {
        const currentArr = Array.isArray(currentData[key]) ? currentData[key] : [];
        const unionSet = new Set(currentArr.map(item => JSON.stringify(item)));
        val.elements.forEach(el => unionSet.add(JSON.stringify(el)));
        finalData[key] = Array.from(unionSet).map(s => JSON.parse(s));
      } else if (val && val.type === "arrayRemove") {
        const currentArr = Array.isArray(currentData[key]) ? currentData[key] : [];
        const removeSet = new Set(val.elements.map(item => JSON.stringify(item)));
        finalData[key] = currentArr.filter(item => !removeSet.has(JSON.stringify(item)));
      }
    }
  }

  await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "updateDoc",
      collection: docRef.collection,
      id: docRef.id,
      data: finalData
    })
  });
}

export async function deleteDoc(docRef) {
  await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "deleteDoc",
      collection: docRef.collection,
      id: docRef.id
    })
  });
}

export async function setDoc(docRef, data) {
  await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "setDoc",
      collection: docRef.collection,
      id: docRef.id,
      data: data
    })
  });
}

export async function getCountFromServer(queryRef) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getCount",
      collection: queryRef.collection,
      wheres: formatWheresForAPI(queryRef.wheres)
    })
  });
  const { count } = await res.json();
  return {
    data: () => ({ count: count || 0 })
  };
}

export function onSnapshot(queryRef, callback) {
  if (!queryRef) return () => {};
  let active = true;
  let prevJson = "";

  const poll = async () => {
    if (!active) return;
    try {
      if (queryRef.id !== undefined) {
        // DocumentReference
        const snap = await getDoc(queryRef);
        const dataJson = JSON.stringify(snap.data());
        if (dataJson !== prevJson) {
          prevJson = dataJson;
          callback(snap);
        }
      } else {
        // CollectionReference or Query
        const snap = await getDocs(queryRef);
        const docsJson = JSON.stringify(snap.docs.map(d => d.data()));
        if (docsJson !== prevJson) {
          prevJson = docsJson;
          callback(snap);
        }
      }
    } catch (e) {
      console.error("onSnapshot Mock Poll Error:", e);
    }
    setTimeout(poll, 1500);
  };

  poll();

  return () => {
    active = false;
  };
}

// --- firebase/storage ---
export function getStorage() {
  return {};
}

export function ref(storageInstance, path) {
  return { path, downloadURL: "" };
}

export async function uploadBytes(refInstance, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      refInstance.downloadURL = reader.result;
      resolve({ ref: refInstance });
    };
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    reader.readAsDataURL(file);
  });
}

export async function getDownloadURL(refInstance) {
  return refInstance.downloadURL || "";
}

// --- firebase.js export helpers ---
export const registrarAccion = async (usuario, rol, accion, modulo) => {
  try {
    const finalUsuario = usuario || mockAuthInstance.currentUser?.displayName || "Invitado";
    const finalRol = rol || "Invitado";

    await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addDoc",
        collection: "auditoria",
        data: {
          usuario: finalUsuario,
          rol: finalRol,
          accion: accion,
          modulo: modulo,
          fecha: new Date().toISOString(),
          ip: "127.0.0.1 (Local)"
        }
      })
    });
    console.log("Mock Auditoría: Evento registrado localmente en MySQL");
  } catch (error) {
    console.error("Mock Auditoría Error:", error);
  }
};
