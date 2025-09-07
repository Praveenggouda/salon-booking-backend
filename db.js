import mysql from "mysql2";

const pool = mysql.createPool({
  host: process.env.MYSQL_ADDON_HOST,
  user: process.env.MYSQL_ADDON_USER,
  password: process.env.MYSQL_ADDON_PASSWORD,
  database: process.env.MYSQL_ADDON_DB,
  port: process.env.MYSQL_ADDON_PORT,
  ssl: {
    rejectUnauthorized: false // important for Clever Cloud
  }
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL Connection Error:", err);
  } else {
    console.log("✅ Connected to Clever Cloud MySQL");
    connection.release();
  }
});

export default pool;
