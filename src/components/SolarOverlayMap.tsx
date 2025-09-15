import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, Zap, Home, Calendar } from "lucide-react";

interface SolarData {
  panel_count: number;
  capacity_kw: number;
  rooftop_area_m2: number;
  coordinates: { lat: number; lng: number };
  roof_segments?: Array<{
    centerPoint: { latitude: number; longitude: number };
    boundingBox: {
      sw: { latitude: number; longitude: number };
      ne: { latitude: number; longitude: number };
    };
    pitchDegrees: number;
    azimuthDegrees: number;
    planeHeightAtCenterMeters: number;
    polygon?: Array<{ latitude: number; longitude: number }>;
  }>;
  panel_placements?: Array<{
    segmentIndex: number;
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    pitchDegrees: number;
    azimuthDegrees: number;
  }>;
  yearly_energy_kwh?: number;
  imagery_date?: { year: number; month: number; day: number };
  imagery_quality?: string;
  fallback?: boolean;
}

interface SolarOverlayMapProps {
  address: string;
}

const SolarOverlayMap: React.FC<SolarOverlayMapProps> = ({ address }) => {
  const [solarData, setSolarData] = useState<SolarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageReady, setImageReady] = useState(0);
  const projectRef = 'mzikfyqzwepnubdsclfd';

  useEffect(() => {
    if (!address) {
      setSolarData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        console.log('Fetching solar analysis for:', address);
        const { data, error: fnError } = await supabase.functions.invoke('solar-analysis', {
          body: { address }
        });
        
        if (fnError) throw fnError;
        console.log('Solar analysis response:', data);
        
        setSolarData(data);
      } catch (e: any) {
        console.error("Solar analysis error:", e);
        setError(e?.message || "Error loading solar analysis");
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  // Draw roof segments and panel overlays on canvas
  useEffect(() => {
    if (!solarData || !canvasRef.current || !imageRef.current || !solarData.roof_segments) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    if (!ctx || !img.complete) return;

    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate pixel coordinates from lat/lng
    const { coordinates, roof_segments, panel_placements } = solarData;
    const centerLat = coordinates.lat;
    const centerLng = coordinates.lng;

    // Rough conversion from lat/lng to pixels (this is approximate for visualization)
    const latRange = 0.001; // Approximate degree range visible in 640x640 at zoom 20
    const lngRange = 0.001;
    
    const toXY = (lat: number, lng: number) => ({
      x: ((lng - (centerLng - lngRange / 2)) / lngRange) * canvas.width,
      y: ((centerLat + latRange / 2 - lat) / latRange) * canvas.height,
    });

    roof_segments.forEach((segment, index) => {
      const segmentPanels = panel_placements?.find(p => p.segmentIndex === index);

      // Prefer polygon from API; otherwise approximate from bounding box + azimuth
      const poly = (segment as any).polygon && (segment as any).polygon.length === 4
        ? (segment as any).polygon
        : (() => {
            const sw = segment.boundingBox.sw; const ne = segment.boundingBox.ne;
            const cx = (sw.latitude + ne.latitude) / 2; const cy = (sw.longitude + ne.longitude) / 2;
            const halfWLng = Math.abs(ne.longitude - sw.longitude) / 2;
            const halfHLat = Math.abs(ne.latitude - sw.latitude) / 2;
            const ang = (segment.azimuthDegrees || 0) * Math.PI / 180;
            const pts = [
              { dx: -halfWLng, dy: -halfHLat },
              { dx: halfWLng, dy: -halfHLat },
              { dx: halfWLng, dy: halfHLat },
              { dx: -halfWLng, dy: halfHLat },
            ].map(({ dx, dy }) => {
              const rx = dx * Math.cos(ang) - dy * Math.sin(ang);
              const ry = dx * Math.sin(ang) + dy * Math.cos(ang);
              return { latitude: cx + ry, longitude: cy + rx };
            });
            return pts;
          })();

      // Draw filled polygon
      ctx.beginPath();
      const first = toXY(poly[0].latitude, poly[0].longitude);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < poly.length; i++) {
        const p = toXY(poly[i].latitude, poly[i].longitude);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // Fill and stroke with suitability color
      const hasPanels = !!(segmentPanels && segmentPanels.panelsCount > 0);
      ctx.fillStyle = hasPanels ? 'rgba(5, 150, 105, 0.28)' : 'rgba(220, 38, 38, 0.18)';
      ctx.strokeStyle = hasPanels ? '#059669' : '#dc2626';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Draw panel grid, clipped to polygon
      const bbx1 = ((segment.boundingBox.sw.longitude - (centerLng - lngRange/2)) / lngRange) * canvas.width;
      const bby1 = ((centerLat + latRange/2 - segment.boundingBox.ne.latitude) / latRange) * canvas.height;
      const bbx2 = ((segment.boundingBox.ne.longitude - (centerLng - lngRange/2)) / lngRange) * canvas.width;
      const bby2 = ((centerLat + latRange/2 - segment.boundingBox.sw.latitude) / latRange) * canvas.height;
      const width = Math.abs(bbx2 - bbx1);
      const height = Math.abs(bby2 - bby1);
      const centerX = (bbx1 + bbx2) / 2;
      const centerY = (bby1 + bby2) / 2;
      const ang = (segment.azimuthDegrees || 0) * Math.PI / 180;

      const panelCountTarget = segmentPanels?.panelsCount ?? Math.floor((width * height) / (12 * 16));

      ctx.save();
      // Clip to polygon
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < poly.length; i++) {
        const p = toXY(poly[i].latitude, poly[i].longitude);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.clip();

      // Rotate grid to match azimuth
      ctx.translate(centerX, centerY);
      ctx.rotate(ang);

      const panelW = 8; const panelH = 12; const spacing = 2;
      const cols = Math.floor((width) / (panelW + spacing));
      const rows = Math.ceil(panelCountTarget / Math.max(cols, 1));
      const startX = -width/2 + spacing;
      const startY = -height/2 + spacing;

      ctx.fillStyle = '#1e40af';
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1;

      let drawn = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (drawn >= panelCountTarget) break;
          const px = startX + c * (panelW + spacing);
          const py = startY + r * (panelH + spacing);
          ctx.fillRect(px, py, panelW, panelH);
          ctx.strokeRect(px, py, panelW, panelH);
          drawn++;
        }
      }

      ctx.restore();

      // Label if we have panel info
      if (panelCountTarget > 0) {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const text = `${panelCountTarget} panels`;
        ctx.strokeText(text, centerX, centerY);
        ctx.fillText(text, centerX, centerY);
      }
    });
  }, [solarData, imageReady]);

  const displayUrl = solarData?.coordinates 
    ? `https://${projectRef}.supabase.co/functions/v1/solar-map-image?lat=${solarData.coordinates.lat}&lng=${solarData.coordinates.lng}&zoom=20&size=640x640&maptype=satellite`
    : '';

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-muted rounded-lg">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Analyzing solar potential...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-muted rounded-lg">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!solarData) return null;

  return (
    <div className="w-full space-y-4">
      {/* Main Map with Overlays */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full h-[500px] bg-muted">
            {displayUrl && (
              <>
                <img
                  ref={imageRef}
                  src={displayUrl}
                  alt={`Solar analysis for ${address}`}
                  className="w-full h-full object-cover"
                  loading="eager"
                 onLoad={() => setImageReady((c) => c + 1)}
                  onError={(e) => {
                    console.error('Failed to load solar map image:', e);
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </>
            )}
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 bg-green-600 rounded-sm"></div>
                <span>Suitable for solar panels</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 bg-red-600 rounded-sm"></div>
                <span>Not suitable</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                <span>Solar panel placement</span>
              </div>
            </div>

            {/* Quality Badge */}
            {solarData.imagery_quality && (
              <div className="absolute top-4 right-4">
                <Badge variant={solarData.imagery_quality === 'HIGH' ? 'default' : 'secondary'}>
                  {solarData.imagery_quality} Quality
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Solar Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Sun className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold text-primary">{solarData.panel_count}</div>
            <div className="text-sm text-muted-foreground">Solar Panels</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold text-primary">{solarData.capacity_kw} kW</div>
            <div className="text-sm text-muted-foreground">System Capacity</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Home className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold text-primary">{solarData.rooftop_area_m2} m²</div>
            <div className="text-sm text-muted-foreground">Rooftop Area</div>
          </CardContent>
        </Card>

        {solarData.yearly_energy_kwh && (
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold text-primary">
                {Math.round(solarData.yearly_energy_kwh / 1000)} MWh
              </div>
              <div className="text-sm text-muted-foreground">Annual Energy</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fallback Notice */}
      {solarData.fallback && (
        <div className="text-center text-sm text-muted-foreground">
          <p>Detailed solar analysis unavailable for this location. Showing satellite imagery only.</p>
        </div>
      )}

      {/* Imagery Date */}
      {solarData.imagery_date && (
        <div className="text-center text-xs text-muted-foreground">
          Imagery from {solarData.imagery_date.month}/{solarData.imagery_date.year}
        </div>
      )}
    </div>
  );
};

export default SolarOverlayMap;