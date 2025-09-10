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

    // Create exact Google Solar API demo layout with real interactive calculations
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
              overflow: hidden;
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
              box-shadow: 2px 0 12px rgba(0,0,0,0.15);
              z-index: 1000;
              position: relative;
            }
            
            .building-insights {
              padding: 20px;
              border-bottom: 1px solid #e8eaed;
            }
            
            .insights-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 20px;
              color: #5d6bb3;
              font-size: 16px;
              font-weight: 500;
            }
            
            .insight-item {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
            }
            
            .insight-icon {
              width: 24px;
              height: 24px;
              color: #5d6bb3;
              flex-shrink: 0;
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
              font-size: 18px;
              font-weight: 500;
              color: #202124;
            }
            
            /* Panel Controls - Interactive like Google demo */
            .panel-controls {
              padding: 20px;
              background: white;
              border-bottom: 1px solid #e8eaed;
            }
            
            .control-header {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 16px;
              font-size: 14px;
              font-weight: 500;
              color: #5f6368;
              text-align: center;
            }
            
            .panel-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 12px;
            }
            
            .panel-display {
              text-align: center;
            }
            
            .panel-count {
              font-size: 24px;
              font-weight: 500;
              color: #5d6bb3;
            }
            
            .max-count {
              font-size: 12px;
              color: #5f6368;
            }
            
            .yearly-energy {
              font-size: 20px;
              font-weight: 500;
              color: #202124;
              text-align: center;
            }
            
            /* Map Container - Full screen behind panels */
            .map-container {
              flex: 1;
              position: relative;
              background: #e5e5e5;
            }
            
            #map {
              width: 100%;
              height: 100%;
            }
            
            /* Right Panel - Controls overlay */
            .right-panel {
              width: 320px;
              background: white;
              box-shadow: -2px 0 12px rgba(0,0,0,0.15);
              overflow-y: auto;
              z-index: 1000;
              position: relative;
            }
            
            .search-section {
              padding: 20px;
              border-bottom: 1px solid #e8eaed;
            }
            
            .search-label {
              font-size: 14px;
              color: #5f6368;
              margin-bottom: 8px;
            }
            
            .search-input {
              width: 100%;
              padding: 12px;
              border: 1px solid #dadce0;
              border-radius: 4px;
              font-size: 14px;
            }
            
            .api-info {
              padding: 20px;
              border-bottom: 1px solid #e8eaed;
            }
            
            .api-title {
              color: #1a73e8;
              font-size: 14px;
              margin-bottom: 8px;
              text-decoration: underline;
            }
            
            .api-description {
              font-size: 13px;
              color: #5f6368;
              line-height: 1.5;
            }
            
            .solar-potential-section {
              padding: 20px;
            }
            
            .solar-controls {
              margin-top: 20px;
              padding: 20px;
              background: #f8f9ff;
              border-radius: 8px;
              border: 1px solid #e8eaed;
            }
            
            /* Minimal Google-style panel controls */
            .panels-section {
              margin-bottom: 16px;
            }
            
            .panels-label {
              display: flex;
              align-items: center;
              margin-bottom: 16px;
            }
            
            .panels-icon {
              width: 16px;
              height: 16px;
              margin-right: 8px;
              color: #7c3aed;
            }
            
            .panels-text {
              font-size: 14px;
              font-weight: 500;
              color: #202124;
            }
            
            .panels-count {
              font-weight: 600;
              color: #1a73e8;
              margin-left: 4px;
            }
            
            .panel-slider {
              width: 100%;
              height: 4px;
              border-radius: 2px;
              background: #e8eaed;
              outline: none;
              -webkit-appearance: none;
              margin: 16px 0;
              cursor: pointer;
            }
            
            .panel-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #7c3aed;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .watts-section {
              margin-top: 20px;
              position: relative;
            }
            
            .watts-label {
              font-size: 12px;
              color: #5f6368;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            
            .watts-input {
              width: 100%;
              padding: 12px 16px;
              padding-right: 50px;
              border: 1px solid #dadce0;
              border-radius: 8px;
              font-size: 14px;
              background: #f8f9fa;
              outline: none;
              transition: border-color 0.2s;
            }
            
            .watts-input:focus {
              border-color: #1a73e8;
              background: white;
            }
            
            .watts-suffix {
              position: absolute;
              right: 16px;
              top: 38px;
              color: #5f6368;
              font-size: 14px;
              pointer-events: none;
            }
            
            /* Solar potential legend - overlay on map */
            .solar-legend {
              position: absolute;
              bottom: 20px;
              left: 20px;
              background: rgba(255,255,255,0.95);
              padding: 12px 16px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              z-index: 500;
              display: flex;
              gap: 16px;
              align-items: center;
            }
            
            .legend-item {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
            }
            
            .legend-color {
              width: 16px;
              height: 16px;
              border-radius: 2px;
            }
            
            .high-potential { background: #ff1493; }
            .medium-potential { background: #9932cc; }
            .low-potential { background: #1e90ff; }
            
            /* Map controls */
            .map-controls {
              position: absolute;
              bottom: 20px;
              right: 20px;
              z-index: 500;
            }
            
            .zoom-controls {
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              overflow: hidden;
            }
            
            .zoom-btn {
              display: block;
              width: 40px;
              height: 40px;
              border: none;
              background: white;
              cursor: pointer;
              font-size: 18px;
              font-weight: bold;
              color: #5f6368;
            }
            
            .zoom-btn:hover {
              background: #f8f9fa;
            }
            
            .zoom-btn:not(:last-child) {
              border-bottom: 1px solid #e8eaed;
            }
          </style>
        </head>
        <body>
          <div class="main-container">
            <!-- Left Panel: Building Insights -->
            <div class="left-panel">
              <div class="building-insights">
                <div class="insights-header">
                  🏠 Building Insights endpoint
                </div>
                
                <div class="insight-item">
                  <div class="insight-icon">☀️</div>
                  <div class="insight-content">
                    <div class="insight-label">Annual sunshine</div>
                    <div class="insight-value" id="annual-sunshine">${Math.round(solarPotential.yearlyEnergyDcKwh / panel_count * 6) || 1800} hr</div>
                  </div>
                </div>
                
                <div class="insight-item">
                  <div class="insight-icon">🏠</div>
                  <div class="insight-content">
                    <div class="insight-label">Roof area</div>
                    <div class="insight-value" id="roof-area">${roof_area.toLocaleString()} m²</div>
                  </div>
                </div>
                
                <div class="insight-item">
                  <div class="insight-icon">🔋</div>
                  <div class="insight-content">
                    <div class="insight-label">Max panel count</div>
                    <div class="insight-value" id="max-panels">${actualSolarData.maxPanelCount} panels</div>
                  </div>
                </div>
                
                <div class="insight-item">
                  <div class="insight-icon">🌿</div>
                  <div class="insight-content">
                    <div class="insight-label">CO₂ savings</div>
                    <div class="insight-value" id="co2-savings">${Math.round(annual_kwh * 0.0004)} kg/MWh</div>
                  </div>
                </div>
              </div>
              
              <div class="panel-controls">
                <div class="control-header">
                  <div>Panels count</div>
                  <div>Yearly energy</div>
                </div>
                
                <div class="panel-row">
                  <div class="panel-display">
                    <div class="panel-count" id="current-panels">${panel_count}</div>
                    <div class="max-count">/ ${actualSolarData.maxPanelCount}</div>
                  </div>
                  <div class="yearly-energy" id="yearly-energy">${annual_kwh.toLocaleString()} kWh</div>
                </div>
              </div>
            </div>
            
            <!-- Map Container -->
            <div class="map-container">
              <div id="map"></div>
              
              <!-- Solar potential legend overlay -->
              <div class="solar-legend">
                <div class="legend-item">
                  <div class="legend-color high-potential"></div>
                  <span>High solar potential</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color medium-potential"></div>
                  <span>Medium potential</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color low-potential"></div>
                  <span>Low potential</span>
                </div>
              </div>
              
              <!-- Map zoom controls -->
              <div class="map-controls">
                <div class="zoom-controls">
                  <button class="zoom-btn" onclick="zoomIn()">+</button>
                  <button class="zoom-btn" onclick="zoomOut()">−</button>
                </div>
              </div>
            </div>
            
            <!-- Right Panel: API Controls -->
            <div class="right-panel">
              <div class="search-section">
                <div class="search-label">Search an address</div>
                <input type="text" class="search-input" value="${formattedAddress}" readonly>
              </div>
              
              <div class="solar-potential-section">
                <div class="solar-controls">
                  <div class="panels-section">
                    <div class="panels-label">
                      <svg class="panels-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                      <span class="panels-text">Panels count</span>
                      <span class="panels-count" id="slider-count">${panel_count} panels</span>
                    </div>
                    <input type="range" class="panel-slider" id="panel-count-slider" 
                           min="1" max="${actualSolarData.maxPanelCount}" value="${panel_count}"
                           oninput="updatePanelCount(this.value)">
                  </div>
                  
                  <div class="watts-section">
                    <div class="watts-label">Panel capacity</div>
                    <input type="number" class="watts-input" value="250" min="100" max="500" step="10">
                    <div class="watts-suffix">Watts</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            // Store the actual solar data for calculations
            const solarData = ${JSON.stringify(actualSolarData)};
            let currentPanelCount = ${panel_count};
            
            // Calculate energy based on panel count (real API calculations)
            function calculateEnergyFromPanels(panelCount) {
              // Use actual solar potential data for calculations
              const baseKwhPerPanel = solarData.baseAnnualKwh / solarData.basePanelCount;
              return Math.round(panelCount * baseKwhPerPanel);
            }
            
            // Update panel count and all related calculations
            function updatePanelCount(newCount) {
              currentPanelCount = parseInt(newCount);
              const yearlyEnergy = calculateEnergyFromPanels(currentPanelCount);
              const co2Savings = Math.round(yearlyEnergy * 0.0004);
              
              // Update all displays
              document.getElementById('current-panels').textContent = currentPanelCount;
              document.getElementById('slider-count').textContent = currentPanelCount + ' panels';
              document.getElementById('yearly-energy').textContent = yearlyEnergy.toLocaleString() + ' kWh';
              document.getElementById('co2-savings').textContent = co2Savings + ' kg/MWh';
              
              // Log the action for tracking
              console.info('Unknown action: adjust_panels', {
                panel_count: currentPanelCount,
                annual_kwh: yearlyEnergy
              });
            }
            
            // Initialize Google Maps
            function initMap() {
              const location = { lat: ${location.lat}, lng: ${location.lng} };
              
              const map = new google.maps.Map(document.getElementById('map'), {
                zoom: 20,
                center: location,
                mapTypeId: 'satellite',
                tilt: 0,
                gestureHandling: 'greedy',
                zoomControl: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
              });
              
              // Add realistic roof segmentation using Google Solar API data
              const roofSegments = ${JSON.stringify(roofSegments)};
              
              if (roofSegments && roofSegments.length > 0) {
                // Use actual roof segment data from Google Solar API
                roofSegments.forEach((segment, index) => {
                  if (segment.boundingBox) {
                    const bounds = segment.boundingBox;
                    const roofPath = [
                      { lat: bounds.sw.latitude, lng: bounds.sw.longitude },
                      { lat: bounds.sw.latitude, lng: bounds.ne.longitude },
                      { lat: bounds.ne.latitude, lng: bounds.ne.longitude },
                      { lat: bounds.ne.latitude, lng: bounds.sw.longitude }
                    ];
                    
                    // Color based on solar potential
                    let color = '#1e90ff'; // Low potential (blue)
                    let opacity = 0.5;
                    
                    if (segment.stats && segment.stats.sunshineQuantiles) {
                      const sunshine = segment.stats.sunshineQuantiles[5]; // Median sunshine
                      if (sunshine > 1800) {
                        color = '#ff1493'; // High potential (pink)
                        opacity = 0.7;
                      } else if (sunshine > 1400) {
                        color = '#9932cc'; // Medium potential (purple)
                        opacity = 0.6;
                      }
                    }
                    
                    new google.maps.Polygon({
                      paths: roofPath,
                      fillColor: color,
                      fillOpacity: opacity,
                      strokeColor: '#ffffff',
                      strokeOpacity: 0.9,
                      strokeWeight: 2,
                      map: map
                    });
                  }
                });
              } else {
                // Fallback: Create smaller, more realistic roof segments around the building
                const roofSections = [
                  // Main roof section (north-facing)
                  [
                    { lat: ${location.lat} + 0.00004, lng: ${location.lng} - 0.00008 },
                    { lat: ${location.lat} + 0.00004, lng: ${location.lng} + 0.00008 },
                    { lat: ${location.lat} + 0.00001, lng: ${location.lng} + 0.00008 },
                    { lat: ${location.lat} + 0.00001, lng: ${location.lng} - 0.00008 }
                  ],
                  // South-facing roof section (highest potential)
                  [
                    { lat: ${location.lat} - 0.00001, lng: ${location.lng} - 0.00008 },
                    { lat: ${location.lat} - 0.00001, lng: ${location.lng} + 0.00008 },
                    { lat: ${location.lat} - 0.00004, lng: ${location.lng} + 0.00008 },
                    { lat: ${location.lat} - 0.00004, lng: ${location.lng} - 0.00008 }
                  ],
                  // Side extension
                  [
                    { lat: ${location.lat} + 0.00002, lng: ${location.lng} + 0.00009 },
                    { lat: ${location.lat} + 0.00002, lng: ${location.lng} + 0.00013 },
                    { lat: ${location.lat} - 0.00002, lng: ${location.lng} + 0.00013 },
                    { lat: ${location.lat} - 0.00002, lng: ${location.lng} + 0.00009 }
                  ]
                ];
                
                // Create roof overlays with realistic solar potential colors
                roofSections.forEach((path, index) => {
                  const colors = ['#9932cc', '#ff1493', '#1e90ff']; // Medium, High, Low potential
                  const opacities = [0.6, 0.7, 0.5];
                  
                  new google.maps.Polygon({
                    paths: path,
                    fillColor: colors[index],
                    fillOpacity: opacities[index],
                    strokeColor: '#ffffff',
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    map: map
                  });
                });
              }
              
              window.mapInstance = map;
            }
            
            // Zoom controls
            function zoomIn() {
              if (window.mapInstance) {
                window.mapInstance.setZoom(window.mapInstance.getZoom() + 1);
              }
            }
            
            function zoomOut() {
              if (window.mapInstance) {
                window.mapInstance.setZoom(window.mapInstance.getZoom() - 1);
              }
            }
            
            // Initialize the demo
            document.addEventListener('DOMContentLoaded', function() {
              console.log('Solar analysis tool loaded successfully');
            });
          </script>
          
          <!-- Google Maps API -->
          <script async defer 
            src="https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap">
          </script>
        </body>
      </html>
    `)}`

    console.log('Solar data processed successfully:', summary);

    return new Response(JSON.stringify({
      status: 'success',
      data: summary,
      card: {
        type: "google_solar",
        title: "Interactive Solar Map",
        content: {
          embed_url: embedUrl,
          summary: summary,
          interactive: true
        },
        animation: "swoop-right"
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in solar-map function:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Failed to fetch solar data',
      card: {
        type: "error",
        title: "Error",
        content: { message: 'Failed to fetch solar data. Please try again.' },
        animation: "swoop-left"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});