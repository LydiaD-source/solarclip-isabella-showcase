import React, { useEffect, useRef, useState } from 'react';

interface RoofSegment {
  id: string;
  polygon: [number, number][];
  potential: 'high' | 'medium' | 'low';
  panelCount?: number;
}

interface RoofSegmentationOverlayProps {
  address: string;
  roofSegments?: RoofSegment[];
  onSegmentClick?: (segment: RoofSegment) => void;
}

export const RoofSegmentationOverlay = ({ 
  address, 
  roofSegments = [], 
  onSegmentClick 
}: RoofSegmentationOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use a simple static satellite-style base image instead of calling non-existent API
    setLoading(false);
    setMapImage('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOGVjNWZjO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2MzY2ZjE7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNncmFkaWVudCkiLz4KICA8IS0tIEJ1aWxkaW5nIE91dGxpbmUgLS0+CiAgPHJlY3QgeD0iMTAwIiB5PSI4MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNDAiIGZpbGw9IiNmM2Y0ZjYiIHN0cm9rZT0iI2Q2ZDNkMSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPCEtLSBSb29mIDEgLS0+CiAgPHBvbHlnb24gcG9pbnRzPSI4MCw2MCAzMjAsNjAgMzIwLDE4MCA4MCwxODAiIGZpbGw9IiNlNWU3ZWIiIHN0cm9rZT0iI2Q2ZDNkMSIgc3Ryb2tlLXdpZHRoPSIxIi8+CiAgPCEtLSBSb29mIDIgLS0+CiAgPHBvbHlnb24gcG9pbnRzPSIzMjAsODAgMzgwLDgwIDM4MCwxNjAgMzIwLDE2MCIgZmlsbD0iI2Y5ZmFmYiIgc3Ryb2tlPSIjZDZkM2QxIiBzdHJva2Utd2lkdGg9IjEiLz4KICA8IS0tIFNtYWxsIFNlY3Rpb24gLS0+CiAgPHBvbHlnb24gcG9pbnRzPSI2MCwxODAgMTQwLDE4MCAxNDAsMjIwIDYwLDIyMCIgZmlsbD0iI2Y5ZmFmYiIgc3Ryb2tlPSIjZDZkM2QxIiBzdHJva2Utd2lkdGg9IjEiLz4KICA8dGV4dCB4PSIyMDAiIHk9IjI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Tb2xhciBBbmFseXNpcyBNYXA8L3RleHQ+Cjwvc3ZnPg==');
  }, [address]);

  useEffect(() => {
    if (!mapImage || !canvasRef.current || roofSegments.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Clear canvas and draw satellite image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw roof segments with different colors based on solar potential
      roofSegments.forEach((segment) => {
        const color = {
          high: 'rgba(255, 193, 7, 0.6)',    // Golden yellow for high potential
          medium: 'rgba(255, 152, 0, 0.5)',   // Orange for medium potential  
          low: 'rgba(158, 158, 158, 0.4)'     // Gray for low potential
        }[segment.potential];

        const strokeColor = {
          high: '#FFC107',
          medium: '#FF9800', 
          low: '#9E9E9E'
        }[segment.potential];

        // Draw polygon
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;

        if (segment.polygon.length > 0) {
          ctx.moveTo(segment.polygon[0][0], segment.polygon[0][1]);
          segment.polygon.forEach(([x, y]) => {
            ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Draw solar panels for high potential areas
        if (segment.potential === 'high' && segment.panelCount) {
          drawSolarPanels(ctx, segment.polygon, segment.panelCount);
        }
      });
    };
    
    img.src = mapImage;
  }, [mapImage, roofSegments]);

  const drawSolarPanels = (
    ctx: CanvasRenderingContext2D, 
    polygon: [number, number][], 
    panelCount: number
  ) => {
    if (polygon.length < 3) return;

    // Calculate bounding box of polygon
    const minX = Math.min(...polygon.map(p => p[0]));
    const maxX = Math.max(...polygon.map(p => p[0]));
    const minY = Math.min(...polygon.map(p => p[1]));
    const maxY = Math.max(...polygon.map(p => p[1]));

    const panelWidth = 8;
    const panelHeight = 12;
    const spacing = 2;

    // Calculate grid dimensions
    const cols = Math.floor((maxX - minX) / (panelWidth + spacing));
    const rows = Math.floor((maxY - minY) / (panelHeight + spacing));
    const maxPossible = cols * rows;
    const actualPanels = Math.min(panelCount, maxPossible);

    // Draw panels in a grid pattern
    let panelsDrawn = 0;
    for (let row = 0; row < rows && panelsDrawn < actualPanels; row++) {
      for (let col = 0; col < cols && panelsDrawn < actualPanels; col++) {
        const x = minX + col * (panelWidth + spacing) + spacing;
        const y = minY + row * (panelHeight + spacing) + spacing;

        // Check if panel center is inside polygon
        if (isPointInPolygon([x + panelWidth/2, y + panelHeight/2], polygon)) {
          // Draw solar panel
          ctx.fillStyle = '#1565C0'; // Dark blue for panels
          ctx.strokeStyle = '#0D47A1';
          ctx.lineWidth = 1;
          ctx.fillRect(x, y, panelWidth, panelHeight);
          ctx.strokeRect(x, y, panelWidth, panelHeight);

          // Add panel grid lines
          ctx.strokeStyle = '#E3F2FD';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x + panelWidth/2, y);
          ctx.lineTo(x + panelWidth/2, y + panelHeight);
          ctx.moveTo(x, y + panelHeight/2);
          ctx.lineTo(x + panelWidth, y + panelHeight/2);
          ctx.stroke();

          panelsDrawn++;
        }
      }
    }
  };

  const isPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !onSegmentClick) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    // Find clicked segment
    const clickedSegment = roofSegments.find(segment => 
      isPointInPolygon([x, y], segment.polygon)
    );

    if (clickedSegment) {
      onSegmentClick(clickedSegment);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-64 bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading roof analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden border">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full h-auto cursor-pointer"
          onClick={handleCanvasClick}
          style={{ maxHeight: '300px' }}
        />
        
        {/* Legend */}
        <div className="absolute top-2 right-2 bg-white/95 dark:bg-black/95 backdrop-blur-sm rounded-md p-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>High potential</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-400 rounded"></div>
            <span>Medium potential</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded"></div>
            <span>Solar panels</span>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Click on roof segments to see detailed analysis
      </p>
    </div>
  );
};