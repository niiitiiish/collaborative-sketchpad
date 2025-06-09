import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { Box, Button, Typography } from '@mui/material';

const SketchPad = ({ socket, roomId, hasPermission, isHost }) => {
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const stageRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('draw', (data) => {
      console.log('Received draw data:', data);
      setLines((prevLines) => [...prevLines, data]);
    });

    socket.on('undo', () => {
      console.log('Received undo event');
      setLines((prevLines) => prevLines.slice(0, -1));
    });

    return () => {
      socket.off('draw');
      socket.off('undo');
    };
  }, [socket]);

  const handleMouseDown = (e) => {
    console.log('Mouse down - Permission:', hasPermission, 'Is Host:', isHost);
    if (!hasPermission) {
      console.log('No permission to draw');
      return;
    }
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newLine = { points: [pos.x, pos.y] };
    setLines((prevLines) => [...prevLines, newLine]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !hasPermission) {
      console.log('Cannot draw - Drawing:', isDrawing, 'Permission:', hasPermission);
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    
    // Create a new line object to ensure state update
    const updatedLine = {
      ...lastLine,
      points: [...lastLine.points, point.x, point.y]
    };
    
    setLines((prevLines) => [...prevLines.slice(0, -1), updatedLine]);

    // Emit drawing data to other users
    console.log('Emitting draw data:', updatedLine);
    socket.emit('draw', {
      roomId,
      data: updatedLine
    });
  };

  const handleMouseUp = () => {
    console.log('Mouse up - Stopping drawing');
    setIsDrawing(false);
  };

  const handleRequestPermission = () => {
    console.log('Requesting permission to draw');
    socket.emit('requestPermission', { roomId });
  };

  const handleUndo = () => {
    if (!hasPermission) return;
    
    setLines((prevLines) => {
      if (prevLines.length === 0) return prevLines;
      const newLines = prevLines.slice(0, -1);
      // Emit undo event to other users
      socket.emit('undo', { roomId });
      return newLines;
    });
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {isHost ? 'Host Mode' : hasPermission ? 'Drawing Enabled' : 'Drawing Disabled'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {hasPermission && (
            <Button variant="contained" onClick={handleUndo} disabled={lines.length === 0}>
              Undo
            </Button>
          )}
          {!hasPermission && !isHost && (
            <Button variant="contained" onClick={handleRequestPermission}>
              Request Drawing Permission
            </Button>
          )}
        </Box>
      </Box>
      <Box sx={{ flex: 1, border: '1px solid #ccc' }}>
        <Stage
          width={window.innerWidth - 40}
          height={window.innerHeight - 200}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          ref={stageRef}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="#000000"
                strokeWidth={5}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            ))}
          </Layer>
        </Stage>
      </Box>
    </Box>
  );
};

export default SketchPad; 