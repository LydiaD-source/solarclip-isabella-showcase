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
  const [adjustedPanels, setAdjustedPanels] = useState(card.content.summary.panel_count);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const originalPanels = card.content.summary.panel_count;
  const maxPanels = card.content.summary.max_panels || originalPanels * 2;
  
  // Calculate adjusted energy based on panel count
  const panelRatio = adjustedPanels / originalPanels;
  const adjustedAnnualKwh = Math.round(card.content.summary.annual_kwh * panelRatio);
  const adjustedCo2Saved = Math.round(card.content.summary.co2_saved * panelRatio);
  const adjustedMonthlyAvg = Math.round(adjustedAnnualKwh / 12);

  const handlePanelAdjustment = (change: number) => {
    const newCount = Math.max(1, Math.min(maxPanels, adjustedPanels + change));
    setAdjustedPanels(newCount);
    
    // Trigger action for panel adjustment
    onAction?.('adjust_panels', { 
      panel_count: newCount, 
      annual_kwh: Math.round(card.content.summary.annual_kwh * (newCount / originalPanels))
    });
  };

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
                {card.content.summary.roof_area} m²
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Monthly Avg:</strong><br />
                {adjustedMonthlyAvg.toLocaleString()} kWh
              </p>
            </div>
          </div>

          {/* Interactive Panel Adjustment */}
          {card.content.interactive && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium mb-2">Adjust Solar Panels</p>
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePanelAdjustment(-1)}
                  disabled={adjustedPanels <= 1}
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
                address: card.content.summary.address
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
                  {card.content.summary.address || 'Your roof with solar panels'}
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
            <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
              <iframe
                src={card.content.embed_url}
                className="w-full h-full border-0"
                title="Interactive Solar Roof Map"
                loading="lazy"
                allow="geolocation"
                style={{ minHeight: '250px' }}
                onLoad={() => setIframeError(false)}
                onError={() => setIframeError(true)}
              />

              {iframeError && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3 text-center">
                  <div className="text-xs text-foreground">
                    Roof segmentation unavailable for this location. Try a different address.
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
                disabled={adjustedPanels <= 1}
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
                onClick={() => window.open(card.content.embed_url, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
                Full Map
              </Button>
              
              <Button 
                size="sm"
                onClick={() => onAction?.('request_quote', { 
                  panel_count: adjustedPanels, 
                  annual_kwh: adjustedAnnualKwh,
                  address: card.content.summary.address
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