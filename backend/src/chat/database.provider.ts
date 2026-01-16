import { Provider } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

export const MYSQL_POOL = 'MYSQL_POOL';

export const DatabaseProvider: Provider = {
  provide: MYSQL_POOL,
  useFactory: async () => {
    const config: any = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      database: process.env.DB_NAME || 'chat_app',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };

    // Only add password if it's explicitly set
    if (process.env.DB_PASSWORD !== undefined) {
      config.password = process.env.DB_PASSWORD;
    }

    const pool = mysql.createPool(config);

    // Initialize tables (similar to old server)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatrooms (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        members INT DEFAULT 0,
        activeUsers INT DEFAULT 0,
        createdBy VARCHAR(100),
        createdAt DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        roomId VARCHAR(64) NOT NULL,
        userId VARCHAR(64),
        username VARCHAR(100),
        content TEXT,
        isSystem TINYINT(1) DEFAULT 0,
        createdAt DATETIME,
        INDEX idx_room_createdAt (roomId, createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS join_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        roomId VARCHAR(64) NOT NULL,
        userId VARCHAR(64) NOT NULL,
        username VARCHAR(100) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        createdAt DATETIME,
        INDEX idx_room_status (roomId, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    return pool;
  },
};
