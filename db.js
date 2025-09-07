const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST,       // MYSQLHOST
  user: process.env.DB_USER,       // MYSQLUSER
  password: process.env.DB_PASSWORD, // MYSQL_ROOT_PASSWORD
  database: process.env.DB_NAME,   // MYSQL_DATABASE
  port: process.env.DB_PORT        // MYSQLPORT
});

db.connect(err => {
  if (err) console.error("❌ MySQL connection failed:", err);
  else console.log("✅ MySQL connected successfully!");
});

module.exports = db;
