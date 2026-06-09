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
  console.log("Connected to MySQL invecem database.");

  // Check columns in `personal` table
  const [columns] = await conn.query("SHOW COLUMNS FROM `personal`");
  console.log("Columns in personal table:");
  console.log(columns);

  // Alter historialIncidencias to LONGTEXT if it exists
  const hasHistorial = columns.some(c => c.Field === "historialIncidencias");
  if (hasHistorial) {
    console.log("Altering personal.historialIncidencias to LONGTEXT...");
    await conn.query("ALTER TABLE `personal` MODIFY COLUMN `historialIncidencias` LONGTEXT");
    console.log("Altered successfully.");
  }

  // Also alter any other potential columns to LONGTEXT to be safe
  for (const col of columns) {
    if (col.Type.toLowerCase().includes("text")) {
      console.log(`Altering personal.${col.Field} to LONGTEXT...`);
      await conn.query(`ALTER TABLE \`personal\` MODIFY COLUMN \`${col.Field}\` LONGTEXT`);
    }
  }

  // Check and alter `asistencias` table columns
  try {
    const [columnsAsist] = await conn.query("SHOW COLUMNS FROM `asistencias`");
    for (const col of columnsAsist) {
      if (col.Type.toLowerCase().includes("text")) {
        console.log(`Altering asistencias.${col.Field} to LONGTEXT...`);
        await conn.query(`ALTER TABLE \`asistencias\` MODIFY COLUMN \`${col.Field}\` LONGTEXT`);
      }
    }
  } catch (e) {
    console.log("asistencias table check failed:", e.message);
  }

  // Check and alter `contratistas` table columns
  try {
    const [columnsContrat] = await conn.query("SHOW COLUMNS FROM `contratistas`");
    for (const col of columnsContrat) {
      if (col.Type.toLowerCase().includes("text")) {
        console.log(`Altering contratistas.${col.Field} to LONGTEXT...`);
        await conn.query(`ALTER TABLE \`contratistas\` MODIFY COLUMN \`${col.Field}\` LONGTEXT`);
      }
    }
  } catch (e) {
    console.log("contratistas table check failed:", e.message);
  }

  await conn.end();
  console.log("Done database migrations.");
}

main().catch(console.error);
