import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { MapPin, Zap, BarChart3, Home, Loader2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
interface SolarData {
  name?: string;
  center?: {
    latitude: number;
    longitude: number;
  };
  imageryDate?: {
    year: number;
    month: number;
    day: number;
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
  const [panelCapacity, setPanelCapacity] = useState(250); // Panel capacity in watts
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
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
      const { data, error } = await supabase.functions.invoke('google-solar-api', {
        body: { address }
      });

      if (error) {
        throw new Error(error.message || 'Failed to analyze solar potential');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Normalize Google Solar API response to our expected shape
      const potential = data.solarPotential || {};
      const normalized: SolarData = {
        name: data.name,
        center: data.center,
        imageryDate: data.imageryDate,
        maxArrayPanelsCount: potential.maxArrayPanelsCount ?? 0,
        maxArrayAreaMeters2: potential.maxArrayAreaMeters2 ?? 0,
        maxSunshineHoursPerYear: potential.maxSunshineHoursPerYear ?? 0,
        carbonOffsetFactorKgPerMwh: potential.carbonOffsetFactorKgPerMwh ?? 0,
        wholeRoofStats: potential.wholeRoofStats ?? { areaMeters2: 0, sunshineQuantiles: [], groundAreaMeters2: 0 },
        roofSegmentStats: potential.roofSegmentStats ?? [],
        solarPanelConfigs: potential.solarPanelConfigs ?? [],
        financialAnalyses: potential.financialAnalyses ?? [],
      };

      setSolarData(normalized);
      if (normalized.solarPanelConfigs && normalized.solarPanelConfigs.length > 0) {
        setSelectedPanels(normalized.solarPanelConfigs[0].panelsCount);
        setCurrentConfig(normalized.solarPanelConfigs[0]);
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

  // Initialize Google Maps
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    const initMap = async () => {
      try {
        // Load Google Maps API with API key from Supabase secrets
        const { data: apiKeyData, error: apiKeyError } = await supabase.functions.invoke('get-google-maps-key');
        
        if (apiKeyError || !apiKeyData?.apiKey) {
          console.error('Failed to get Google Maps API key:', apiKeyError);
          setError('Map configuration error. Please check your Google Maps API key.');
          return;
        }

        // Load Google Maps Script
        if (!(window as any).google) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&libraries=maps`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Initialize map
        const center = solarData?.center 
          ? { lat: solarData.center.latitude, lng: solarData.center.longitude }
          : { lat: 37.4220, lng: -122.0842 };

        map.current = new (window as any).google.maps.Map(container, {
          center,
          zoom: solarData ? 20 : 15,
          mapTypeId: 'satellite',
          tilt: 0,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        // Add marker at center
        if (solarData?.center) {
          new (window as any).google.maps.Marker({
            position: { lat: solarData.center.latitude, lng: solarData.center.longitude },
            map: map.current,
            title: 'Solar Analysis Location',
            icon: {
              path: (window as any).google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#ff6b35',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#ffffff',
            },
          });
        }

        // Draw roof segments if available with actual roof shapes
        if (solarData?.roofSegmentStats && solarData.roofSegmentStats.length > 0) {
          solarData.roofSegmentStats.forEach((segment, index) => {
            // Create a more accurate representation of the roof area
            // Use the center point and area to create a circular approximation
            const areaRadius = Math.sqrt(segment.stats.areaMeters2 / Math.PI) * 0.00001; // Convert to degrees approximately
            
            // Create a circle that better represents the actual roof area
            const roofArea = new (window as any).google.maps.Circle({
              center: { lat: segment.center.latitude, lng: segment.center.longitude },
              radius: Math.sqrt(segment.stats.areaMeters2), // Radius in meters
              map: map.current,
              fillColor: '#22c55e',
              fillOpacity: 0.4,
              strokeColor: '#16a34a',
              strokeOpacity: 0.9,
              strokeWeight: 3,
            });

            // Add info window for segment details
            const infoWindow = new (window as any).google.maps.InfoWindow({
              content: `
                <div style="font-size: 12px; color: #333;">
                  <strong>Roof Segment ${index + 1}</strong><br/>
                  Area: ${segment.stats.areaMeters2.toFixed(1)} m²<br/>
                  Pitch: ${segment.pitchDegrees.toFixed(1)}°<br/>
                  Azimuth: ${segment.azimuthDegrees.toFixed(1)}°<br/>
                  <em>Potential Solar Area</em>
                </div>
              `,
            });

            roofArea.addListener('click', () => {
              infoWindow.setPosition({ lat: segment.center.latitude, lng: segment.center.longitude });
              infoWindow.open(map.current);
            });
          });
        }

      } catch (error) {
        console.error('Map initialization failed:', error);
        setError('Failed to initialize Google Maps. Please check your API configuration.');
      }
    };

    initMap();
  }, [solarData]);
  return (
    <div className="w-full">
      {/* Single row layout with map and compact controls */}
      <div className="flex gap-4 mb-2">
        {/* Left Panel - Compact Solar Controls */}
        <div className="w-[340px] space-y-2">
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

          {/* Panel Capacity Control */}
          <Card className="card-premium p-3">
            <h4 className="font-semibold text-sm text-foreground mb-3">Panel capacity</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-border rounded-lg p-3">
                <Input 
                  type="number" 
                  value={panelCapacity} 
                  onChange={(e) => setPanelCapacity(Math.min(1000, Math.max(250, parseInt(e.target.value) || 250)))}
                  min="250"
                  max="1000"
                  className="border-0 bg-transparent text-2xl font-bold text-foreground text-center focus:ring-0 focus:outline-none"
                />
                <span className="text-muted-foreground font-medium ml-2">Watts</span>
              </div>
              <Slider 
                value={[panelCapacity]} 
                onValueChange={(value) => setPanelCapacity(value[0])} 
                max={1000} 
                min={250} 
                step={10} 
                className="w-full" 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>250W</span>
                <span>1000W</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Full Width Interactive Map */}
        <div className="flex-1">
          <Card className="card-premium p-2">
            <div ref={mapRef} className="w-full bg-secondary/20 rounded-lg overflow-hidden" style={{ height: '380px' }} />
          </Card>
        </div>
      </div>

      {/* Address Input Section - Directly below the map layout */}
      <Card className="card-premium p-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input type="text" placeholder="Enter property address (e.g., 1600 Amphitheatre Parkway, Mountain View, CA)" 
              value={address} onChange={e => setAddress(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()} className="w-full" />
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