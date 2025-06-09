import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Box, TextField, Button, Typography, Paper, List, ListItem, ListItemText, Snackbar, Alert } from '@mui/material';
import SketchPad from './components/SketchPad';

// Connect to the appropriate server URL based on environment
const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin  // In production, use the deployed URL
  : `http://${window.location.hostname}:5000`;  // In development, use local server

console.log('Environment:', process.env.NODE_ENV);
console.log('Current URL:', window.location.origin);
console.log('Connecting to socket server at:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  path: '/socket.io/',
  secure: process.env.NODE_ENV === 'production',
  rejectUnauthorized: false
});

// Add connection status logging
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  console.error('Connection details:', {
    url: SOCKET_URL,
    environment: process.env.NODE_ENV,
    origin: window.location.origin
  });
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
});

function App() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [users, setUsers] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    socket.on('hostStatus', (status) => {
      console.log('Host status received:', status);
      setIsHost(status);
      setHasPermission(status);
      setNotification({
        open: true,
        message: status ? 'You are the host' : 'You are not the host',
        severity: 'info'
      });
    });

    socket.on('userJoined', ({ users, permissions }) => {
      console.log('Users joined:', users);
      console.log('Permissions:', permissions);
      setUsers(users);
      const userPermission = permissions.find(([id]) => id === socket.id);
      const hasPermission = userPermission ? userPermission[1] : false;
      console.log('Setting permission to:', hasPermission);
      setHasPermission(hasPermission);
    });

    socket.on('permissionRequest', ({ userId, username }) => {
      console.log('Permission request from:', username);
      setPermissionRequests((prev) => [...prev, { userId, username }]);
      setNotification({
        open: true,
        message: `${username} is requesting drawing permission`,
        severity: 'info'
      });
    });

    socket.on('permissionUpdate', ({ userId, granted }) => {
      console.log('Permission update:', userId, granted);
      if (userId === socket.id) {
        setHasPermission(granted);
        setNotification({
          open: true,
          message: granted ? 'You have been granted drawing permission' : 'Your drawing permission has been revoked',
          severity: granted ? 'success' : 'warning'
        });
      }
    });

    return () => {
      socket.off('hostStatus');
      socket.off('userJoined');
      socket.off('permissionRequest');
      socket.off('permissionUpdate');
    };
  }, []);

  const handleJoinRoom = () => {
    if (!username || !roomId) return;
    console.log('Joining room:', roomId, 'as', username);
    socket.emit('joinRoom', { roomId, username });
    setIsJoined(true);
  };

  const handleGrantPermission = (userId) => {
    console.log('Granting permission to:', userId);
    socket.emit('grantPermission', { roomId, userId });
    setPermissionRequests((prev) => prev.filter((req) => req.userId !== userId));
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (!isJoined) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
          <Typography variant="h4" gutterBottom>
            Join Sketch Room
          </Typography>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            margin="normal"
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleJoinRoom}
            sx={{ mt: 2 }}
            disabled={!username || !roomId}
          >
            Join Room
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      <Box sx={{ width: 250, p: 2, borderRight: '1px solid #ccc' }}>
        <Typography variant="h6" gutterBottom>
          Users in Room
        </Typography>
        <List>
          {users.map(([id, name]) => (
            <ListItem key={id}>
              <ListItemText
                primary={name}
                secondary={id === socket.id ? '(You)' : ''}
              />
            </ListItem>
          ))}
        </List>
        {isHost && permissionRequests.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Permission Requests
            </Typography>
            {permissionRequests.map(({ userId, username }) => (
              <Box key={userId} sx={{ mb: 1 }}>
                <Typography variant="body2">{username}</Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleGrantPermission(userId)}
                >
                  Grant Permission
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1 }}>
        <SketchPad
          socket={socket}
          roomId={roomId}
          hasPermission={hasPermission}
          isHost={isHost}
        />
      </Box>
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
