import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Plus, Minus, Maximize2, ArrowLeft } from 'lucide-react';

interface SolarMapContentProps {
  card: {
    content: {
      summary: {
        annual_kwh: number;
        monthly_kwh: number[];
        monthly_flux?: number[];
        co2_saved: number;
        panel_count: number;
        roof_area: number;
        max_panels?: number;
        address?: string;
      };
      embed_url: string;
      interactive?: boolean;
      roof_segments?: { id: string; polygon: [number, number][]; potential?: string }[];
    };
  };
  onAction?: (action: string, data?: any) => void;
}

export const SolarMapContent = ({ card, onAction }: SolarMapContentProps) => {
  // 1) Safe defaults to guarantee stability
  const initialSafe = {
    panel_count: 0,
    capacity_kw: 0,
    rooftop_area_m2: 0,
    mapsUrl: '',
    coordinates: { lat: 0, lng: 0 },
    zoom: 20 as number,
    size: '640x640',
  };

  // 2) Local state – never read directly from props
  const [solarData, setSolarData] = useState<typeof initialSafe>(initialSafe);
  const [adjustedPanels, setAdjustedPanels] = useState<number>(0);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const backendContent = (card as any)?.content ?? {};

  // 3) Merge backend response into safe defaults on mount/update
  useEffect(() => {
    const merged = {
      ...initialSafe,
      ...backendContent,
      // Normalize field names
      mapsUrl: backendContent.mapsUrl || backendContent.embed_url || backendContent.embedUrl || '',
      coordinates: backendContent.coordinates ?? initialSafe.coordinates,
    };

    // Ensure numeric fields are present
    merged.panel_count = Number(backendContent.panel_count ?? backendContent.summary?.panel_count ?? 0) || 0;
    merged.capacity_kw = Number(backendContent.capacity_kw ?? 0) || 0;
    merged.rooftop_area_m2 = Number(backendContent.rooftop_area_m2 ?? backendContent.summary?.roof_area ?? 0) || 0;

    setSolarData(merged);
    setAdjustedPanels(merged.panel_count);

    try {
      console.log('Solar analysis response:', JSON.stringify(backendContent, null, 2));
    } catch {}
  }, [card]);
  
  const interactive = Boolean((solarData as any)?.interactive);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        if (e?.data?.type === 'solar_embed_error') {
          setIframeError(true);
        }
      } catch (_) {}
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  
  // Build a fully safe summary derived from state
  const summary = {
    annual_kwh: Number((solarData as any)?.summary?.annual_kwh ?? 0),
    monthly_kwh: Array.isArray((solarData as any)?.summary?.monthly_kwh)
      ? (solarData as any).summary.monthly_kwh
      : new Array(12).fill(0),
    co2_saved: Number((solarData as any)?.summary?.co2_saved ?? 0),
    panel_count: Number(solarData.panel_count ?? (solarData as any)?.summary?.panel_count ?? 0) || 0,
    roof_area: Number(solarData.rooftop_area_m2 ?? (solarData as any)?.summary?.roof_area ?? 0) || 0,
    max_panels: Number((solarData as any)?.summary?.max_panels ?? ((Number(solarData.panel_count ?? 0) || 10) * 2)) || 20,
    address: String((solarData as any)?.summary?.address ?? ''),
  };
  // Calculate adjusted energy based on panel count
  const originalPanels = Math.max(1, Number(summary.panel_count) || 1); // prevent divide-by-zero
  const maxPanels = Math.max(originalPanels, Number(summary.max_panels) || originalPanels * 2);
  const panelRatio = originalPanels > 0 ? (Math.max(0, adjustedPanels) / originalPanels) : 0;
  const adjustedAnnualKwh = Math.round((Number(summary.annual_kwh) || 0) * panelRatio);
  const adjustedCo2Saved = Math.round((Number(summary.co2_saved) || 0) * panelRatio);
  const adjustedMonthlyAvg = Math.round(adjustedAnnualKwh / 12);

  const handlePanelAdjustment = (change: number) => {
    const next = Math.max(0, Math.min(maxPanels, (adjustedPanels || 0) + change));
    setAdjustedPanels(next);
    onAction?.('adjust_panels', {
      panel_count: next,
      annual_kwh: Math.round((Number(summary.annual_kwh) || 0) * (originalPanels ? next / originalPanels : 0)),
    });
  };

  // Log merged state for debugging
  useEffect(() => {
    try {
      console.log('SolarMapContent state:', JSON.stringify(solarData, null, 2));
    } catch {}
  }, [solarData]);

  return (
    <div className="space-y-4">
      {!showInteractiveMap ? (
        <>
          {/* Solar Statistics Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Annual Generation:</strong><br />
                {adjustedAnnualKwh.toLocaleString()} kWh
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">CO₂ Saved:</strong><br />
                {adjustedCo2Saved} tons/year
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Roof Area:</strong><br />
                {summary.roof_area} m²
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Monthly Avg:</strong><br />
                {adjustedMonthlyAvg.toLocaleString()} kWh
              </p>
            </div>
          </div>

          {/* Interactive Panel Adjustment */}
          {interactive && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium mb-2">Adjust Solar Panels</p>
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePanelAdjustment(-1)}
                  disabled={adjustedPanels <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="text-center">
                  <div className="text-lg font-bold">{adjustedPanels}</div>
                  <div className="text-xs text-muted-foreground">panels</div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePanelAdjustment(1)}
                  disabled={adjustedPanels >= maxPanels}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground text-center mt-1">
                Max: {maxPanels} panels
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              className="w-full gap-2"
              onClick={() => setShowInteractiveMap(true)}
            >
              <Maximize2 className="h-4 w-4" />
              View Interactive Roof Map
            </Button>
            
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => onAction?.('request_quote', { 
                panel_count: adjustedPanels, 
                annual_kwh: adjustedAnnualKwh,
                address: summary.address
              })}
            >
              Get Quote for {adjustedPanels} Panels
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Interactive Map View */}
          <div className="space-y-3">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Interactive Solar Map</h3>
                <p className="text-xs text-muted-foreground">
                  {summary.address || 'Your roof with solar panels'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowInteractiveMap(false)}
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            </div>

            {/* Embedded Google Solar Map */}
            <div className="relative w-full h-80 md:h-96 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
              {solarData.mapsUrl ? (
                /staticmap|\.(png|jpg|jpeg|webp)(\?|$)/i.test(solarData.mapsUrl) ? (
                  <img
                    src={solarData.mapsUrl}
                    alt="Rooftop satellite view for solar analysis"
                    className="w-full h-full object-cover"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    onLoad={() => setImageError(false)}
                  />
                ) : (
                  <iframe
                    src={solarData.mapsUrl}
                    className="w-full h-full border-0"
                    title="Interactive Solar Roof Map"
                    loading="lazy"
                    allow="geolocation"
                    style={{ minHeight: '250px' }}
                    onLoad={() => setIframeError(false)}
                    onError={() => setIframeError(true)}
                    sandbox="allow-scripts allow-same-origin"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  No map available.
                </div>
              )}

              {(iframeError || imageError) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3 text-center">
                  <div className="text-xs text-foreground">
                    We couldn't load the map preview. Try opening the full map instead.
                  </div>
                </div>
              )}

              {/* Overlay with current stats */}
              <div className="absolute top-2 left-2 bg-white/95 dark:bg-black/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm">
                <div className="text-xs font-medium">{adjustedPanels} panels</div>
                <div className="text-xs text-muted-foreground">{adjustedAnnualKwh.toLocaleString()} kWh/yr</div>
              </div>
            </div>

            {/* Quick adjustment controls below map */}
            <div className="flex items-center justify-center gap-4 p-2 bg-muted/30 rounded-lg">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handlePanelAdjustment(-1)}
                disabled={adjustedPanels <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="text-center min-w-[80px]">
                <div className="text-sm font-bold">{adjustedPanels} panels</div>
                <div className="text-xs text-muted-foreground">
                  {adjustedAnnualKwh.toLocaleString()} kWh/yr
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handlePanelAdjustment(1)}
                disabled={adjustedPanels >= maxPanels}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* External link and quote buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1"
                onClick={() => solarData.mapsUrl && window.open(solarData.mapsUrl, '_blank')}
                disabled={!solarData.mapsUrl}
              >
                <ExternalLink className="h-3 w-3" />
                Full Map
              </Button>
              
              <Button 
                size="sm"
                onClick={() => onAction?.('request_quote', { 
                  panel_count: adjustedPanels, 
                  annual_kwh: adjustedAnnualKwh,
                  address: summary.address
                })}
              >
                Get Quote
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};