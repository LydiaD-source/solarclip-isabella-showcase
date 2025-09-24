import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { MapPin, Zap, BarChart3, Home, Loader2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fromUrl as geotiffFromUrl, fromArrayBuffer as geotiffFromArrayBuffer } from 'geotiff';
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
  dataLayers?: {
    roofLayerUrls?: string[];
    solarPotentialUrls?: string[];
    imageryDate?: any;
    imageryProcessedDate?: any;
    dsmUrl?: string;
    rgbUrl?: string;
    maskUrl?: string;
    annualFluxUrl?: string;
    monthlyFluxUrl?: string;
    hourlyShadeUrls?: string[];
  };
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
        dataLayers: data.dataLayers ?? undefined,
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
        if (!(window as any).google?.maps) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&v=weekly&loading=async`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
          await new Promise((resolve) => { script.onload = resolve; });
        }

        // Initialize map
        const center = solarData?.center 
          ? { lat: solarData.center.latitude, lng: solarData.center.longitude }
          : { lat: 37.4220, lng: -122.0842 };

        if (!map.current) {
          map.current = new (window as any).google.maps.Map(container, {
            center,
            zoom: solarData ? 20 : 15,
            mapTypeId: 'hybrid',
            tilt: 0,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          });
        } else {
          try {
            map.current.setMapTypeId('hybrid');
            map.current.setCenter(center);
            map.current.setZoom(solarData ? 20 : 15);
          } catch {}
        }

        // Debug when tiles are actually loaded
        (window as any).google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
          console.info('Google Map tiles loaded');
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

        let overlayRendered = false;
        // Precise roof segmentation using Google Solar API mask (GeoTIFF) rendered to canvas
        if (solarData?.dataLayers?.maskUrl) {
          console.log('Rendering precise roof mask via proxy:', solarData.dataLayers.maskUrl);
          try {
            const { data: proxyData, error: proxyErr } = await supabase.functions.invoke('fetch-solar-asset', {
              body: { url: solarData.dataLayers.maskUrl },
            });
            if (proxyErr || !proxyData?.base64) {
              console.error('fetch-solar-asset failed', proxyErr || proxyData);
            } else {
              // Decode base64 to ArrayBuffer
              const byteString = atob(proxyData.base64);
              const len = byteString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = byteString.charCodeAt(i);

              const tiff = await geotiffFromArrayBuffer(bytes.buffer);
              const image = await tiff.getImage();
              const bbox = image.getBoundingBox(); // [west, south, east, north]
              const width = image.getWidth();
              const height = image.getHeight();
              const raster: any = await image.readRasters({ interleave: true, samples: [0] });

              console.info('Mask GeoTIFF info', { bbox, width, height, sampleMin: Math.min(...raster.slice(0, 1000)), sampleMax: Math.max(...raster.slice(0, 1000)) });

              // Draw mask onto a canvas (brand accent color)
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              let drawn = 0;
              if (ctx) {
                const imgData = ctx.createImageData(width, height);
                const dataArr = imgData.data;
                for (let i = 0; i < width * height; i++) {
                  const v = raster[i];
                  if (v > 0) {
                    const idx = i * 4;
                    dataArr[idx] = 59;      // R
                    dataArr[idx + 1] = 130; // G
                    dataArr[idx + 2] = 246; // B
                    dataArr[idx + 3] = 130; // A (0-255)
                    drawn++;
                  }
                }
                if (drawn > 0) ctx.putImageData(imgData, 0, 0);
              }

              // Position canvas on map via OverlayView using GeoTIFF bounds
              const bounds = new (window as any).google.maps.LatLngBounds(
                { lat: bbox[1], lng: bbox[0] },
                { lat: bbox[3], lng: bbox[2] }
              );

              // Ensure the mask bounds are visible
              try { (map.current as any).fitBounds(bounds); } catch {}

              // Draw a thin debug rectangle to verify bounds (temporary aid)
              new (window as any).google.maps.Rectangle({
                bounds,
                map: map.current,
                strokeColor: '#00FFFF',
                strokeOpacity: 0.5,
                strokeWeight: 1,
                fillOpacity: 0,
              });

              class CanvasOverlay extends (window as any).google.maps.OverlayView {
                private div: HTMLDivElement;
                constructor() {
                  super();
                  this.div = document.createElement('div');
                  this.div.style.position = 'absolute';
                  this.div.style.pointerEvents = 'none';
                }
                onAdd() {
                  const panes = (this as any).getPanes();
                  this.div.appendChild(canvas);
                  // Use overlayImage pane so it stacks like GroundOverlay
                  panes.overlayImage.appendChild(this.div);
                }
                draw() {
                  const projection = (this as any).getProjection();
                  const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
                  const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
                  this.div.style.left = `${sw.x}px`;
                  this.div.style.top = `${ne.y}px`;
                  const w = ne.x - sw.x;
                  const h = sw.y - ne.y;
                  this.div.style.width = `${w}px`;
                  this.div.style.height = `${h}px`;
                  this.div.style.zIndex = '3';
                  canvas.style.width = `${w}px`;
                  canvas.style.height = `${h}px`;
                }
                onRemove() {
                  this.div.parentNode?.removeChild(this.div);
                }
              }

              if (typeof drawn !== 'undefined' && drawn > 0) {
                const overlay = new CanvasOverlay();
                overlay.setMap(map.current);
                overlayRendered = true;

                // Fallback: also add a GroundOverlay using the canvas image
                try {
                  const url = canvas.toDataURL('image/png');
                  const ground = new (window as any).google.maps.GroundOverlay(url, bounds, { opacity: 0.6 });
                  ground.setMap(map.current);
                } catch (e) {
                  console.warn('GroundOverlay fallback failed', e);
                }
              }
            }
          } catch (e) {
            console.error('Failed to render mask overlay', e);
          }
        }

        // Fallback: draw roof bounding boxes if mask overlay is unavailable
        if (!overlayRendered && solarData?.roofSegmentStats?.length) {
          try {
            const boundsUnion = new (window as any).google.maps.LatLngBounds();
            solarData.roofSegmentStats.forEach((seg: any) => {
              const sw = seg.boundingBox?.sw;
              const ne = seg.boundingBox?.ne;
              if (!sw || !ne) return;
              const path = [
                { lat: sw.latitude, lng: sw.longitude },
                { lat: sw.latitude, lng: ne.longitude },
                { lat: ne.latitude, lng: ne.longitude },
                { lat: ne.latitude, lng: sw.longitude },
              ];
              const poly = new (window as any).google.maps.Polygon({
                paths: path,
                strokeColor: '#3B82F6',
                strokeOpacity: 0.8,
                strokeWeight: 1,
                fillColor: '#3B82F6',
                fillOpacity: 0.18,
                map: map.current,
                zIndex: 2,
              });
              path.forEach(p => boundsUnion.extend(new (window as any).google.maps.LatLng(p.lat, p.lng)));
            });
            try { (map.current as any).fitBounds(boundsUnion); } catch {}
          } catch (e) {
            console.warn('Fallback polygons failed', e);
          }
        }

        // RGB overlay omitted for performance.

        // Bounding-box polygons removed in favor of precise segmentation mask overlay.

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

          {/* Panel Capacity - Compact */}
          <Card className="card-premium p-3">
            <h4 className="font-semibold text-sm text-foreground mb-2">Panel capacity</h4>
            <div className="space-y-2">
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{panelCapacity}</div>
                <div className="text-xs text-muted-foreground">Watts</div>
              </div>
              <Slider 
                value={[panelCapacity]} 
                onValueChange={value => setPanelCapacity(value[0])} 
                max={1000} 
                min={250} 
                step={10} 
                className="w-full" 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>250</span>
                <span>1000</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Map with Address Input */}
        <div className="flex-1 space-y-2">
          {/* Address Input - Above map */}
          <Card className="card-premium p-3">
            <div className="flex gap-4">
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
          
          {/* Map */}
          <Card className="card-premium p-2">
            <div ref={mapRef} className="w-full h-[380px] bg-secondary/20 rounded-lg overflow-hidden" />
          </Card>
        </div>
      </div>

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