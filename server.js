const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure CORS for production
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? "*" // Allow all origins in production
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res, next) => {
    const indexPath = path.join(__dirname, 'client/build', 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error sending index.html:', err);
        next(err);
      }
    });
  });
}

// Store active rooms and their permissions
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        host: socket.id,
        users: new Map(),
        permissions: new Map()
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(socket.id, username);
    
    // First user to join becomes the host
    if (room.users.size === 1) {
      room.host = socket.id;
      room.permissions.set(socket.id, true);
      socket.emit('hostStatus', true);
    }

    io.to(roomId).emit('userJoined', {
      users: Array.from(room.users.entries()),
      permissions: Array.from(room.permissions.entries())
    });
  });

  socket.on('requestPermission', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.host) {
      io.to(room.host).emit('permissionRequest', {
        userId: socket.id,
        username: room.users.get(socket.id)
      });
    }
  });

  socket.on('grantPermission', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room && socket.id === room.host) {
      room.permissions.set(userId, true);
      io.to(roomId).emit('permissionUpdate', {
        userId,
        granted: true
      });
    }
  });

  socket.on('draw', ({ roomId, data }) => {
    const room = rooms.get(roomId);
    if (room && room.permissions.get(socket.id)) {
      socket.to(roomId).emit('draw', data);
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        room.permissions.delete(socket.id);
        
        // If host disconnects, assign new host
        if (socket.id === room.host && room.users.size > 0) {
          const newHost = room.users.keys().next().value;
          room.host = newHost;
          room.permissions.set(newHost, true);
          io.to(newHost).emit('hostStatus', true);
        }

        io.to(roomId).emit('userLeft', {
          users: Array.from(room.users.entries()),
          permissions: Array.from(room.permissions.entries())
        });
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 