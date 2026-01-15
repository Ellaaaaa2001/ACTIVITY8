"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseProvider = exports.MYSQL_POOL = void 0;
const mysql = __importStar(require("mysql2/promise"));
exports.MYSQL_POOL = 'MYSQL_POOL';
exports.DatabaseProvider = {
    provide: exports.MYSQL_POOL,
    useFactory: async () => {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'chat_app',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
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
//# sourceMappingURL=database.provider.js.map