import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Box, TextField, Button, Typography, Paper, List, ListItem, ListItemText, Snackbar, Alert } from '@mui/material';
import SketchPad from './components/SketchPad';

// Connect to the appropriate server URL based on environment
const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin  // Automatically use the current domain
  : 'http://localhost:5000';

const socket = io(SOCKET_URL);

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
      setIsHost(status);
      setHasPermission(status);
    });

    socket.on('userJoined', ({ users, permissions }) => {
      setUsers(users);
      setHasPermission(permissions.some(([id, hasPermission]) => id === socket.id && hasPermission));
    });

    socket.on('permissionRequest', ({ userId, username }) => {
      setPermissionRequests((prev) => [...prev, { userId, username }]);
      setNotification({
        open: true,
        message: `${username} is requesting drawing permission`,
        severity: 'info'
      });
    });

    socket.on('permissionUpdate', ({ userId, granted }) => {
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
    socket.emit('joinRoom', { roomId, username });
    setIsJoined(true);
  };

  const handleGrantPermission = (userId) => {
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
