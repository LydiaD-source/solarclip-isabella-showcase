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
      
      // Check for specific API permission errors
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
    
    // Handle common geocoding failure modes gracefully
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('Geocoding failed:', geocodeData.status);
      
      // Handle REQUEST_DENIED specifically
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
      
      // Handle API errors gracefully
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
    const roofSegments = solarData.roofSegmentStats || [];
    
    // Calculate energy data with improved extraction
    let monthly_kwh = [];
    let annual_kwh = 0;
    let panel_count = 20;
    let roof_area = 100;
    
    if (solarPotential.solarPanelConfigs && solarPotential.solarPanelConfigs.length > 0) {
      // Use the best panel configuration
      const bestConfig = solarPotential.solarPanelConfigs[0];
      panel_count = bestConfig.panelsCount || 20;
      annual_kwh = Math.round(bestConfig.yearlyEnergyDcKwh || 8000);
      
      // Extract monthly data if available
      if (solarPotential.monthlyFlux && solarPotential.monthlyFlux.length === 12) {
        const avgDailyKwh = annual_kwh / 365;
        monthly_kwh = solarPotential.monthlyFlux.map((flux: any, index: number) => {
          const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31][index];
          return Math.round(avgDailyKwh * daysInMonth * (flux / 1000));
        });
      }
    }
    
    // Fallback calculations if API data is incomplete
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
    
    // Extract roof area from building insights
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
      address: formattedAddress
    };

    // Create full Google Solar API experience with Building Insights and solar potential visualization
    const embedUrl = `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Google Sans', 'Roboto', Arial, sans-serif; 
              background: #f8f9fa;
              height: 100vh;
              display: flex;
            }
            
            .sidebar {
              width: 300px;
              background: white;
              padding: 20px;
              overflow-y: auto;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              z-index: 1000;
            }
            
            .building-insights {
              background: white;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              border: 1px solid #e8eaed;
            }
            
            .insights-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 16px;
              color: #5f6368;
              font-size: 14px;
              font-weight: 500;
            }
            
            .insights-grid {
              display: grid;
              gap: 16px;
            }
            
            .insight-item {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            
            .insight-icon {
              width: 20px;
              height: 20px;
              color: #4285f4;
            }
            
            .insight-content {
              flex: 1;
            }
            
            .insight-label {
              font-size: 14px;
              color: #5f6368;
              margin-bottom: 2px;
            }
            
            .insight-value {
              font-size: 16px;
              font-weight: 500;
              color: #202124;
            }
            
            .panel-controls {
              background: white;
              border-radius: 12px;
              padding: 20px;
              border: 1px solid #e8eaed;
            }
            
            .control-section {
              margin-bottom: 24px;
            }
            
            .control-header {
              font-size: 16px;
              font-weight: 500;
              color: #202124;
              margin-bottom: 16px;
            }
            
            .panel-adjustment {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 20px;
              margin-bottom: 16px;
            }
            
            .adjust-btn {
              background: #4285f4;
              color: white;
              border: none;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              cursor: pointer;
              font-size: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .adjust-btn:hover {
              background: #3367d6;
            }
            
            .panel-count {
              font-size: 24px;
              font-weight: 500;
              color: #202124;
              min-width: 60px;
              text-align: center;
            }
            
            .max-panels {
              text-align: center;
              font-size: 12px;
              color: #5f6368;
            }
            
            .energy-output {
              text-align: center;
              padding: 16px;
              background: #f8f9fa;
              border-radius: 8px;
              margin-bottom: 16px;
            }
            
            .energy-value {
              font-size: 20px;
              font-weight: 500;
              color: #4285f4;
              margin-bottom: 4px;
            }
            
            .co2-savings {
              font-size: 14px;
              color: #5f6368;
            }
            
            .slider-container {
              margin: 16px 0;
            }
            
            .slider {
              width: 100%;
              height: 6px;
              border-radius: 3px;
              background: #e8eaed;
              outline: none;
              -webkit-appearance: none;
            }
            
            .slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #4285f4;
              cursor: pointer;
            }
            
            .map-container {
              flex: 1;
              position: relative;
            }
            
            #map { 
              width: 100%; 
              height: 100%; 
            }
            
            .map-overlay {
              position: absolute;
              top: 20px;
              right: 20px;
              background: white;
              padding: 12px 16px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              z-index: 1000;
              font-size: 14px;
              font-weight: 500;
            }
            
            .solar-potential-overlay {
              position: absolute;
              bottom: 20px;
              left: 20px;
              background: rgba(255,255,255,0.95);
              padding: 16px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              z-index: 1000;
            }
            
            .potential-legend {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 12px;
              color: #5f6368;
            }
            
            .legend-item {
              display: flex;
              align-items: center;
              gap: 4px;
            }
            
            .legend-color {
              width: 16px;
              height: 16px;
              border-radius: 2px;
            }
          </style>
        </head>
        <body>
          <div class="sidebar">
            <div class="building-insights">
              <div class="insights-header">
                🏠 Building Insights endpoint
              </div>
              <div class="insights-grid">
                <div class="insight-item">
                  <div class="insight-content">
                    <div class="insight-label">Annual sunshine</div>
                    <div class="insight-value">${Math.round(annual_kwh / 4.5)} hr</div>
                  </div>
                </div>
                <div class="insight-item">
                  <div class="insight-content">
                    <div class="insight-label">Roof area</div>
                    <div class="insight-value">${roof_area.toLocaleString()} m²</div>
                  </div>
                </div>
                <div class="insight-item">
                  <div class="insight-content">
                    <div class="insight-label">Max panel count</div>
                    <div class="insight-value">${summary.max_panels.toLocaleString()} panels</div>
                  </div>
                </div>
                <div class="insight-item">
                  <div class="insight-content">
                    <div class="insight-label">CO₂ savings</div>
                    <div class="insight-value">${Math.round(annual_kwh * 0.0004 * summary.max_panels / panel_count)} kg/MWh</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="panel-controls">
              <div class="control-section">
                <div class="control-header">Panels count</div>
                <div class="panel-adjustment">
                  <button class="adjust-btn" onclick="adjustPanels(-1)">−</button>
                  <div class="panel-count" id="panel-count">${panel_count}</div>
                  <button class="adjust-btn" onclick="adjustPanels(1)">+</button>
                </div>
                <div class="max-panels">/ ${summary.max_panels.toLocaleString()}</div>
                <div class="slider-container">
                  <input type="range" min="1" max="${summary.max_panels}" value="${panel_count}" class="slider" id="panel-slider" oninput="setPanels(this.value)">
                </div>
              </div>
              
              <div class="control-section">
                <div class="control-header">Yearly energy</div>
                <div class="energy-output">
                  <div class="energy-value" id="energy-output">${annual_kwh.toLocaleString()} kWh</div>
                  <div class="co2-savings" id="co2-savings">${Math.round(annual_kwh * 0.0004)} tons CO₂ saved</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="map-container">
            <div class="map-overlay">
              ${formattedAddress}
            </div>
            <div id="map"></div>
            <div class="solar-potential-overlay">
              <div class="potential-legend">
                <div class="legend-item">
                  <div class="legend-color" style="background: #ff0080;"></div>
                  <span>High solar potential</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color" style="background: #8000ff;"></div>
                  <span>Medium potential</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color" style="background: #0080ff;"></div>
                  <span>Low potential</span>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            let currentPanels = ${panel_count};
            const maxPanels = ${summary.max_panels};
            const baseEnergyPerPanel = ${Math.round(annual_kwh / panel_count)};
            let map;
            let solarPanels = [];
            let solarPotentialLayer;
            
            function adjustPanels(change) {
              const newCount = Math.max(1, Math.min(maxPanels, currentPanels + change));
              if (newCount !== currentPanels) {
                currentPanels = newCount;
                updateDisplay();
                updatePanelsOnMap();
                document.getElementById('panel-slider').value = currentPanels;
              }
            }
            
            function setPanels(count) {
              currentPanels = parseInt(count);
              updateDisplay();
              updatePanelsOnMap();
            }
            
            function updateDisplay() {
              document.getElementById('panel-count').textContent = currentPanels;
              const newEnergy = currentPanels * baseEnergyPerPanel;
              document.getElementById('energy-output').textContent = newEnergy.toLocaleString() + ' kWh';
              document.getElementById('co2-savings').textContent = Math.round(newEnergy * 0.0004) + ' tons CO₂ saved';
            }
            
            function initMap() {
              map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: ${location.lat}, lng: ${location.lng} },
                zoom: 21,
                mapTypeId: 'satellite',
                tilt: 0,
                heading: 0,
                disableDefaultUI: true,
                zoomControl: true,
                fullscreenControl: true,
                styles: [
                  {
                    featureType: 'all',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                  }
                ]
              });
              
              // Add solar potential heat map overlay
              addSolarPotentialOverlay();
              
              // Add building outline
              ${solarData.boundingBox ? `
              const buildingBounds = new google.maps.Rectangle({
                bounds: {
                  north: ${solarData.boundingBox.ne.latitude},
                  south: ${solarData.boundingBox.sw.latitude},
                  east: ${solarData.boundingBox.ne.longitude},
                  west: ${solarData.boundingBox.sw.longitude}
                },
                strokeColor: '#ff6b35',
                strokeOpacity: 1,
                strokeWeight: 2,
                fillOpacity: 0,
                map: map
              });
              ` : ''}
              
              updatePanelsOnMap();
            }
            
            function addSolarPotentialOverlay() {
              // Create solar potential heat map using building bounds
              ${solarData.boundingBox ? `
              const bounds = {
                north: ${solarData.boundingBox.ne.latitude},
                south: ${solarData.boundingBox.sw.latitude},
                east: ${solarData.boundingBox.ne.longitude},
                west: ${solarData.boundingBox.sw.longitude}
              };
              
              // Create multiple rectangles to simulate solar potential zones
              const zones = [
                { bounds: bounds, color: '#ff0080', opacity: 0.6, potential: 'high' },
                { 
                  bounds: {
                    north: bounds.north - (bounds.north - bounds.south) * 0.3,
                    south: bounds.south + (bounds.north - bounds.south) * 0.3,
                    east: bounds.east - (bounds.east - bounds.west) * 0.2,
                    west: bounds.west + (bounds.east - bounds.west) * 0.2
                  }, 
                  color: '#8000ff', 
                  opacity: 0.5, 
                  potential: 'medium' 
                }
              ];
              
              zones.forEach(zone => {
                new google.maps.Rectangle({
                  bounds: zone.bounds,
                  strokeOpacity: 0,
                  fillColor: zone.color,
                  fillOpacity: zone.opacity,
                  map: map
                });
              });
              ` : ''}
            }
            
            function updatePanelsOnMap() {
              // Clear existing panels
              solarPanels.forEach(panel => panel.setMap(null));
              solarPanels = [];
              
              ${solarData.boundingBox ? `
              const bounds = {
                north: ${solarData.boundingBox.ne.latitude},
                south: ${solarData.boundingBox.sw.latitude},
                east: ${solarData.boundingBox.ne.longitude},
                west: ${solarData.boundingBox.sw.longitude}
              };
              
              const panelWidth = (bounds.east - bounds.west) * 0.8 / Math.ceil(Math.sqrt(currentPanels));
              const panelHeight = (bounds.north - bounds.south) * 0.8 / Math.ceil(Math.sqrt(currentPanels));
              
              const cols = Math.ceil(Math.sqrt(currentPanels));
              const rows = Math.ceil(currentPanels / cols);
              
              const startLat = bounds.south + (bounds.north - bounds.south) * 0.1;
              const startLng = bounds.west + (bounds.east - bounds.west) * 0.1;
              
              for (let i = 0; i < currentPanels; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const panelLat = startLat + row * panelHeight;
                const panelLng = startLng + col * panelWidth;
                
                const panel = new google.maps.Rectangle({
                  bounds: {
                    north: panelLat + panelHeight * 0.8,
                    south: panelLat,
                    east: panelLng + panelWidth * 0.8,
                    west: panelLng
                  },
                  strokeColor: '#1e40af',
                  strokeOpacity: 1,
                  strokeWeight: 1,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.8,
                  map: map
                });
                
                solarPanels.push(panel);
              }
              ` : ''}
            }
            
            // Initialize map when Google Maps API is loaded
            if (typeof google !== 'undefined') {
              initMap();
            } else {
              window.initMap = initMap;
            }
          </script>
          <script src="https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap&libraries=geometry"></script>
        </body>
      </html>
    `)}`;

    const response_data = {
      status: 'success',
      embed_url: embedUrl,
      annual_kwh: summary.annual_kwh,
      monthly_kwh: summary.monthly_kwh,
      panel_count: summary.panel_count,
      summary: summary,
      title: `Solar Analysis: ${summary.address}`,
      raw_data: solarData,
      card: {
        type: "google_solar",
        title: `Solar Analysis: ${summary.address}`,
        content: {
          summary: summary,
          embed_url: embedUrl,
          interactive: true
        },
        animation: "swoop-left"
      }
    };

    console.log('Solar data processed successfully:', summary);

    return new Response(JSON.stringify(response_data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in solar-map function:', error);
    const message = (error as Error)?.message || 'Unknown error';
    const isAddressError = message.includes('Address not found') || message.toLowerCase().includes('geocode');
    const status = isAddressError ? 404 : 500;
    const friendly = isAddressError
      ? "Sorry, I couldn't locate that address. Please try again."
      : "I couldn't retrieve solar data right now. Please try again later.";

    return new Response(JSON.stringify({ 
      status: 'error',
      error: isAddressError ? 'address_not_found' : 'server_error',
      message: friendly,
      card: {
        type: "error",
        title: isAddressError ? "Address Not Found" : "Solar Analysis Unavailable",
        content: { message: friendly },
        animation: "swoop-left"
      }
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});