import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Plus, Minus, Maximize2, ArrowLeft } from 'lucide-react';
import { RoofSegmentationOverlay } from './RoofSegmentationOverlay';
import { supabase } from '@/integrations/supabase/client';

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
        latitude?: number;
        longitude?: number;
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
  const [segmentationData, setSegmentationData] = useState<any>(null);
  const [loadingSegmentation, setLoadingSegmentation] = useState(false);
  
  // Load segmentation data when switching to interactive map
  const loadSegmentationData = async () => {
    if (segmentationData || loadingSegmentation) return;
    
    setLoadingSegmentation(true);
    try {
      const address = card.content.summary.address;
      const lat = card.content.summary.latitude || 40.7128;
      const lng = card.content.summary.longitude || -74.0060;
      
      console.log("Loading segmentation for:", { address, lat, lng });
      
      const { data, error } = await supabase.functions.invoke('solar-segmentation', {
        body: { address, lat, lng }
      });
      
      if (error) {
        console.error("Segmentation error:", error);
        throw error;
      }
      
      if (data?.success) {
        setSegmentationData(data.segmentation);
        console.log("Segmentation loaded:", data.segmentation);
      } else {
        throw new Error(data?.error || "Failed to load segmentation");
      }
    } catch (error) {
      console.error("Failed to load segmentation:", error);
      // Continue without segmentation - don't break the UI
    } finally {
      setLoadingSegmentation(false);
    }
  };

  // Load segmentation when interactive map is shown
  useEffect(() => {
    if (showInteractiveMap) {
      loadSegmentationData();
    }
  }, [showInteractiveMap]);

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

            {/* Enhanced Roof Segmentation Map */}
            <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
              {loadingSegmentation && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="text-white text-sm">Loading segmentation...</div>
                </div>
              )}
              <RoofSegmentationOverlay
                address={card.content.summary.address || ''}
                roofSegments={segmentationData?.polygons || (card.content.roof_segments?.map((seg: any) => ({
                  ...seg,
                  potential: seg.potential === 'high' || seg.potential === 'medium' || seg.potential === 'low' ? seg.potential : 'medium'
                })) || [
                  {
                    id: 'main-roof',
                    polygon: [[80, 60], [320, 60], [320, 180], [80, 180]],
                    potential: 'high',
                    panelCount: Math.floor(adjustedPanels * 0.7)
                  },
                  {
                    id: 'side-roof', 
                    polygon: [[320, 80], [380, 80], [380, 160], [320, 160]],
                    potential: 'medium',
                    panelCount: Math.floor(adjustedPanels * 0.2)
                  },
                  {
                    id: 'small-section',
                    polygon: [[60, 180], [140, 180], [140, 220], [60, 220]],
                    potential: 'low',
                    panelCount: Math.floor(adjustedPanels * 0.1)
                  }
                ])}
                onSegmentClick={(segment) => {
                  console.log('Clicked segment:', segment);
                  onAction?.('segment_selected', segment);
                }}
              />
              
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