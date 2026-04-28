import mysql from 'mysql2';

export const con = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Rahat27.04.11',
    database: process.env.DB_NAME || 'study',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
});


console.log("MySQL connection pool initialized (ready when needed)");