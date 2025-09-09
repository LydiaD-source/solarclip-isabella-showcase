import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Plus, Minus } from 'lucide-react';

interface SolarMapContentProps {
  card: {
    content: {
      summary: {
        annual_kwh: number;
        monthly_kwh: number[];
        co2_saved: number;
        panel_count: number;
        roof_area: number;
        max_panels?: number;
        address?: string;
      };
      embed_url: string;
      interactive?: boolean;
    };
  };
  onAction?: (action: string, data?: any) => void;
}

export const SolarMapContent = ({ card, onAction }: SolarMapContentProps) => {
  const [adjustedPanels, setAdjustedPanels] = useState(card.content.summary.panel_count);
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
          variant="outline" 
          className="w-full gap-2"
          onClick={() => window.open(card.content.embed_url, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          View Interactive Solar Map
        </Button>
        
        <Button 
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
    </div>
  );
};