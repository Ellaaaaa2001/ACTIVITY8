-- Database schema for chat_app
-- Run this in your MySQL client (e.g. MySQL Workbench, phpMyAdmin, or mysql CLI)

-- Create database
CREATE DATABASE IF NOT EXISTS chat_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chat_app;

-- Chatrooms table
CREATE TABLE IF NOT EXISTS chatrooms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  members INT DEFAULT 0,
  activeUsers INT DEFAULT 0,
  createdBy VARCHAR(100),
  createdAt DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages table
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
