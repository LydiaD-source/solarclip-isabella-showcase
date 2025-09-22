import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { MapPin, Zap, BarChart3, Home, Loader2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface SolarData {
  name?: string;
  center?: {
    latitude: number;
    longitude: number;
  };
  maxArrayPanelsCount: number;
  maxArrayAreaMeters2: number;
  maxSunshineHoursPerYear: number;
  carbonOffsetFactorKgPerMwh: number;
  wholeRoofStats: {
    areaMeters2: number;
    sunshineQuantiles: number[];
    groundAreaMeters2: number;
  };
  roofSegmentStats?: Array<{
    pitchDegrees: number;
    azimuthDegrees: number;
    stats: {
      areaMeters2: number;
      sunshineQuantiles: number[];
      groundAreaMeters2: number;
    };
    center: {
      latitude: number;
      longitude: number;
    };
    boundingBox: {
      sw: { latitude: number; longitude: number };
      ne: { latitude: number; longitude: number };
    };
  }>;
  solarPanelConfigs: Array<{
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    roofSegmentSummaries: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      panelsCount: number;
      yearlyEnergyDcKwh: number;
      segmentIndex?: number;
    }>;
  }>;
  financialAnalyses?: Array<{
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
  const [selectedPanels, setSelectedPanels] = useState(0);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
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
      if (data.solarPanelConfigs && data.solarPanelConfigs.length > 0) {
        setSelectedPanels(data.solarPanelConfigs[0].panelsCount);
        setCurrentConfig(data.solarPanelConfigs[0]);
      }
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

  const handlePanelChange = (panelCount: number) => {
    if (!solarData || !solarData.solarPanelConfigs) return;
    
    const config = solarData.solarPanelConfigs.find(c => c.panelsCount === panelCount) || 
                   solarData.solarPanelConfigs[0];
    setSelectedPanels(panelCount);
    setCurrentConfig(config);
  };

  useEffect(() => {
    if (!solarData || !solarData.center || !mapRef.current) return;

    // Initialize Mapbox map
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'; // This should be replaced with actual token
    
    if (map.current) {
      map.current.remove();
    }

    map.current = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [solarData.center.longitude, solarData.center.latitude],
      zoom: 19,
      pitch: 45,
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add a marker for the building
    new mapboxgl.Marker({ color: '#ff6b35' })
      .setLngLat([solarData.center.longitude, solarData.center.latitude])
      .addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [solarData]);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Metrics */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="card-premium p-6">
              <h3 className="font-heading font-semibold text-lg mb-4 text-foreground">
                Solar Configuration
              </h3>
              
              {/* Panel Count Display */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-accent mb-2">
                  {selectedPanels}
                </div>
                <div className="text-sm text-muted-foreground">Solar Panels</div>
              </div>

              {/* Panel Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newCount = Math.max(1, selectedPanels - 1);
                      handlePanelChange(newCount);
                    }}
                    disabled={selectedPanels <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newCount = Math.min(solarData.maxArrayPanelsCount, selectedPanels + 1);
                      handlePanelChange(newCount);
                    }}
                    disabled={selectedPanels >= solarData.maxArrayPanelsCount}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <Slider
                  value={[selectedPanels]}
                  onValueChange={(value) => handlePanelChange(value[0])}
                  max={solarData.maxArrayPanelsCount}
                  min={1}
                  step={1}
                  className="w-full"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>{solarData.maxArrayPanelsCount}</span>
                </div>
              </div>
            </Card>

            {/* Energy Output */}
            <Card className="card-premium p-6">
              <h4 className="font-semibold text-foreground mb-4">Energy Output</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Generation:</span>
                  <span className="font-semibold text-accent">
                    {currentConfig ? formatEnergy(currentConfig.yearlyEnergyDcKwh) : '0 kWh'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Panel Area:</span>
                  <span className="font-medium">
                    {formatNumber((selectedPanels / solarData.maxArrayPanelsCount) * solarData.maxArrayAreaMeters2)} m²
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sunshine Hours:</span>
                  <span className="font-medium">{formatNumber(solarData.maxSunshineHoursPerYear)} hrs/year</span>
                </div>
              </div>
            </Card>

            {/* Environmental Impact */}
            <Card className="card-premium p-6">
              <h4 className="font-semibold text-foreground mb-4">Environmental Impact</h4>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent mb-2">
                  {currentConfig ? formatNumber((currentConfig.yearlyEnergyDcKwh / 1000) * solarData.carbonOffsetFactorKgPerMwh) : 0} kg
                </div>
                <div className="text-sm text-muted-foreground">CO₂ offset per year</div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Map */}
          <div className="lg:col-span-2">
            <Card className="card-premium p-6 h-full">
              <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
                Solar Roof Analysis
              </h3>
              <div 
                ref={mapRef}
                className="w-full h-96 bg-secondary/20 rounded-lg overflow-hidden"
                style={{ minHeight: '500px' }}
              />
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Satellite view showing solar potential for: {address}
              </div>
            </Card>
          </div>
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