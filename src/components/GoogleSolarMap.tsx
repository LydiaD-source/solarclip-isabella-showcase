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
      sw: {
        latitude: number;
        longitude: number;
      };
      ne: {
        latitude: number;
        longitude: number;
      };
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
  const [selectedPanels, setSelectedPanels] = useState(20); // Default value
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
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);

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
        description: "Solar potential analysis completed successfully"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze solar potential';
      setError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive"
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
    setSelectedPanels(panelCount);
    if (solarData && solarData.solarPanelConfigs) {
      const config = solarData.solarPanelConfigs.find(c => c.panelsCount === panelCount) || solarData.solarPanelConfigs[0];
      setCurrentConfig(config);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Use a public Mapbox token for demo
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

    if (map.current) {
      map.current.remove();
    }

    // Default to Mountain View, CA or use solar data location
    const defaultCenter: [number, number] = solarData?.center 
      ? [solarData.center.longitude, solarData.center.latitude]
      : [-122.0842, 37.4220]; // Mountain View, CA

    try {
      map.current = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
        center: defaultCenter,
        zoom: solarData ? 19 : 15,
        pitch: 0,
        bearing: 0
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add marker if we have solar data
      if (solarData?.center) {
        new mapboxgl.Marker({ color: '#ff6b35' })
          .setLngLat([solarData.center.longitude, solarData.center.latitude])
          .addTo(map.current);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        try {
          map.current.remove();
        } catch (error) {
          console.error('Error removing map:', error);
        }
      }
    };
  }, [solarData]);
  return (
    <div className="w-full">
      {/* Single row layout with map and compact controls */}
      <div className="flex gap-4 mb-2">
        {/* Left Panel - Compact Solar Controls */}
        <div className="w-80 space-y-2">
          {/* Solar Configuration - Compact */}
          <Card className="card-premium p-2">
            <h3 className="font-semibold text-xs mb-1 text-foreground">Solar Configuration</h3>
            
            {/* Panel Count Display */}
            <div className="text-center mb-1">
              <div className="text-xl font-bold text-accent">{selectedPanels}</div>
              <div className="text-xs text-muted-foreground">Solar Panels</div>
            </div>

            {/* Compact Panel Controls */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => {
                  const newCount = Math.max(1, selectedPanels - 1);
                  handlePanelChange(newCount);
                }} disabled={selectedPanels <= 1}>
                  <Minus className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const maxPanels = solarData?.maxArrayPanelsCount || 50;
                  const newCount = Math.min(maxPanels, selectedPanels + 1);
                  handlePanelChange(newCount);
                }} disabled={solarData && selectedPanels >= solarData.maxArrayPanelsCount}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              <Slider value={[selectedPanels]} onValueChange={value => handlePanelChange(value[0])} 
                max={solarData?.maxArrayPanelsCount || 50} min={1} step={1} className="w-full" />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>{solarData?.maxArrayPanelsCount || 50}</span>
              </div>
            </div>
          </Card>

          {/* Energy Output - Compact */}
          <Card className="card-premium p-3">
            <h4 className="font-semibold text-sm text-foreground mb-2">Energy Output</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual:</span>
                <span className="font-semibold text-accent">
                  {currentConfig ? formatEnergy(currentConfig.yearlyEnergyDcKwh) : formatEnergy(selectedPanels * 400)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Area:</span>
                <span className="font-medium">
                  {solarData ? formatNumber(selectedPanels / solarData.maxArrayPanelsCount * solarData.maxArrayAreaMeters2) : formatNumber(selectedPanels * 2)} m²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sunshine:</span>
                <span className="font-medium">
                  {solarData ? formatNumber(solarData.maxSunshineHoursPerYear) : '2,500'} hrs/yr
                </span>
              </div>
            </div>
          </Card>

          {/* Environmental Impact - Compact */}
          <Card className="card-premium p-3">
            <h4 className="font-semibold text-sm text-foreground mb-2">Environmental Impact</h4>
            <div className="text-center">
              <div className="text-lg font-bold text-accent mb-1">
                {currentConfig ? formatNumber(currentConfig.yearlyEnergyDcKwh / 1000 * (solarData?.carbonOffsetFactorKgPerMwh || 400)) : formatNumber(selectedPanels * 160)} kg
              </div>
              <div className="text-xs text-muted-foreground">CO₂ offset per year</div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Full Width Interactive Map */}
        <div className="flex-1">
          <Card className="card-premium p-2">
            <div ref={mapRef} className="w-full bg-secondary/20 rounded-lg overflow-hidden" style={{ height: '360px' }} />
          </Card>
        </div>
      </div>

      {/* Address Input Section - Directly below the map layout */}
      <Card className="card-premium p-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input type="text" placeholder="Enter property address (e.g., 1600 Amphitheatre Parkway, Mountain View, CA)" 
              value={address} onChange={e => setAddress(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && handleAnalyze()} className="w-full" />
          </div>
          <Button onClick={handleAnalyze} disabled={isLoading} className="btn-hero min-w-[140px]">
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
          <Card key={index} className="card-premium p-6 text-center">
            <feature.icon className="w-8 h-8 text-accent mx-auto mb-3" />
            <p className="text-foreground font-medium">{feature.text}</p>
          </Card>
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
    </div>
  );
};