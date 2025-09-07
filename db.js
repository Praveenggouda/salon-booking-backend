import mysql from 'mysql2/promise';

const db = mysql.createPool({
  host: 'bcnineplj7dyjhrseuiu-mysql.services.clever-cloud.com',
  user: 'uq6vpcfofhquauek',          // fill from MYSQL_ADDON_USER
  password: 'okCTiQ7eN5BjKnz7cX96',  // fill from MYSQL_ADDON_PASSWORD
  database: 'bcnineplj7dyjhrseuiu', // from MYSQL_ADDON_DB
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default db;


