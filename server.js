const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { networkInterfaces } = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST"]
}));

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
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Build path:', buildPath);
  console.log('Build exists:', fs.existsSync(buildPath));
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