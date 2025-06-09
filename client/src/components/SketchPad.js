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
      setLines((prevLines) => [...prevLines, data]);
    });

    return () => {
      socket.off('draw');
    };
  }, [socket]);

  const handleMouseDown = (e) => {
    if (!hasPermission) return;
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !hasPermission) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    setLines([...lines.slice(0, -1), lastLine]);

    // Emit drawing data to other users
    socket.emit('draw', {
      roomId,
      data: lastLine
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleRequestPermission = () => {
    socket.emit('requestPermission', { roomId });
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {isHost ? 'Host Mode' : hasPermission ? 'Drawing Enabled' : 'Drawing Disabled'}
        </Typography>
        {!hasPermission && !isHost && (
          <Button variant="contained" onClick={handleRequestPermission}>
            Request Drawing Permission
          </Button>
        )}
      </Box>
      <Box sx={{ flex: 1, border: '1px solid #ccc' }}>
        <Stage
          width={window.innerWidth - 40}
          height={window.innerHeight - 200}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
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