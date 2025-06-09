const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

// Store active rooms and users
const rooms = new Map();
const users = new Map();
const roomDrawingHistory = new Map(); // Store drawing history for each room

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomId, username }) => {
    // Leave previous room if any
    if (users.has(socket.id)) {
      const prevRoom = users.get(socket.id).roomId;
      socket.leave(prevRoom);
      if (rooms.has(prevRoom)) {
        rooms.get(prevRoom).delete(socket.id);
        if (rooms.get(prevRoom).size === 0) {
          rooms.delete(prevRoom);
          roomDrawingHistory.delete(prevRoom); // Clear room history when empty
        }
      }
    }

    // Join new room
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      roomDrawingHistory.set(roomId, []); // Initialize drawing history for new room
    }
    rooms.get(roomId).add(socket.id);
    
    // Store user info
    users.set(socket.id, { roomId, username });
    
    // Send current drawing history to new user
    socket.emit('drawingHistory', roomDrawingHistory.get(roomId));
    
    // Notify room
    socket.to(roomId).emit('userJoined', { id: socket.id, username });
    socket.emit('roomJoined', { 
      roomId, 
      users: Array.from(rooms.get(roomId)).map(id => ({
        id,
        username: users.get(id)?.username || 'Anonymous'
      }))
    });
  });

  socket.on('draw', ({ roomId, data }) => {
    // Add drawing to room history
    if (roomDrawingHistory.has(roomId)) {
      roomDrawingHistory.get(roomId).push(data);
    }
    socket.to(roomId).emit('draw', data);
  });

  socket.on('undo', ({ roomId }) => {
    // Remove last drawing from room history
    if (roomDrawingHistory.has(roomId)) {
      const history = roomDrawingHistory.get(roomId);
      if (history.length > 0) {
        history.pop();
      }
    }
    // Broadcast undo event to all users in the room
    io.to(roomId).emit('undo');
  });

  socket.on('chatMessage', ({ roomId, message, username }) => {
    io.to(roomId).emit('chatMessage', {
      id: socket.id,
      username,
      message,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { roomId } = user;
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
          roomDrawingHistory.delete(roomId); // Clear room history when empty
        } else {
          io.to(roomId).emit('userLeft', { id: socket.id, username: user.username });
        }
      }
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
}); 