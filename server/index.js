require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 4000;

// Express app for REST API
const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3002'] }));
app.use(express.json());

// HTTP server shared by Express and Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'POST']
  }
});

// In-memory room state: roomId -> { users: { socketId: user } }
const rooms = {};

// In-memory join requests: roomId -> [{ userId, username, socketId, timestamp }]
const joinRequests = {};

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chat_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDb() {
  // Create tables if they don't exist
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
}

// ---------------- REST API ROUTES ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all chatrooms
app.get('/api/chatrooms', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM chatrooms ORDER BY createdAt ASC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms (REST):', err);
    res.status(500).json({ error: 'Failed to fetch chatrooms' });
  }
});

// Create a new chatroom
app.post('/api/chatrooms', async (req, res) => {
  const { id, name, description, createdBy } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const roomId = id || Date.now().toString();
  const createdAt = new Date();

  try {
    await pool.query(
      'INSERT IGNORE INTO chatrooms (id, name, description, members, activeUsers, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roomId, name, description || null, 0, 0, createdBy || null, createdAt]
    );

    const room = {
      id: roomId,
      name,
      description: description || '',
      members: 0,
      activeUsers: 0,
      createdBy: createdBy || null,
      createdAt
    };

    // Also broadcast via WebSocket for live updates
    io.emit('roomCreated', room);

    res.status(201).json(room);
  } catch (err) {
    console.error('Error creating room (REST):', err);
    res.status(500).json({ error: 'Failed to create chatroom' });
  }
});

// Get messages for a specific room
app.get('/api/chatrooms/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT id, roomId, userId, username, content, isSystem, createdAt FROM messages WHERE roomId = ? ORDER BY createdAt ASC',
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching messages (REST):', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

function getRoomUsers(roomId) {
  if (!rooms[roomId]) return [];
  return Object.values(rooms[roomId].users);
}

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  // Send current custom rooms to newly connected client
  socket.on('getRooms', async () => {
    try {
      const [rows] = await pool.query('SELECT * FROM chatrooms ORDER BY createdAt ASC');
      socket.emit('rooms', rows);
    } catch (err) {
      console.error('Error fetching rooms from DB:', err);
      socket.emit('rooms', []);
    }
  });

  // Create a new custom room and broadcast it
  socket.on('createRoom', async ({ room }) => {
    if (!room || !room.id || !room.name) return;

    try {
      await pool.query(
        'INSERT IGNORE INTO chatrooms (id, name, description, members, activeUsers, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          room.id,
          room.name,
          room.description || null,
          room.members || 0,
          room.activeUsers || 0,
          room.createdBy || null,
          room.createdAt ? new Date(room.createdAt) : new Date()
        ]
      );

      io.emit('roomCreated', room);
    } catch (err) {
      console.error('Error creating room in DB:', err);
    }
  });

  socket.on('joinRoom', ({ roomId, user }) => {
    if (!roomId || !user) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: {} };
    }

    rooms[roomId].users[socket.id] = user;

    // Broadcast updated active users list.
    // We intentionally do NOT send a "joined the room" system
    // message here, so repeatedly opening the room does not
    // spam the chat history.
    io.to(roomId).emit('activeUsers', getRoomUsers(roomId));
  });

  socket.on('sendMessage', ({ roomId, message }) => {
    if (!roomId || !message) return;
    const withTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };

    // Broadcast chat message to everyone in the room
    io.to(roomId).emit('message', withTimestamp);

    // Persist chat message
    pool
      .query(
        'INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          withTimestamp.id,
          roomId,
          withTimestamp.user?.id || null,
          withTimestamp.user?.username || null,
          withTimestamp.content,
          withTimestamp.isSystem ? 1 : 0,
          new Date(withTimestamp.timestamp)
        ]
      )
      .catch((err) => console.error('Error saving chat message:', err));
  });

  // Typing indicators
  socket.on('typing', ({ roomId, user }) => {
    if (!roomId || !user) return;
    // Notify other users in the room that this user is typing
    socket.to(roomId).emit('userTyping', { user });
  });

  socket.on('stopTyping', ({ roomId, user }) => {
    if (!roomId || !user) return;
    // Notify other users that this user stopped typing
    socket.to(roomId).emit('userStopTyping', { user });
  });

  // Send full message history for a room from the database
  socket.on('getMessages', async ({ roomId }) => {
    if (!roomId) return;
    try {
      const [rows] = await pool.query(
        'SELECT id, roomId, userId, username, content, isSystem, createdAt FROM messages WHERE roomId = ? ORDER BY createdAt ASC',
        [roomId]
      );
      socket.emit('messages', rows);
    } catch (err) {
      console.error('Error fetching messages from DB:', err);
      socket.emit('messages', []);
    }
  });

  socket.on('leaveRoom', ({ roomId, user }) => {
    if (!roomId || !rooms[roomId]) return;

    socket.leave(roomId);

    if (rooms[roomId].users[socket.id]) {
      delete rooms[roomId].users[socket.id];
      io.to(roomId).emit('activeUsers', getRoomUsers(roomId));

      const msg = {
        id: Date.now().toString(),
        user: { id: 'system', username: 'System' },
        content: `${user.username} left the room.`,
        timestamp: new Date().toISOString(),
        isSystem: true
      };

      io.to(roomId).emit('systemMessage', msg);

      pool
        .query(
          'INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            msg.id,
            roomId,
            null,
            'System',
            msg.content,
            1,
            new Date(msg.timestamp)
          ]
        )
        .catch((err) => console.error('Error saving leave message:', err));
    }
  });

  socket.on('disconnect', () => {
    // Remove user from all rooms they were in
    Object.keys(rooms).forEach((roomId) => {
      const room = rooms[roomId];
      const user = room.users[socket.id];
      if (user) {
        delete room.users[socket.id];
        // Just update active users on disconnect; do not
        // emit a "left the room" system message so that
        // navigating back from the chat view doesn't look
        // like an explicit leave.
        io.to(roomId).emit('activeUsers', getRoomUsers(roomId));
      }
    });

    console.log('Client disconnected', socket.id);
  });

  // Join Request System
  socket.on('requestJoinRoom', async ({ roomId, user, adminId }) => {
    if (!roomId || !user) return;

    try {
      // Check if request already exists
      const [existing] = await pool.query(
        'SELECT * FROM join_requests WHERE roomId = ? AND userId = ? AND status = ?',
        [roomId, user.id, 'pending']
      );

      if (existing.length > 0) {
        socket.emit('joinRequestStatus', { status: 'already_pending' });
        return;
      }

      // Create join request
      await pool.query(
        'INSERT INTO join_requests (roomId, userId, username, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        [roomId, user.id, user.username, 'pending', new Date()]
      );

      // Store in memory
      if (!joinRequests[roomId]) {
        joinRequests[roomId] = [];
      }
      
      const request = {
        userId: user.id,
        username: user.username,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      };
      
      joinRequests[roomId].push(request);

      // Notify admin(s) in the room
      io.to(roomId).emit('newJoinRequest', { roomId, user });

      socket.emit('joinRequestStatus', { status: 'sent' });
    } catch (err) {
      console.error('Error creating join request:', err);
      socket.emit('joinRequestStatus', { status: 'error' });
    }
  });

  socket.on('getJoinRequests', async ({ roomId }) => {
    if (!roomId) return;

    try {
      const [rows] = await pool.query(
        'SELECT * FROM join_requests WHERE roomId = ? AND status = ? ORDER BY createdAt DESC',
        [roomId, 'pending']
      );

      // Format requests to a consistent structure used by the client
      const requests = rows.map(row => ({
        userId: String(row.userId),
        username: row.username
      }));

      console.log(`Sending ${requests.length} join requests for room ${roomId}:`, requests);
      socket.emit('joinRequestsList', { roomId, requests });
    } catch (err) {
      console.error('Error fetching join requests:', err);
      socket.emit('joinRequestsList', { roomId, requests: [] });
    }
  });

  socket.on('approveJoinRequest', async ({ roomId, userId, username }) => {
    if (!roomId || !userId) return;

    try {
      // Update request status
      await pool.query(
        'UPDATE join_requests SET status = ? WHERE roomId = ? AND userId = ?',
        ['approved', roomId, userId]
      );

      // Remove from memory
      if (joinRequests[roomId]) {
        joinRequests[roomId] = joinRequests[roomId].filter(r => r.userId !== userId);
      }

      // Broadcast a single system message that this user joined,
      // so the room sees the join only when the admin approves.
      const msg = {
        id: Date.now().toString(),
        user: { id: 'system', username: 'System' },
        content: `${username} joined the room.`,
        timestamp: new Date().toISOString(),
        isSystem: true
      };

      io.to(roomId).emit('systemMessage', msg);

      await pool.query(
        'INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          msg.id,
          roomId,
          null,
          'System',
          msg.content,
          1,
          new Date(msg.timestamp)
        ]
      );

      // Notify the user that their request was approved
      io.emit('joinRequestApproved', { roomId, userId });

      // Notify admin
      socket.emit('requestApproved', { roomId, userId, username });
    } catch (err) {
      console.error('Error approving join request:', err);
    }
  });

  socket.on('rejectJoinRequest', async ({ roomId, userId, username }) => {
    if (!roomId || !userId) return;

    try {
      // Update request status
      await pool.query(
        'UPDATE join_requests SET status = ? WHERE roomId = ? AND userId = ?',
        ['rejected', roomId, userId]
      );

      // Remove from memory
      if (joinRequests[roomId]) {
        joinRequests[roomId] = joinRequests[roomId].filter(r => r.userId !== userId);
      }

      // Notify the user that their request was rejected
      io.emit('joinRequestRejected', { roomId, userId });

      // Notify admin
      socket.emit('requestRejected', { roomId, userId, username });
    } catch (err) {
      console.error('Error rejecting join request:', err);
    }
  });

  socket.on('checkJoinApproval', async ({ roomId, userId }) => {
    if (!roomId || !userId) return;

    try {
      const [rows] = await pool.query(
        'SELECT status FROM join_requests WHERE roomId = ? AND userId = ? ORDER BY createdAt DESC LIMIT 1',
        [roomId, userId]
      );

      if (rows.length > 0) {
        socket.emit('joinApprovalStatus', { roomId, status: rows[0].status });
      } else {
        socket.emit('joinApprovalStatus', { roomId, status: 'none' });
      }
    } catch (err) {
      console.error('Error checking join approval:', err);
      socket.emit('joinApprovalStatus', { roomId, status: 'error' });
    }
  });
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Socket.IO server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });
