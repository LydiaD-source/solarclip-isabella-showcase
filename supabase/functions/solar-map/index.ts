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
    const roofSegments = solarData.roofSegmentStats || [];
    
    // Calculate energy data with improved extraction
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
      address: formattedAddress
    };

    // Create exact Google Solar API demo layout with Building Insights and interactive controls
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
            
            /* Left Panel - Building Insights */
            .left-panel {
              width: 280px;
              background: white;
              display: flex;
              flex-direction: column;
              box-shadow: 2px 0 8px rgba(0,0,0,0.1);
              z-index: 1000;
            }
            
            .building-insights {
              padding: 16px;
              border-bottom: 1px solid #e8eaed;
            }
            
            .insights-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 16px;
              color: #5d6bb3;
              font-size: 16px;
              font-weight: 500;
            }
            
            .insight-item {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
            }
            
            .insight-icon {
              width: 20px;
              height: 20px;
              color: #5d6bb3;
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
            
            /* Panel Controls */
            .panel-controls {
              padding: 16px;
              background: white;
              border-bottom: 1px solid #e8eaed;
            }
            
            .control-header {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 12px;
              font-size: 14px;
              font-weight: 500;
              color: #5f6368;
            }
            
            .panel-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 8px;
            }
            
            .panel-label {
              font-size: 20px;
              text-align: center;
            }
            
            .panel-value {
              font-size: 16px;
              font-weight: 500;
              color: #202124;
              text-align: center;
            }
            
            /* Main Map Area */
            .map-container {
              flex: 1;
              position: relative;
              background: #e5e5e5;
            }
            
            #map {
              width: 100%;
              height: 100%;
            }
            
            /* Right Panel */
            .right-panel {
              width: 300px;
              background: white;
              box-shadow: -2px 0 8px rgba(0,0,0,0.1);
              overflow-y: auto;
              z-index: 1000;
            }
            
            .search-section {
              padding: 16px;
              border-bottom: 1px solid #e8eaed;
            }
            
            .search-input {
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #dadce0;
              border-radius: 4px;
              font-size: 14px;
            }
            
            .api-info {
              padding: 16px;
              border-bottom: 1px solid #e8eaed;
            }
            
            .api-title {
              color: #1a73e8;
              font-size: 14px;
              margin-bottom: 8px;
              text-decoration: underline;
            }
            
            .api-description {
              font-size: 12px;
              color: #5f6368;
              line-height: 1.4;
            }
            
            .endpoints-section {
              padding: 16px;
            }
            
            .endpoint-item {
              margin-bottom: 16px;
              cursor: pointer;
              padding: 12px;
              border: 1px solid #e8eaed;
              border-radius: 8px;
              transition: all 0.2s;
            }
            
            .endpoint-item:hover {
              border-color: #5d6bb3;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .endpoint-item.active {
              border-color: #5d6bb3;
              background: #f8f9ff;
            }
            
            .endpoint-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 4px;
            }
            
            .endpoint-icon {
              width: 16px;
              height: 16px;
              color: #5d6bb3;
            }
            
            .endpoint-title {
              font-size: 14px;
              font-weight: 500;
              color: #5d6bb3;
            }
            
            .endpoint-subtitle {
              font-size: 12px;
              color: #5f6368;
            }
            
            .endpoint-controls {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #e8eaed;
            }
            
            .panel-slider-container {
              margin: 8px 0;
            }
            
            .slider-label {
              font-size: 12px;
              color: #5f6368;
              margin-bottom: 4px;
            }
            
            .panel-slider {
              width: 100%;
              height: 4px;
              border-radius: 2px;
              background: #e8eaed;
              outline: none;
              -webkit-appearance: none;
            }
            
            .panel-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #5d6bb3;
              cursor: pointer;
            }
            
            .panel-capacity-input {
              width: 100%;
              padding: 6px 8px;
              border: 1px solid #dadce0;
              border-radius: 4px;
              font-size: 12px;
              margin: 8px 0;
            }
            
            .toggle-container {
              display: flex;
              align-items: center;
              gap: 8px;
              margin: 8px 0;
            }
            
            .toggle-switch {
              width: 32px;
              height: 16px;
              background: #5d6bb3;
              border-radius: 8px;
              position: relative;
              cursor: pointer;
            }
            
            .toggle-switch::after {
              content: '';
              position: absolute;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: white;
              top: 2px;
              right: 2px;
              transition: all 0.2s;
            }
            
            .toggle-label {
              font-size: 12px;
              color: #202124;
            }
            
            .api-response-btn {
              background: #e8eaff;
              color: #5d6bb3;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              margin-top: 8px;
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
          <!-- Left Panel - Building Insights -->
          <div class="left-panel">
            <div class="building-insights">
              <div class="insights-header">
                🏠 Building Insights endpoint
              </div>
              <div class="insight-item">
                ☀️
                <div class="insight-content">
                  <div class="insight-label">Annual sunshine</div>
                  <div class="insight-value">${Math.round(annual_kwh / 4.5)} hr</div>
                </div>
              </div>
              <div class="insight-item">
                📐
                <div class="insight-content">
                  <div class="insight-label">Roof area</div>
                  <div class="insight-value">${roof_area.toLocaleString()} m²</div>
                </div>
              </div>
              <div class="insight-item">
                🔲
                <div class="insight-content">
                  <div class="insight-label">Max panel count</div>
                  <div class="insight-value">${summary.max_panels.toLocaleString()} panels</div>
                </div>
              </div>
              <div class="insight-item">
                🌿
                <div class="insight-content">
                  <div class="insight-label">CO₂ savings</div>
                  <div class="insight-value">${Math.round(annual_kwh * 0.0004 * summary.max_panels / panel_count)} kg/MWh</div>
                </div>
              </div>
            </div>
            
            <div class="panel-controls">
              <div class="control-header">
                <div>Panels count</div>
                <div>Yearly energy</div>
              </div>
              <div class="panel-row">
                <div class="panel-label">🔲</div>
                <div class="panel-label">⚡</div>
              </div>
              <div class="panel-row">
                <div class="panel-value" id="panel-count">${panel_count} / ${summary.max_panels.toLocaleString()}</div>
                <div class="panel-value" id="energy-output">${(annual_kwh/1000).toFixed(1)} kWh</div>
              </div>
            </div>
          </div>
          
          <!-- Map Container -->
          <div class="map-container">
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
          
          <!-- Right Panel -->
          <div class="right-panel">
            <div class="search-section">
              <input type="text" class="search-input" placeholder="Search an address" value="${formattedAddress}" readonly>
            </div>
            
            <div class="api-info">
              <div class="api-title">Two distinct endpoints of the Solar API</div>
              <div class="api-description">offer many benefits to solar marketplace websites, solar installers, and solar SaaS designers.</div>
              <br>
              <div class="api-description">Click on an area below to see what type of information the Solar API can provide.</div>
            </div>
            
            <div class="endpoints-section">
              <div class="endpoint-item active">
                <div class="endpoint-header">
                  <div class="endpoint-icon">🏠</div>
                  <div>
                    <div class="endpoint-title">Building Insights endpoint</div>
                    <div class="endpoint-subtitle">Yearly energy: ${(annual_kwh/1000).toFixed(1)} MWh</div>
                  </div>
                </div>
                <div class="endpoint-controls">
                  <div class="slider-label">Panels count</div>
                  <div class="panel-slider-container">
                    <input type="range" min="1" max="${summary.max_panels}" value="${panel_count}" class="panel-slider" id="main-panel-slider" oninput="setPanels(this.value)">
                  </div>
                  <div class="panel-value" id="panels-display">${panel_count} panels</div>
                  
                  <div class="slider-label">Panel capacity</div>
                  <input type="text" class="panel-capacity-input" value="250" readonly>
                  <div style="text-align: right; font-size: 11px; color: #5f6368;">Watts</div>
                  
                  <div class="toggle-container">
                    <div class="toggle-switch"></div>
                    <div class="toggle-label">Solar panels</div>
                  </div>
                  
                  <button class="api-response-btn">API response</button>
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-header">
                  <div class="endpoint-icon">💎</div>
                  <div>
                    <div class="endpoint-title">Data Layers endpoint</div>
                    <div class="endpoint-subtitle">Monthly sunshine</div>
                  </div>
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-header">
                  <div class="endpoint-icon">📊</div>
                  <div>
                    <div class="endpoint-title">Solar Potential analysis</div>
                    <div class="endpoint-subtitle">Values are only placeholders.</div>
                  </div>
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
            
            function setPanels(count) {
              currentPanels = parseInt(count);
              updateDisplay();
              updatePanelsOnMap();
            }
            
            function updateDisplay() {
              document.getElementById('panel-count').textContent = currentPanels + ' / ' + maxPanels.toLocaleString();
              document.getElementById('panels-display').textContent = currentPanels + ' panels';
              const newEnergy = currentPanels * baseEnergyPerPanel;
              document.getElementById('energy-output').textContent = (newEnergy/1000).toFixed(1) + ' kWh';
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
              
              addSolarPotentialOverlay();
              updatePanelsOnMap();
            }
            
            function addSolarPotentialOverlay() {
              ${solarData.boundingBox ? `
              const bounds = {
                north: ${solarData.boundingBox.ne.latitude},
                south: ${solarData.boundingBox.sw.latitude},
                east: ${solarData.boundingBox.ne.longitude},
                west: ${solarData.boundingBox.sw.longitude}
              };
              
              // Create infrared-style solar potential visualization
              const zones = [
                { bounds: bounds, color: '#ff0080', opacity: 0.7, potential: 'high' },
                { 
                  bounds: {
                    north: bounds.north - (bounds.north - bounds.south) * 0.2,
                    south: bounds.south + (bounds.north - bounds.south) * 0.2,
                    east: bounds.east - (bounds.east - bounds.west) * 0.2,
                    west: bounds.west + (bounds.east - bounds.west) * 0.2
                  }, 
                  color: '#8000ff', 
                  opacity: 0.6, 
                  potential: 'medium' 
                },
                { 
                  bounds: {
                    north: bounds.north - (bounds.north - bounds.south) * 0.4,
                    south: bounds.south + (bounds.north - bounds.south) * 0.4,
                    east: bounds.east - (bounds.east - bounds.west) * 0.4,
                    west: bounds.west + (bounds.east - bounds.west) * 0.4
                  }, 
                  color: '#0080ff', 
                  opacity: 0.4, 
                  potential: 'low' 
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
              
              // Add building outline
              new google.maps.Rectangle({
                bounds: bounds,
                strokeColor: '#ffffff',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillOpacity: 0,
                map: map
              });
              ` : ''}
            }
            
            function updatePanelsOnMap() {
              solarPanels.forEach(panel => panel.setMap(null));
              solarPanels = [];
              
              ${solarData.boundingBox ? `
              const bounds = {
                north: ${solarData.boundingBox.ne.latitude},
                south: ${solarData.boundingBox.sw.latitude},
                east: ${solarData.boundingBox.ne.longitude},
                west: ${solarData.boundingBox.sw.longitude}
              };
              
              const panelWidth = (bounds.east - bounds.west) * 0.6 / Math.ceil(Math.sqrt(currentPanels));
              const panelHeight = (bounds.north - bounds.south) * 0.6 / Math.ceil(Math.sqrt(currentPanels));
              
              const cols = Math.ceil(Math.sqrt(currentPanels));
              const rows = Math.ceil(currentPanels / cols);
              
              const startLat = bounds.south + (bounds.north - bounds.south) * 0.2;
              const startLng = bounds.west + (bounds.east - bounds.west) * 0.2;
              
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
                  fillOpacity: 0.9,
                  map: map
                });
                
                solarPanels.push(panel);
              }
              ` : ''}
            }
            
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