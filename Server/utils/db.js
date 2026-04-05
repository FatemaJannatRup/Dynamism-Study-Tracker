import mysql from 'mysql2';

export const con = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Rahat27.04.11',
    database: 'study',
    waitForConnections: true,
    connectionLimit: 10,          // max simultaneous connections
    queueLimit: 0,
    connectTimeout: 10000
});


console.log("MySQL connection pool initialized (ready when needed)");