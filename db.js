// db.js
const mysql = require("mysql2/promise");

// Create pool
const pool = mysql.createPool({
  host: "bcnineplj7dyjhrseuiu-mysql.services.clever-cloud.com",
  user: "uq6vpcfofhquauek",
  password: "okCTiQ7eN5BjKnz7cX96",
  database: "bcnineplj7dyjhrseuiu",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function to test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL connected successfully!");
    connection.release();
  } catch (err) {
    console.error("☒ Failed to connect to MySQL:", err.message);
  }
}

testConnection();

module.exports = pool;
