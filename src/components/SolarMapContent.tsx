import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Plus, Minus, Maximize2, ArrowLeft } from 'lucide-react';

interface SolarMapContentProps {
  card: {
    content?: any;
  };
  onAction?: (action: string, data?: any) => void;
}

export const SolarMapContent = ({ card, onAction }: SolarMapContentProps) => {
  // 1) Initialize state with safe defaults BEFORE any render
  const safeSolarData = {
    panel_count: 0,
    capacity_kw: 0,
    rooftop_area_m2: 0,
    mapsUrl: "",
    coordinates: { lat: 0, lng: 0 },
    zoom: 20,
    size: "640x640",
    summary: {
      annual_kwh: 0,
      monthly_kwh: new Array(12).fill(0),
      co2_saved: 0,
      panel_count: 0,
      roof_area: 0,
      max_panels: 20,
      address: ""
    },
    interactive: false
  };

  const [solarData, setSolarData] = useState(safeSolarData);
  const [adjustedPanels, setAdjustedPanels] = useState(0);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 2) Merge API response safely in useEffect
  useEffect(() => {
    if (card?.content) {
      setSolarData(prev => {
        const merged = {
          ...prev,
          ...card.content,
          // Normalize field names
          mapsUrl: card.content.mapsUrl || card.content.embed_url || card.content.embedUrl || prev.mapsUrl,
          panel_count: Number(card.content.panel_count ?? card.content.summary?.panel_count ?? prev.panel_count) || 0,
          capacity_kw: Number(card.content.capacity_kw ?? prev.capacity_kw) || 0,
          rooftop_area_m2: Number(card.content.rooftop_area_m2 ?? card.content.summary?.roof_area ?? prev.rooftop_area_m2) || 0,
          coordinates: card.content.coordinates ?? prev.coordinates,
          summary: {
            ...prev.summary,
            ...(card.content.summary ?? {}),
            annual_kwh: Number(card.content.summary?.annual_kwh ?? prev.summary.annual_kwh) || 0,
            co2_saved: Number(card.content.summary?.co2_saved ?? prev.summary.co2_saved) || 0,
            panel_count: Number(card.content.summary?.panel_count ?? card.content.panel_count ?? prev.summary.panel_count) || 0,
            roof_area: Number(card.content.summary?.roof_area ?? card.content.rooftop_area_m2 ?? prev.summary.roof_area) || 0,
            max_panels: Number(card.content.summary?.max_panels ?? (card.content.panel_count || 10) * 2 ?? prev.summary.max_panels) || 20,
            address: String(card.content.summary?.address ?? prev.summary.address)
          },
          interactive: Boolean(card.content.interactive ?? prev.interactive)
        };
        return merged;
      });
    }
  }, [card?.content]);

  // Update adjusted panels when solarData changes
  useEffect(() => {
    setAdjustedPanels(solarData.panel_count || solarData.summary.panel_count || 0);
  }, [solarData.panel_count, solarData.summary.panel_count]);

  // 3) Log for debugging
  useEffect(() => {
    console.log("Solar data:", JSON.stringify(solarData, null, 2));
  }, [solarData]);

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

  // 4) All calculations use solarData, never card.content
  const originalPanels = Math.max(1, Number(solarData.panel_count || solarData.summary.panel_count) || 1);
  const maxPanels = Math.max(originalPanels, Number(solarData.summary.max_panels) || originalPanels * 2);
  const panelRatio = originalPanels > 0 ? Math.max(0, adjustedPanels) / originalPanels : 0;
  const adjustedAnnualKwh = Math.round((Number(solarData.summary.annual_kwh) || 0) * panelRatio);
  const adjustedCo2Saved = Math.round((Number(solarData.summary.co2_saved) || 0) * panelRatio);
  const adjustedMonthlyAvg = Math.round(adjustedAnnualKwh / 12);

  const handlePanelAdjustment = (change: number) => {
    const next = Math.max(0, Math.min(maxPanels, adjustedPanels + change));
    setAdjustedPanels(next);
    onAction?.('adjust_panels', {
      panel_count: next,
      annual_kwh: Math.round((Number(solarData.summary.annual_kwh) || 0) * (originalPanels ? next / originalPanels : 0)),
    });
  };

  return (
    <div className="space-y-4">
      {!showInteractiveMap ? (
        <>
          {/* Solar Statistics Grid - ALWAYS use solarData */}
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
                <strong className="text-foreground">Panels:</strong><br />
                {solarData.panel_count || solarData.summary.panel_count}
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Capacity:</strong><br />
                {solarData.capacity_kw} kW
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Roof Area:</strong><br />
                {solarData.rooftop_area_m2 || solarData.summary.roof_area} m²
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Monthly Avg:</strong><br />
                {adjustedMonthlyAvg.toLocaleString()} kWh
              </p>
            </div>
          </div>

          {/* Interactive Panel Adjustment */}
          {solarData.interactive && (
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
                address: solarData.summary.address
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
                  {solarData.summary.address || 'Your roof with solar panels'}
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

            {/* 5) Render map safely using solarData */}
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
                <div 
                  style={{ width: '100%', height: '100%', backgroundColor: '#ccc' }}
                  className="flex items-center justify-center text-xs text-muted-foreground"
                >
                  Loading map...
                </div>
              )}

              {(iframeError || imageError) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3 text-center">
                  <div className="text-xs text-foreground">
                    We couldn't load the map preview. Try opening the full map instead.
                  </div>
                </div>
              )}

              {/* Overlay with current stats - use solarData */}
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
                  address: solarData.summary.address
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