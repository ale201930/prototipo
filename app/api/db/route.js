import mysql from "mysql2/promise";
import { NextResponse } from "next/server";

const config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  database: process.env.DB_NAME || "invecem",
};

async function getConnection() {
  const dbName = config.database;

  // En producción (ej. hosting remoto), es posible que ya tengamos el nombre de base de datos asignado
  // y que no tengamos permisos para ejecutar CREATE DATABASE o conectar sin base de datos.
  if (process.env.DB_NAME) {
    try {
      const conn = await mysql.createConnection(config);
      return conn;
    } catch (err) {
      console.warn("Conexión directa fallida, intentando fallback de desarrollo local:", err.message);
    }
  }

  // Comportamiento local / fallback: conectar sin base de datos para crearla si no existe
  const { database, ...connConfig } = config;
  const conn = await mysql.createConnection(connConfig);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);
  return conn;
}

function parseRow(row) {
  if (!row) return null;
  const result = {};
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
      try {
        result[key] = JSON.parse(val);
      } catch {
        result[key] = val;
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}

function serializeValue(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return val;
}

async function executeQueryWithRetry(conn, table, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.errno === 1146) { // Table doesn't exist
      await conn.query(`CREATE TABLE IF NOT EXISTS \`${table}\` (id VARCHAR(255) PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      return await executeQueryWithRetry(conn, table, fn);
    } else if (err.errno === 1054) { // Column doesn't exist
      const match = err.message.match(/Unknown column '(.+?)'/);
      if (match && match[1]) {
        const col = match[1];
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` LONGTEXT`);
        return await executeQueryWithRetry(conn, table, fn);
      }
      throw err;
    } else {
      throw err;
    }
  }
}

function buildSingleWhere(w, params) {
  const { field, operator, value } = w;
  if (value === null || value === undefined) {
    if (operator === "==") return `\`${field}\` IS NULL`;
    if (operator === "!=") return `\`${field}\` IS NOT NULL`;
  }
  params.push(value);
  const ops = {
    "==": "=",
    "!=": "!=",
    ">": ">",
    "<": "<",
    ">=": ">=",
    "<=": "<=",
    "in": "IN",
    "contains": "LIKE"
  };
  const op = ops[operator] || "=";
  const val = operator === "contains" ? `%${value}%` : value;
  params[params.length - 1] = val;
  return `\`${field}\` ${op} ?`;
}

function buildWhereClause(wheres, params) {
  if (!wheres || wheres.length === 0) return "";
  const clauses = wheres.map(w => {
    if (w.type === "or") {
      const subClauses = w.filters.map(subW => buildSingleWhere(subW, params));
      return `(${subClauses.join(" OR ")})`;
    } else {
      return buildSingleWhere(w, params);
    }
  });
  return " WHERE " + clauses.join(" AND ");
}

export async function POST(request) {
  let conn;
  try {
    const body = await request.json();
    const { action, collection: table, id, data, wheres, orderBys, limitNumber } = body;

    conn = await getConnection();

    if (action === "getDoc") {
      const fn = async () => {
        const [rows] = await conn.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [id]);
        return rows[0] ? parseRow(rows[0]) : null;
      };
      const result = await executeQueryWithRetry(conn, table, fn);
      return NextResponse.json({ data: result });
    }

    if (action === "getDocs") {
      const fn = async () => {
        const params = [];
        let queryStr = `SELECT * FROM \`${table}\``;
        queryStr += buildWhereClause(wheres, params);

        if (orderBys && orderBys.length > 0) {
          const orders = orderBys.map(o => `\`${o.field}\` ${o.direction ? o.direction.toUpperCase() : "ASC"}`);
          queryStr += " ORDER BY " + orders.join(", ");
        }

        if (limitNumber !== undefined && limitNumber !== null) {
          queryStr += ` LIMIT ${parseInt(limitNumber, 10)}`;
        }

        const [rows] = await conn.query(queryStr, params);
        return rows.map(r => parseRow(r));
      };
      const result = await executeQueryWithRetry(conn, table, fn);
      return NextResponse.json({ docs: result });
    }

    if (action === "addDoc" || action === "setDoc") {
      const docId = id || Math.random().toString(36).substring(2, 15);
      const fn = async () => {
        const keys = ["id"];
        const placeholders = ["?"];
        const params = [docId];

        for (const [key, val] of Object.entries(data)) {
          if (key === "id") continue;
          keys.push(key);
          placeholders.push("?");
          params.push(serializeValue(val));
        }

        // MySQL INSERT ON DUPLICATE KEY UPDATE to support setDoc/addDoc behavior
        const updatePart = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(", ");
        const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(", ")}) VALUES (${placeholders.join(", ")}) ON DUPLICATE KEY UPDATE ${updatePart}`;
        await conn.query(sql, params);
        return docId;
      };
      const result = await executeQueryWithRetry(conn, table, fn);
      return NextResponse.json({ id: result });
    }

    if (action === "updateDoc") {
      const fn = async () => {
        const updates = [];
        const params = [];

        for (const [key, val] of Object.entries(data)) {
          updates.push(`\`${key}\` = ?`);
          params.push(serializeValue(val));
        }

        params.push(id);
        const sql = `UPDATE \`${table}\` SET ${updates.join(", ")} WHERE id = ?`;
        await conn.query(sql, params);
        return id;
      };
      const result = await executeQueryWithRetry(conn, table, fn);
      return NextResponse.json({ id: result });
    }

    if (action === "deleteDoc") {
      const fn = async () => {
        await conn.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
        return id;
      };
      const result = await executeQueryWithRetry(conn, table, fn);
      return NextResponse.json({ id: result });
    }

    if (action === "getCount") {
      const fn = async () => {
        const params = [];
        let queryStr = `SELECT COUNT(*) as count FROM \`${table}\``;
        queryStr += buildWhereClause(wheres, params);
        const [rows] = await conn.query(queryStr, params);
        return rows[0].count;
      };
      const result = await executeQueryWithRetry(conn, table, fn);
      return NextResponse.json({ count: result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("API DB Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}
