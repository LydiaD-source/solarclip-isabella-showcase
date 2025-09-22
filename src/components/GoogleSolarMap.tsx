import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { MapPin, Zap, BarChart3, Home, Loader2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
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

      // Normalize Google Solar API response to our expected shape
      const potential = data.solarPotential || {};
      const normalized: SolarData = {
        name: data.name,
        center: data.center,
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

  // Initialize map
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    let instance: mapboxgl.Map | null = null;
    let destroyed = false;

    const init = async () => {
      try {
        // Get Mapbox token from Supabase Edge Function (falls back to demo token)
        const { data: tokenData } = await supabase.functions.invoke('mapbox-token');
        const fallbackToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
        mapboxgl.accessToken = tokenData?.token || fallbackToken;

        // Compute center
        const defaultCenter: [number, number] = solarData?.center
          ? [solarData.center.longitude, solarData.center.latitude]
          : [-122.0842, 37.4220];

        // Safely destroy any previous instance
        if (map.current) {
          try { map.current.remove(); } catch (err) { console.warn('Map remove error:', err); } finally { map.current = null; }
        }

        if (destroyed) return;
        instance = new mapboxgl.Map({
          container,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: defaultCenter,
          zoom: solarData ? 19 : 15,
          pitch: 0,
          bearing: 0,
        });

        map.current = instance;
        instance.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add marker at center
        if (solarData?.center) {
          new mapboxgl.Marker({ color: '#ff6b35' })
            .setLngLat([solarData.center.longitude, solarData.center.latitude])
            .addTo(instance);
        }

        // Draw roof overlays when style is ready
        instance.on('load', () => {
          try {
            const segments = solarData?.roofSegmentStats || [];
            const features: GeoJSON.Feature<GeoJSON.Polygon>[] = segments.map((seg, idx) => {
              const { sw, ne } = seg.boundingBox;
              const nw = { latitude: ne.latitude, longitude: sw.longitude };
              const se = { latitude: sw.latitude, longitude: ne.longitude };
              const ring: [number, number][] = [
                [sw.longitude, sw.latitude],
                [se.longitude, se.latitude],
                [ne.longitude, ne.latitude],
                [nw.longitude, nw.latitude],
                [sw.longitude, sw.latitude],
              ];
              return {
                type: 'Feature',
                properties: { index: idx, pitch: seg.pitchDegrees, azimuth: seg.azimuthDegrees, area: seg.stats.areaMeters2 },
                geometry: { type: 'Polygon', coordinates: [ring] },
              };
            });

            if (features.length === 0) return;

            const sourceId = 'roof-segments';
            const data = { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection<GeoJSON.Polygon>;

            if (instance.getSource(sourceId)) {
              (instance.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
            } else {
              instance.addSource(sourceId, { type: 'geojson', data });

              if (!instance.getLayer('roof-fill')) {
                instance.addLayer({ id: 'roof-fill', type: 'fill', source: sourceId, paint: { 'fill-color': 'rgba(34,197,94,0.28)', 'fill-outline-color': 'rgba(34,197,94,0.8)' } });
              }
              if (!instance.getLayer('roof-outline')) {
                instance.addLayer({ id: 'roof-outline', type: 'line', source: sourceId, paint: { 'line-color': 'rgba(16,94,47,0.9)', 'line-width': 1.5 } });
              }
            }

            // Fit to overlays
            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
            for (const f of features) {
              for (const [lng, lat] of f.geometry.coordinates[0]) {
                if (lng < minLng) minLng = lng;
                if (lat < minLat) minLat = lat;
                if (lng > maxLng) maxLng = lng;
                if (lat > maxLat) maxLat = lat;
              }
            }
            if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
              instance.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 28, maxZoom: 19 });
            }
          } catch (e) {
            console.warn('Failed to render roof overlays:', e);
          }
        });
      } catch (e) {
        console.error('Map init failed:', e);
      }
    };

    init();

    return () => {
      destroyed = true;
      if (instance) {
        try { instance.remove(); } catch (err) { console.warn('Error removing map instance:', err); } finally { if (map.current === instance) map.current = null; }
      }
    };
  }, [solarData?.center?.latitude, solarData?.center?.longitude]);
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
        </div>

        {/* Right Panel - Full Width Interactive Map */}
        <div className="flex-1">
          <Card className="card-premium p-2">
            <div ref={mapRef} className="w-full bg-secondary/20 rounded-lg overflow-hidden" style={{ height: '376px' }} />
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