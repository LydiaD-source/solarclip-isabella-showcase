import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MapPin, Zap, BarChart3, Home, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SolarData {
  maxArrayPanelsCount: number;
  maxArrayAreaMeters2: number;
  maxSunshineHoursPerYear: number;
  carbonOffsetFactorKgPerMwh: number;
  wholeRoofStats: {
    areaMeters2: number;
    sunshineQuantiles: number[];
    groundAreaMeters2: number;
  };
  solarPanelConfigs: Array<{
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    roofSegmentSummaries: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      panelsCount: number;
      yearlyEnergyDcKwh: number;
    }>;
  }>;
  financialAnalyses: Array<{
    monthlyBill: {
      currencyCode: string;
      units: string;
    };
    panelConfigIndex: number;
  }>;
}

export const GoogleSolarMap = () => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [solarData, setSolarData] = useState<SolarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const features = [
    { icon: Home, text: "Roof area analysis" },
    { icon: Zap, text: "Solar potential estimation" },
    { icon: BarChart3, text: "Energy generation insights" }
  ];

  const handleAnalyze = async () => {
    if (!address.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter a property address to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setSolarData(null);

    try {
      const response = await fetch('https://mzikfyqzwepnubdsclfd.supabase.co/functions/v1/google-solar-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aWtmeXF6d2VwbnViZHNjbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjYwOTAsImV4cCI6MjA3MzAwMjA5MH0.pU9K35VK1G2Zp6HATRAhaahMN-QWY_BSXjmtbXEIMrM`
        },
        body: JSON.stringify({ address })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setSolarData(data);
      toast({
        title: "Analysis Complete",
        description: "Solar potential analysis completed successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze solar potential';
      setError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatEnergy = (kwh: number) => {
    if (kwh >= 1000000) {
      return `${(kwh / 1000000).toFixed(1)} GWh`;
    }
    if (kwh >= 1000) {
      return `${(kwh / 1000).toFixed(1)} MWh`;
    }
    return `${Math.round(kwh)} kWh`;
  };

  return (
    <div className="w-full">
      {/* Input Section */}
      <Card className="card-premium p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Enter property address (e.g., 1600 Amphitheatre Parkway, Mountain View, CA)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
              className="w-full"
            />
          </div>
          <Button 
            onClick={handleAnalyze}
            disabled={isLoading}
            className="btn-hero min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Analyze Roof
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg">
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
              <feature.icon className="w-5 h-5 text-accent" />
            </div>
            <span className="text-foreground font-medium">{feature.text}</span>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-6 mb-6 border-destructive/50 bg-destructive/5">
          <div className="text-destructive font-medium">Error: {error}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Please check the address and try again. Make sure you have a valid Google Solar API key.
          </p>
        </Card>
      )}

      {/* Results Display */}
      {solarData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="card-premium p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {formatNumber(solarData.maxArrayPanelsCount)}
              </div>
              <div className="text-sm text-muted-foreground">Solar Panels</div>
            </Card>
            
            <Card className="card-premium p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {formatNumber(solarData.maxArrayAreaMeters2)} m²
              </div>
              <div className="text-sm text-muted-foreground">Panel Area</div>
            </Card>
            
            <Card className="card-premium p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {formatNumber(solarData.wholeRoofStats.areaMeters2)} m²
              </div>
              <div className="text-sm text-muted-foreground">Total Roof Area</div>
            </Card>
            
            <Card className="card-premium p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">
                {formatNumber(solarData.maxSunshineHoursPerYear)} hrs
              </div>
              <div className="text-sm text-muted-foreground">Sunshine/Year</div>
            </Card>
          </div>

          {/* Energy Generation */}
          {solarData.solarPanelConfigs && solarData.solarPanelConfigs.length > 0 && (
            <Card className="card-premium p-6">
              <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
                Energy Generation Potential
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {solarData.solarPanelConfigs.slice(0, 2).map((config, index) => (
                  <div key={index} className="bg-secondary/30 rounded-lg p-4">
                    <div className="text-lg font-semibold text-foreground mb-2">
                      Configuration {index + 1}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Panels:</span>
                        <span className="font-medium">{formatNumber(config.panelsCount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Annual Energy:</span>
                        <span className="font-medium text-accent">
                          {formatEnergy(config.yearlyEnergyDcKwh)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Environmental Impact */}
          <Card className="card-premium p-6">
            <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
              Environmental Impact
            </h3>
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-accent mb-2">
                {formatNumber(solarData.carbonOffsetFactorKgPerMwh)} kg CO₂
              </div>
              <div className="text-sm text-muted-foreground">
                Carbon offset factor per MWh
              </div>
            </div>
          </Card>

          {/* Map Placeholder */}
          <Card className="card-premium p-6">
            <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
              Roof Analysis Map
            </h3>
            <div 
              ref={mapRef}
              className="w-full h-64 bg-secondary/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border"
            >
              <div className="text-center">
                <MapPin className="w-12 h-12 text-accent mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Interactive map visualization coming soon
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Address: {address}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Instructions */}
      <Card className="card-premium p-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white text-sm font-bold">1</span>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Enter Address</h4>
              <p className="text-sm text-muted-foreground">Type your property address in the search box</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white text-sm font-bold">2</span>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Analyze Roof</h4>
              <p className="text-sm text-muted-foreground">Get detailed solar potential analysis</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white text-sm font-bold">3</span>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">View Results</h4>
              <p className="text-sm text-muted-foreground">See energy generation and SolarClip™ potential</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};