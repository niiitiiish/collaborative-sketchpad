const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { networkInterfaces } = require('os');

const app = express();
const server = http.createServer(app);

// Configure CORS for production
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/'
});

app.use(cors());
app.use(express.json());

// Serve static files from the React app
const buildPath = path.join(__dirname, 'client/build');
console.log('Build path:', buildPath);
console.log('Environment:', process.env.NODE_ENV);
console.log('Current directory:', __dirname);
console.log('Directory contents:', fs.readdirSync(__dirname));

// Check if build directory exists
if (fs.existsSync(buildPath)) {
  console.log('Build directory exists at:', buildPath);
  console.log('Build directory contents:', fs.readdirSync(buildPath));
  // Serve static files from the React app
  app.use(express.static(buildPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('index.html not found at:', indexPath);
      res.status(404).send('index.html not found');
    }
  });
} else {
  console.error('Build directory not found at:', buildPath);
  console.log('Current directory structure:');
  console.log('Root:', fs.readdirSync(__dirname));
  
  // Check client directory
  const clientPath = path.join(__dirname, 'client');
  if (fs.existsSync(clientPath)) {
    console.log('Client directory:', fs.readdirSync(clientPath));
    
    // Check if build exists in client directory
    const clientBuildPath = path.join(clientPath, 'build');
    if (fs.existsSync(clientBuildPath)) {
      console.log('Found build in client directory');
      // Serve static files from the client build directory
      app.use(express.static(clientBuildPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      });
    } else {
      console.log('No build directory found in client');
      // Try to create build directory
      try {
        fs.mkdirSync(clientBuildPath, { recursive: true });
        console.log('Created build directory');
      } catch (error) {
        console.error('Error creating build directory:', error);
      }
      // In production, serve a 404 page
      if (process.env.NODE_ENV === 'production') {
        app.get('*', (req, res) => {
          res.status(404).send('Application not built correctly. Please check the build process.');
        });
      } else {
        // In development, redirect to the React dev server
        app.get('*', (req, res) => {
          res.redirect('http://localhost:3000');
        });
      }
    }
  } else {
    console.log('No client directory found');
    // In production, serve a 404 page
    if (process.env.NODE_ENV === 'production') {
      app.get('*', (req, res) => {
        res.status(404).send('Application not built correctly. Please check the build process.');
      });
    } else {
      // In development, redirect to the React dev server
      app.get('*', (req, res) => {
        res.redirect('http://localhost:3000');
      });
    }
  }
}

// Store active rooms and their permissions
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  console.log('Client IP:', socket.handshake.address);
  console.log('Client headers:', socket.handshake.headers);

  socket.on('joinRoom', ({ roomId, username }) => {
    console.log(`User ${username} (${socket.id}) joining room ${roomId}`);
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      console.log(`Creating new room ${roomId}`);
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
      console.log(`User ${username} (${socket.id}) is now host of room ${roomId}`);
      room.host = socket.id;
      room.permissions.set(socket.id, true);
      console.log(`Setting host permissions for ${username} (${socket.id}) to true`);
      socket.emit('hostStatus', true);
    } else {
      // New users start without permission
      room.permissions.set(socket.id, false);
      console.log(`Setting permissions for ${username} (${socket.id}) to false`);
      socket.emit('hostStatus', false);
    }

    // Notify all users in the room about the new state
    const currentPermissions = Array.from(room.permissions.entries());
    console.log(`Current permissions in room ${roomId}:`, currentPermissions);
    io.to(roomId).emit('userJoined', {
      users: Array.from(room.users.entries()),
      permissions: currentPermissions
    });
  });

  socket.on('requestPermission', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.host) {
      console.log(`User ${room.users.get(socket.id)} (${socket.id}) requesting permission in room ${roomId}`);
      io.to(room.host).emit('permissionRequest', {
        userId: socket.id,
        username: room.users.get(socket.id)
      });
    }
  });

  socket.on('grantPermission', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room && socket.id === room.host) {
      console.log(`Host granting permission to user ${room.users.get(userId)} (${userId}) in room ${roomId}`);
      room.permissions.set(userId, true);
      io.to(roomId).emit('permissionUpdate', {
        userId,
        granted: true
      });
    }
  });

  socket.on('draw', ({ roomId, data }) => {
    const room = rooms.get(roomId);
    if (room) {
      const hasPermission = room.permissions.get(socket.id);
      console.log(`Draw attempt by ${room.users.get(socket.id)} (${socket.id}) in room ${roomId}`);
      console.log(`Permission status: ${hasPermission}`);
      console.log(`Is host: ${socket.id === room.host}`);
      
      if (hasPermission) {
        socket.to(roomId).emit('draw', data);
      } else {
        console.log(`User ${room.users.get(socket.id)} (${socket.id}) attempted to draw without permission in room ${roomId}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const username = room.users.get(socket.id);
        console.log(`User ${username} (${socket.id}) left room ${roomId}`);
        
        room.users.delete(socket.id);
        room.permissions.delete(socket.id);
        
        // If host disconnects, assign new host
        if (socket.id === room.host && room.users.size > 0) {
          const newHost = room.users.keys().next().value;
          const newHostUsername = room.users.get(newHost);
          console.log(`Assigning new host ${newHostUsername} (${newHost}) for room ${roomId}`);
          
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
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Build path: ${buildPath}`);
  console.log(`Build exists: ${fs.existsSync(buildPath)}`);
});

// Function to get local IP address
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
} 