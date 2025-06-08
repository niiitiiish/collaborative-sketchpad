# Collaborative Sketch Pad

A real-time collaborative sketch pad application where multiple users can join a room and draw together. The application features a host system where the host can manage drawing permissions for other users.

## Features

- Real-time collaborative drawing
- Room-based collaboration
- Host system for managing drawing permissions
- Permission request system
- User list display
- Modern Material-UI interface

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install server dependencies:
   ```bash
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npm run dev
   ```
2. In a new terminal, start the client:
   ```bash
   npm run client
   ```
   
Alternatively, you can run both the server and client concurrently:
```bash
npm run dev:full
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## How to Use

1. Open the application in your browser
2. Enter your username and a room ID
3. Click "Join Room"
4. The first user to join becomes the host
5. Other users can request drawing permission from the host
6. The host can grant or revoke drawing permissions
7. Users with permission can draw on the sketch pad

## Technologies Used

- React
- Socket.IO
- Material-UI
- Konva.js
- Express.js
- Node.js 