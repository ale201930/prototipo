import mysql from "mysql2/promise";

const config = {
  host: "localhost",
  user: "root",
  password: "",
  port: 3306,
};

async function main() {
  const conn = await mysql.createConnection(config);
  await conn.query("USE `invecem`");
  console.log("Connected to MySQL.");

  const [rows] = await conn.query("SELECT id, ficha, nombres, apellidos, historialIncidencias FROM `personal`");
  console.log(`Found ${rows.length} rows in personal table:`);
  for (const row of rows) {
    console.log(`\nID: ${row.id} | Ficha: ${row.ficha} | Name: ${row.nombres} ${row.apellidos}`);
    console.log(`historialIncidencias Raw Type: ${typeof row.historialIncidencias}`);
    console.log(`historialIncidencias Raw Length: ${row.historialIncidencias ? row.historialIncidencias.length : 0}`);
    console.log(`historialIncidencias Raw Value snippet:`, row.historialIncidencias ? row.historialIncidencias.substring(0, 200) : "null");
    
    if (row.historialIncidencias) {
      try {
        const parsed = JSON.parse(row.historialIncidencias);
        console.log("Parsed successfully! Item count:", parsed.length);
        console.log("Parsed content summary:", parsed.map(p => ({ id: p.id, tipo: p.tipo, desc: p.descripcion, hasUrl: !!p.url })));
      } catch (e) {
        console.error("JSON PARSE ERROR:", e.message);
      }
    }
  }

  await conn.end();
}

main().catch(console.error);
