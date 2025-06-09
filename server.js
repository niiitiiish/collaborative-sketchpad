const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Enable CORS
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Store active rooms and their permissions
const rooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle room joining
  socket.on('joinRoom', ({ roomId, username }) => {
    console.log(`Client ${socket.id} joining room ${roomId} as ${username}`);
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        permissions: new Map()
      });
    }
    
    // Add user to room
    const room = rooms.get(roomId);
    room.users.set(socket.id, username);
    
    // First user in room becomes host
    const isHost = room.users.size === 1;
    room.permissions.set(socket.id, isHost);
    
    // Notify the user about their host status
    socket.emit('hostStatus', isHost);
    
    // Notify everyone in the room about the updated user list
    io.to(roomId).emit('userJoined', {
      users: Array.from(room.users.entries()),
      permissions: Array.from(room.permissions.entries())
    });
  });

  // Handle drawing events
  socket.on('draw', (data) => {
    const { roomId, data: shape } = data;
    const room = rooms.get(roomId);
    
    if (room && room.permissions.get(socket.id)) {
      socket.to(roomId).emit('draw', shape);
    }
  });

  // Handle permission requests
  socket.on('requestPermission', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      const username = room.users.get(socket.id);
      // Notify all users in the room about the permission request
      io.to(roomId).emit('permissionRequest', { userId: socket.id, username });
    }
  });

  // Handle permission grants
  socket.on('grantPermission', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room && room.permissions.get(socket.id)) { // Only host can grant permissions
      room.permissions.set(userId, true);
      io.to(roomId).emit('permissionUpdate', { userId, granted: true });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        room.permissions.delete(socket.id);
        
        // If host left, assign new host
        if (room.users.size > 0 && !Array.from(room.permissions.values()).some(p => p)) {
          const newHostId = room.users.keys().next().value;
          room.permissions.set(newHostId, true);
          io.to(newHostId).emit('hostStatus', true);
        }
        
        // Notify others in the room about the updated user list
        io.to(roomId).emit('userJoined', {
          users: Array.from(room.users.entries()),
          permissions: Array.from(room.permissions.entries())
        });
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
}); 