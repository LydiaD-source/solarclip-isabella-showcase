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

    // Create interactive Google Solar map with real satellite imagery and solar overlay
    const embedUrl = `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            #map { width: 100%; height: 400px; }
            .solar-controls { 
              position: absolute; 
              top: 10px; 
              right: 10px; 
              background: white; 
              padding: 15px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              z-index: 1000;
              min-width: 200px;
            }
            .panel-control { 
              display: flex; 
              align-items: center; 
              gap: 10px; 
              margin: 10px 0; 
            }
            .panel-control button { 
              background: #2563eb; 
              color: white; 
              border: none; 
              width: 30px; 
              height: 30px; 
              border-radius: 4px; 
              cursor: pointer; 
            }
            .panel-control button:hover { background: #1d4ed8; }
            .energy-display { 
              background: #f0f9ff; 
              padding: 10px; 
              border-radius: 6px; 
              margin-top: 10px; 
            }
            .roof-segment { 
              fill-opacity: 0.6; 
              stroke: #fff; 
              stroke-width: 2; 
            }
            .solar-panel { 
              fill: #1e40af; 
              stroke: #3b82f6; 
              stroke-width: 1; 
            }
          </style>
        </head>
        <body>
          <div class="solar-controls">
            <div style="font-weight: bold; margin-bottom: 10px;">${formattedAddress}</div>
            <div class="panel-control">
              <button onclick="adjustPanels(-1)">-</button>
              <span id="panel-count">${panel_count}</span>
              <button onclick="adjustPanels(1)">+</button>
              <span style="margin-left: 5px;">panels</span>
            </div>
            <div class="energy-display">
              <div style="font-weight: bold; color: #2563eb;" id="energy-output">${annual_kwh.toLocaleString()} kWh/year</div>
              <div style="font-size: 12px; color: #666; margin-top: 5px;" id="co2-savings">${Math.round(annual_kwh * 0.0004)} tons CO₂ saved</div>
            </div>
          </div>
          <div id="map"></div>
          
          <script>
            let currentPanels = ${panel_count};
            const maxPanels = ${summary.max_panels};
            const baseEnergyPerPanel = ${Math.round(annual_kwh / panel_count)};
            
            function adjustPanels(change) {
              const newCount = Math.max(1, Math.min(maxPanels, currentPanels + change));
              if (newCount !== currentPanels) {
                currentPanels = newCount;
                updateDisplay();
                updatePanelsOnMap();
              }
            }
            
            function updateDisplay() {
              document.getElementById('panel-count').textContent = currentPanels;
              const newEnergy = currentPanels * baseEnergyPerPanel;
              document.getElementById('energy-output').textContent = newEnergy.toLocaleString() + ' kWh/year';
              document.getElementById('co2-savings').textContent = Math.round(newEnergy * 0.0004) + ' tons CO₂ saved';
            }
            
            function initMap() {
              const map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: ${location.lat}, lng: ${location.lng} },
                zoom: 21,
                mapTypeId: 'satellite',
                tilt: 45,
                heading: 0,
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true
              });
              
              // Add building outline if available from solar data
              ${solarData.boundingBox ? `
              const buildingBounds = new google.maps.Rectangle({
                bounds: {
                  north: ${solarData.boundingBox.ne.latitude},
                  south: ${solarData.boundingBox.sw.latitude},
                  east: ${solarData.boundingBox.ne.longitude},
                  west: ${solarData.boundingBox.sw.longitude}
                },
                strokeColor: '#FF6B35',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                fillColor: '#FF6B35',
                fillOpacity: 0.2,
                map: map
              });
              ` : ''}
              
              // Add solar panels visualization
              window.solarPanels = [];
              updatePanelsOnMap();
            }
            
            function updatePanelsOnMap() {
              // Clear existing panels
              window.solarPanels.forEach(panel => panel.setMap(null));
              window.solarPanels = [];
              
              // Add new panels in a grid pattern
              const centerLat = ${location.lat};
              const centerLng = ${location.lng};
              const panelSpacing = 0.00001; // Approximate spacing between panels
              
              const cols = Math.ceil(Math.sqrt(currentPanels));
              const rows = Math.ceil(currentPanels / cols);
              
              for (let i = 0; i < currentPanels; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const panelLat = centerLat + (row - rows/2) * panelSpacing;
                const panelLng = centerLng + (col - cols/2) * panelSpacing;
                
                const panel = new google.maps.Rectangle({
                  bounds: {
                    north: panelLat + panelSpacing/3,
                    south: panelLat - panelSpacing/3,
                    east: panelLng + panelSpacing/2,
                    west: panelLng - panelSpacing/2
                  },
                  strokeColor: '#1e40af',
                  strokeOpacity: 1,
                  strokeWeight: 1,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.8,
                  map: window.map || new google.maps.Map(document.getElementById('map'))
                });
                
                window.solarPanels.push(panel);
              }
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
      embed_url: customMapUrl,
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
          embed_url: customMapUrl,
          interactive: true,
          sunroof_url: embedUrl
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