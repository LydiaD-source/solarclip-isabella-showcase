import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_id, address, session_id } = await req.json();
    
    if (!address) {
      throw new Error('Address is required');
    }

    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    console.log(`Fetching solar data for address: ${address}, client: ${client_id}`);

    // First, geocode the address to get lat/lng coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    console.log(`Geocoding for address: ${address}`);
    
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      const errorText = await geocodeResponse.text();
      console.error('Geocoding API error status:', geocodeResponse.status);
      
      if (geocodeResponse.status === 403 || errorText.includes('REQUEST_DENIED')) {
        return new Response(JSON.stringify({
          status: 'error',
          message: "Sorry, I couldn't locate that address. Please try another.",
          card: {
            type: "error",
            title: "Solar Analysis Unavailable",
            content: { message: "Sorry, I couldn't locate that address. Please try another." },
            animation: "swoop-left"
          }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        status: 'error',
        message: "Sorry, I couldn't locate that address. Please try again.",
        card: {
          type: "error",
          title: "Address Not Found",
          content: { message: "Sorry, I couldn't locate that address. Please try again." },
          animation: "swoop-left"
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const geocodeData = await geocodeResponse.json();
    console.log('Geocoding response status:', geocodeData.status, 'Results:', geocodeData.results?.length || 0);
    
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('Geocoding failed:', geocodeData.status);
      
      if (geocodeData.status === 'REQUEST_DENIED') {
        return new Response(JSON.stringify({
          status: 'error',
          message: "Sorry, I couldn't locate that address. Please try another.",
          card: {
            type: "error",
            title: "Solar Analysis Unavailable",
            content: { message: "Sorry, I couldn't locate that address. Please try another." },
            animation: "swoop-left"
          }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        status: 'error',
        message: "Sorry, I couldn't locate that address. Please try again.",
        card: {
          type: "error",
          title: "Address Not Found",
          content: { message: "Sorry, I couldn't locate that address. Please try again." },
          animation: "swoop-left"
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const location = geocodeData.results[0].geometry.location;
    const formattedAddress = geocodeData.results[0].formatted_address;
    console.log(`Found location: ${formattedAddress} at ${location.lat}, ${location.lng}`);
    
    // Call Google Solar API with lat/lng coordinates
    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&key=${googleApiKey}`;
    console.log(`Calling Solar API for coordinates: ${location.lat}, ${location.lng}`);
    
    const response = await fetch(solarApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SolarClip/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Solar API error:', response.status, errorText);
      
      if (response.status === 404 || response.status === 403 || errorText.includes('REQUEST_DENIED')) {
        return new Response(JSON.stringify({
          status: 'error',
          message: "Sorry, I couldn't locate that address. Please try another.",
          card: {
            type: "error",
            title: "Solar Analysis Unavailable",
            content: { message: "Sorry, I couldn't locate that address. Please try another." },
            animation: "swoop-left"
          }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('Failed to fetch solar data');
    }

    const solarData = await response.json();
    console.log('Solar data received:', Object.keys(solarData));
    
    // Extract solar potential data with robust fallbacks
    const solarPotential = solarData.solarPotential || {};
    const roofSegmentStats = solarData.roofSegmentStats || solarPotential.roofSegmentStats || [];
    const buildingStats = (solarPotential as any).buildingStats || (solarData as any).buildingStats || {};
    
    // Process roof segments for polygon rendering using actual Google Solar API data
    let roof_segments = [];
    if (roofSegmentStats && roofSegmentStats.length > 0) {
      console.log(`Processing ${roofSegmentStats.length} roof segments from Google Solar API`);
      
      roof_segments = roofSegmentStats.map((segment: any, index: number) => {
        const stats = segment.stats || {};
        
        // Classify solar potential based on stats
        const classifyPotential = () => {
          if (stats.sunshineQuantiles && stats.sunshineQuantiles.length > 0) {
            const avgSunshine = stats.sunshineQuantiles.reduce((a: number, b: number) => a + b, 0) / stats.sunshineQuantiles.length;
            if (avgSunshine > 1700) return 'high';
            else if (avgSunshine < 1400) return 'low';
            else return 'medium';
          } else if (stats.azimuthDegrees !== undefined) {
            const azimuth = stats.azimuthDegrees;
            if (azimuth >= 135 && azimuth <= 225) return 'high';
            else if (azimuth >= 90 && azimuth <= 270) return 'medium';
            else return 'low';
          }
          return 'medium';
        };

        // Extract polygon coordinates from various possible paths
        let coordinates = [];
        
        // Try multiple polygon extraction paths
        const polygonSources = [
          segment.plane?.boundary?.vertices,
          segment.boundary?.vertices,
          segment.polygon?.vertices,
          segment.segments?.[0]?.polygon?.vertices
        ];
        
        for (const vertices of polygonSources) {
          if (vertices && Array.isArray(vertices) && vertices.length >= 3) {
            coordinates = vertices.map((v: any) => [
              v.longitude || v.lng || v.lon,
              v.latitude || v.lat
            ]).filter(([lng, lat]) => typeof lat === 'number' && typeof lng === 'number');
            
            if (coordinates.length >= 3) break;
          }
        }
        
        return {
          id: `segment_${index}`,
          coordinates,
          potential: classifyPotential(),
          area: stats.areaMeters2 || 50,
          panelsCount: stats.panelsCount || 0,
          yearlyEnergyDcKwh: stats.yearlyEnergyDcKwh || 0,
          azimuthDegrees: stats.azimuthDegrees || 180,
          tiltDegrees: stats.tiltDegrees || 30
        };
      }).filter(segment => segment.coordinates.length >= 3);
    }

    // Calculate energy data
    let monthly_kwh = [];
    let annual_kwh = 0;
    let panel_count = 20;
    let roof_area = 100;
    
    if (solarPotential.solarPanelConfigs && solarPotential.solarPanelConfigs.length > 0) {
      const bestConfig = solarPotential.solarPanelConfigs[0];
      panel_count = bestConfig.panelsCount || 20;
      annual_kwh = Math.round(bestConfig.yearlyEnergyDcKwh || 8000);
      
      if (solarPotential.monthlyFlux && solarPotential.monthlyFlux.length === 12) {
        const avgDailyKwh = annual_kwh / 365;
        monthly_kwh = solarPotential.monthlyFlux.map((flux: any, index: number) => {
          const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31][index];
          return Math.round(avgDailyKwh * daysInMonth * (flux / 1000));
        });
      }
    }
    
    if (monthly_kwh.length !== 12) {
      monthly_kwh = Array.from({ length: 12 }, (_, i) => {
        const baseMonthly = annual_kwh / 12;
        const seasonalVariation = Math.sin((i - 5) / 12 * 2 * Math.PI) * 0.3;
        return Math.round(baseMonthly * (1 + seasonalVariation));
      });
    }
    
    if (annual_kwh === 0) {
      annual_kwh = monthly_kwh.reduce((sum, month) => sum + month, 0);
    }
    
    if (solarData.boundingBox) {
      const bounds = solarData.boundingBox;
      roof_area = Math.round((bounds.ne.latitude - bounds.sw.latitude) * 
                            (bounds.ne.longitude - bounds.sw.longitude) * 111000 * 111000);
    }
    
    const summary = {
      annual_kwh,
      monthly_kwh,
      co2_saved: Math.round(annual_kwh * 0.0004),
      panel_count,
      roof_area,
      max_panels: solarPotential.wholeRoofStats?.panelsCount || panel_count * 2,
      address: formattedAddress,
      roof_segments
    };

    // Get actual API data for calculations
    const actualSolarData = {
      solarPotential: solarPotential,
      maxPanelCount: solarPotential.wholeRoofStats?.panelsCount || 300,
      panelConfigs: solarPotential.solarPanelConfigs || [],
      monthlyFlux: solarPotential.monthlyFlux || [],
      roofArea: roof_area,
      baseAnnualKwh: annual_kwh,
      basePanelCount: panel_count
    };

    // Create Google Solar API demo layout with pure Google Maps JavaScript API
    const embedUrl = `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
          <style>
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            
            body { 
              font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
              background: #f8f9fa;
              height: 100vh;
              overflow: hidden;
              animation: fadeIn 0.8s ease-out;
            }
            
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes slideInLeft {
              from { transform: translateX(-320px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes polygonFadeIn {
              from { opacity: 0; transform: scale(0.8); }
              to { opacity: 0.8; transform: scale(1); }
            }
            
            .main-container {
              display: flex;
              height: 100vh;
              position: relative;
            }
            
            /* Left Panel - Building Insights */
            .left-panel {
              width: 300px;
              background: white;
              display: flex;
              flex-direction: column;
              box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 0 40px rgba(93,107,179,0.08);
              z-index: 1000;
              position: relative;
              animation: slideInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }
            
            .building-insights {
              padding: 24px;
              border-bottom: 1px solid rgba(232,234,237,0.6);
              background: linear-gradient(135deg, #fff 0%, #f8f9ff 100%);
            }
            
            .insights-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 24px;
              color: #1a73e8;
              font-size: 16px;
              font-weight: 600;
              letter-spacing: -0.2px;
            }
            
            .insights-header::before {
              content: '🏠';
              font-size: 18px;
            }
            
            .insight-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 16px;
              padding: 12px;
              background: rgba(26,115,232,0.04);
              border-radius: 8px;
              border-left: 3px solid #1a73e8;
            }
            
            .insight-label {
              font-size: 14px;
              color: #5f6368;
              font-weight: 500;
            }
            
            .insight-value {
              font-size: 16px;
              font-weight: 600;
              color: #202124;
            }
            
            .energy-totals {
              padding: 24px;
              background: white;
            }
            
            .totals-header {
              color: #1a73e8;
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            
            .totals-header::before {
              content: '⚡';
              font-size: 16px;
            }
            
            .panel-control {
              margin-bottom: 24px;
            }
            
            .panel-label {
              font-size: 14px;
              color: #5f6368;
              margin-bottom: 12px;
              font-weight: 500;
            }
            
            .panel-slider-container {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            
            .panel-count-display {
              font-size: 18px;
              font-weight: 600;
              color: #1a73e8;
              min-width: 60px;
              text-align: center;
              padding: 8px 12px;
              background: #e8f0fe;
              border-radius: 6px;
            }
            
            .panel-slider {
              flex: 1;
              height: 6px;
              background: #e8eaed;
              border-radius: 3px;
              outline: none;
              appearance: none;
              cursor: pointer;
            }
            
            .panel-slider::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #1a73e8;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .panel-slider::-moz-range-thumb {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #1a73e8;
              cursor: pointer;
              border: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .total-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 16px;
              padding: 12px;
              background: rgba(52,168,83,0.04);
              border-radius: 8px;
              border-left: 3px solid #34a853;
            }
            
            .total-label {
              font-size: 14px;
              color: #5f6368;
              font-weight: 500;
            }
            
            .total-value {
              font-size: 16px;
              font-weight: 600;
              color: #202124;
            }
            
            /* Map Container */
            .map-container {
              flex: 1;
              position: relative;
              background: #e5e7eb;
            }
            
            #map {
              width: 100%;
              height: 100%;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
              .main-container {
                flex-direction: column;
              }
              
              .left-panel {
                width: 100%;
                height: auto;
                max-height: 50vh;
                overflow-y: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="main-container">
            <!-- Left Panel with Building Insights -->
            <div class="left-panel">
              <div class="building-insights">
                <div class="insights-header">Building Insights</div>
                <div class="insight-item">
                  <span class="insight-label">Address</span>
                  <span class="insight-value">${formattedAddress || 'Unknown'}</span>
                </div>
                <div class="insight-item">
                  <span class="insight-label">Roof Area</span>
                  <span class="insight-value">${roof_area} m²</span>
                </div>
                <div class="insight-item">
                  <span class="insight-label">Segments</span>
                  <span class="insight-value">${roof_segments.length}</span>
                </div>
              </div>
              
              <div class="energy-totals">
                <div class="totals-header">Energy Totals</div>
                
                <div class="panel-control">
                  <div class="panel-label">Solar Panels</div>
                  <div class="panel-slider-container">
                    <div class="panel-count-display" id="panelCount">${panel_count}</div>
                    <input 
                      type="range" 
                      class="panel-slider" 
                      id="panelSlider"
                      min="1" 
                      max="${actualSolarData.maxPanelCount}" 
                      value="${panel_count}"
                    />
                  </div>
                </div>
                
                <div class="total-item">
                  <span class="total-label">Annual kWh</span>
                  <span class="total-value" id="annualKwh">${annual_kwh.toLocaleString()}</span>
                </div>
                <div class="total-item">
                  <span class="total-label">Monthly kWh</span>
                  <span class="total-value" id="monthlyKwh">${Math.round(annual_kwh / 12).toLocaleString()}</span>
                </div>
                <div class="total-item">
                  <span class="total-label">CO₂ Saved</span>
                  <span class="total-value" id="co2Saved">${Math.round(annual_kwh * 0.0004).toLocaleString()} tons</span>
                </div>
              </div>
            </div>
            
            <!-- Map Container -->
            <div class="map-container">
              <div id="map"></div>
            </div>
          </div>

          <script async defer src="https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap&libraries=geometry"></script>
          
          <script>
            let map;
            let roofPolygons = [];
            const roofSegments = ${JSON.stringify(roof_segments)};
            const actualSolarData = ${JSON.stringify(actualSolarData)};
            
            // Panel slider functionality
            const panelSlider = document.getElementById('panelSlider');
            const panelCountDisplay = document.getElementById('panelCount');
            const annualKwhDisplay = document.getElementById('annualKwh');
            const monthlyKwhDisplay = document.getElementById('monthlyKwh');
            const co2SavedDisplay = document.getElementById('co2Saved');
            
            function updateEnergyCalculations(newPanelCount) {
              const ratio = newPanelCount / actualSolarData.basePanelCount;
              const newAnnualKwh = Math.round(actualSolarData.baseAnnualKwh * ratio);
              const newMonthlyKwh = Math.round(newAnnualKwh / 12);
              const newCo2Saved = Math.round(newAnnualKwh * 0.0004);
              
              panelCountDisplay.textContent = newPanelCount;
              annualKwhDisplay.textContent = newAnnualKwh.toLocaleString();
              monthlyKwhDisplay.textContent = newMonthlyKwh.toLocaleString();
              co2SavedDisplay.textContent = newCo2Saved.toLocaleString() + ' tons';
            }
            
            panelSlider.addEventListener('input', function() {
              updateEnergyCalculations(parseInt(this.value));
            });
            
            // Color mapping for solar potential
            function getPotentialColor(potential) {
              const colors = {
                'high': '#FF69B4',    // Pink for high potential
                'medium': '#9F7AEA',  // Purple for medium potential  
                'low': '#4299E1'      // Blue for low potential
              };
              return colors[potential] || colors['medium'];
            }
            
            function initMap() {
              try {
                // Calculate map bounds from roof segments
                let bounds = new google.maps.LatLngBounds();
                let hasValidSegments = false;
                
                roofSegments.forEach(segment => {
                  if (segment.coordinates && segment.coordinates.length > 0) {
                    segment.coordinates.forEach(coord => {
                      if (coord.length >= 2 && typeof coord[1] === 'number' && typeof coord[0] === 'number') {
                        bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
                        hasValidSegments = true;
                      }
                    });
                  }
                });
                
                // Default center if no valid segments
                const defaultCenter = hasValidSegments ? bounds.getCenter() : 
                  new google.maps.LatLng(${location.lat}, ${location.lng});
                
                // Initialize map
                map = new google.maps.Map(document.getElementById('map'), {
                  center: defaultCenter,
                  zoom: hasValidSegments ? 20 : 18,
                  mapTypeId: 'satellite',
                  tilt: 0,
                  heading: 0,
                  disableDefaultUI: false,
                  zoomControl: true,
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: true,
                  gestureHandling: 'greedy',
                  styles: [
                    {
                      featureType: "all",
                      elementType: "labels",
                      stylers: [{ visibility: "off" }]
                    }
                  ]
                });
                
                // Fit to bounds if we have valid segments
                if (hasValidSegments) {
                  map.fitBounds(bounds);
                  map.setZoom(Math.min(map.getZoom(), 20));
                }
                
                // Add roof polygons with staggered animation
                roofSegments.forEach((segment, index) => {
                  if (segment.coordinates && segment.coordinates.length >= 3) {
                    setTimeout(() => {
                      const polygonPath = segment.coordinates.map(coord => ({
                        lat: coord[1],
                        lng: coord[0]
                      }));
                      
                      const polygon = new google.maps.Polygon({
                        paths: polygonPath,
                        strokeColor: getPotentialColor(segment.potential),
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: getPotentialColor(segment.potential),
                        fillOpacity: 0,
                        map: map
                      });
                      
                      // Animate fill opacity
                      setTimeout(() => {
                        polygon.setOptions({ fillOpacity: 0.6 });
                      }, 100);
                      
                      roofPolygons.push(polygon);
                      
                      // Add click handler for segment info
                      polygon.addListener('click', () => {
                        const infoWindow = new google.maps.InfoWindow({
                          content: \`
                            <div style="padding: 8px; font-family: 'Google Sans', sans-serif;">
                              <div style="font-weight: 600; margin-bottom: 8px; color: #1a73e8;">Roof Segment</div>
                              <div style="margin-bottom: 4px;"><strong>Potential:</strong> \${segment.potential}</div>
                              <div style="margin-bottom: 4px;"><strong>Area:</strong> \${segment.area} m²</div>
                              <div style="margin-bottom: 4px;"><strong>Panels:</strong> \${segment.panelsCount || 0}</div>
                              <div><strong>Annual Energy:</strong> \${Math.round(segment.yearlyEnergyDcKwh || 0)} kWh</div>
                            </div>
                          \`,
                          position: polygon.getPath().getAt(0)
                        });
                        infoWindow.open(map);
                      });
                      
                      // Add hover effects
                      polygon.addListener('mouseover', () => {
                        polygon.setOptions({ fillOpacity: 0.8, strokeWeight: 3 });
                      });
                      
                      polygon.addListener('mouseout', () => {
                        polygon.setOptions({ fillOpacity: 0.6, strokeWeight: 2 });
                      });
                      
                    }, index * 200); // Staggered animation delay
                  }
                });
                
                console.log(\`Map initialized with \${roofSegments.length} roof segments\`);
                
              } catch (error) {
                console.error('Error initializing Google Maps:', error);
                document.getElementById('map').innerHTML = \`
                  <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f1f3f4; color: #5f6368; font-family: 'Google Sans', sans-serif;">
                    <div style="text-align: center;">
                      <div style="font-size: 18px; margin-bottom: 8px;">🗺️</div>
                      <div>Map loading...</div>
                    </div>
                  </div>
                \`;
              }
            }
            
            // Global error handler
            window.onerror = function(msg, url, line, col, error) {
              console.error('Global error:', msg, error);
              return false;
            };
            
            // Initialize on load if Google Maps is already loaded
            if (typeof google !== 'undefined' && google.maps) {
              initMap();
            }
          </script>
        </body>
      </html>
    `)}`;