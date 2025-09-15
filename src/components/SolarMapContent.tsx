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

  const [solarData, setSolarData] = useState<typeof safeSolarData | undefined>(undefined);
  const [adjustedPanels, setAdjustedPanels] = useState(0);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 2) Merge API response safely in useEffect
  useEffect(() => {
    if (card?.content) {
      setSolarData(prev => {
        const base = prev ?? safeSolarData;
        const content = card.content || {};
        const merged = {
          ...base,
          ...content,
          // Normalize field names
          mapsUrl: content.mapsUrl || content.embed_url || content.embedUrl || base.mapsUrl,
          panel_count: Number(content.panel_count ?? content.summary?.panel_count ?? base.panel_count) || 0,
          capacity_kw: Number(content.capacity_kw ?? base.capacity_kw) || 0,
          rooftop_area_m2: Number(content.rooftop_area_m2 ?? content.summary?.roof_area ?? base.rooftop_area_m2) || 0,
          coordinates: content.coordinates ?? base.coordinates,
          summary: {
            ...base.summary,
            ...(content.summary ?? {}),
            annual_kwh: Number(content.summary?.annual_kwh ?? base.summary.annual_kwh) || 0,
            co2_saved: Number(content.summary?.co2_saved ?? base.summary.co2_saved) || 0,
            panel_count: Number(content.summary?.panel_count ?? content.panel_count ?? base.summary.panel_count) || 0,
            roof_area: Number(content.summary?.roof_area ?? content.rooftop_area_m2 ?? base.summary.roof_area) || 0,
            max_panels: Number(content.summary?.max_panels ?? (content.panel_count || 10) * 2 ?? base.summary.max_panels) || 20,
            address: String(content.summary?.address ?? base.summary.address)
          },
          interactive: Boolean(content.interactive ?? base.interactive)
        };
        return merged;
      });
    }
  }, [card?.content]);

  // Update adjusted panels when solarData changes
  useEffect(() => {
    setAdjustedPanels((solarData?.panel_count ?? solarData?.summary?.panel_count ?? 0) as number);
  }, [solarData]);

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

  // Loading fallback if data not yet available
  if (!solarData) {
    return (<div>Loading solar map...</div>);
  }

  // Safe derived reads from solarData
  const panelCount = solarData?.panel_count ?? solarData?.summary?.panel_count ?? 0;
  const capacityKw = solarData?.capacity_kw ?? 0;
  const rooftopArea = solarData?.rooftop_area_m2 ?? solarData?.summary?.roof_area ?? 0;
  const mapUrl = solarData?.mapsUrl ?? '';

  const originalPanels = Math.max(1, Number(panelCount) || 1);
  const maxPanels = Math.max(originalPanels, Number(solarData?.summary?.max_panels ?? originalPanels * 2) || originalPanels * 2);
  const panelRatio = originalPanels > 0 ? Math.max(0, adjustedPanels) / originalPanels : 0;
  const adjustedAnnualKwh = Math.round((Number(solarData?.summary?.annual_kwh ?? 0)) * panelRatio);
  const adjustedCo2Saved = Math.round((Number(solarData?.summary?.co2_saved ?? 0)) * panelRatio);
  const adjustedMonthlyAvg = Math.round(adjustedAnnualKwh / 12);

  const handlePanelAdjustment = (change: number) => {
    const next = Math.max(0, Math.min(maxPanels, adjustedPanels + change));
    setAdjustedPanels(next);
    onAction?.('adjust_panels', {
      panel_count: next,
      annual_kwh: Math.round((Number(solarData.summary?.annual_kwh ?? 0)) * (originalPanels ? next / originalPanels : 0)),
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
                {panelCount}
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Capacity:</strong><br />
                {capacityKw} kW
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Roof Area:</strong><br />
                {rooftopArea} m²
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
                address: solarData.summary?.address || ''
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
                  {solarData.summary?.address || 'Your roof with solar panels'}
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
                <img
                  src={mapUrl}
                  alt="Solar map"
                  className="w-full h-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                />
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
                onClick={() => mapUrl && window.open(mapUrl, '_blank')}
                disabled={!mapUrl}
              >
                <ExternalLink className="h-3 w-3" />
                Full Map
              </Button>
              
              <Button 
                size="sm"
                onClick={() => onAction?.('request_quote', { 
                  panel_count: adjustedPanels, 
                  annual_kwh: adjustedAnnualKwh,
                  address: solarData.summary?.address || ''
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