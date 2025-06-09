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
  socket.on('joinRoom', (roomId) => {
    console.log(`Client ${socket.id} joining room ${roomId}`);
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        permissions: new Map()
      });
    }
    
    // Add user to room
    const room = rooms.get(roomId);
    room.users.add(socket.id);
    room.permissions.set(socket.id, 'edit'); // Default permission
    
    // Notify others in the room
    socket.to(roomId).emit('userJoined', socket.id);
  });

  // Handle drawing events
  socket.on('draw', (data) => {
    const { roomId, shape } = data;
    const room = rooms.get(roomId);
    
    if (room && room.permissions.get(socket.id) === 'edit') {
      socket.to(roomId).emit('draw', shape);
    }
  });

  // Handle permission changes
  socket.on('updatePermission', (data) => {
    const { roomId, userId, permission } = data;
    const room = rooms.get(roomId);
    
    if (room && room.permissions.has(userId)) {
      room.permissions.set(userId, permission);
      io.to(roomId).emit('permissionUpdated', { userId, permission });
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
        
        // Notify others in the room
        socket.to(roomId).emit('userLeft', socket.id);
        
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