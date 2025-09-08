import mysql from 'mysql2/promise';

const db = mysql.createPool({
MYSQL_ADDON_HOST: 'bcnineplj7dyjhrseuiu-mysql.services.clever-cloud.com',
MYSQL_ADDON_USER: 'uq6vpcfofhquauek',          // fill from MYSQL_ADDON_USER
MYSQL_ADDON_PASSWORD: 'okCTiQ7eN5BjKnz7cX96',  // fill from MYSQL_ADDON_PASSWORD
MYSQL_ADDON_DB: 'bcnineplj7dyjhrseuiu', // from MYSQL_ADDON_DB
MYSQL_ADDON_PORT: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default db;



