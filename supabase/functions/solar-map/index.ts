import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for browser calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility: Safe parse of vertices from different Google Solar shapes
function parseVerts(verts: any[]): { lat: number; lng: number }[] {
  return (verts || [])
    .map((v: any) => ({
      lat: v?.latitude ?? v?.lat ?? v?.latLng?.latitude,
      lng: v?.longitude ?? v?.lng ?? v?.latLng?.longitude,
    }))
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
}

function classifyPotential(stats: any): "high" | "medium" | "low" {
  if (stats?.sunshineQuantiles?.length) {
    const avg = stats.sunshineQuantiles.reduce((a: number, b: number) => a + b, 0) / stats.sunshineQuantiles.length;
    if (avg > 1700) return "high";
    if (avg < 1400) return "low";
    return "medium";
  }
  const a = stats?.azimuthDegrees;
  if (typeof a === "number") {
    if (a >= 135 && a <= 225) return "high"; // roughly south facing
    if (a >= 90 && a <= 270) return "medium";
    return "low";
  }
  return "medium";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const address: string | undefined = body?.address;

    if (!address) {
      throw new Error("Address is required");
    }

    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("GOOGLE_SOLAR_API_KEY");
    if (!googleApiKey) throw new Error("Google Maps API key not configured");

    console.info("[solar-map] Geocoding address:", address);

    // 1) Geocoding to coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    if (!geocodeResponse.ok) throw new Error(`Geocoding failed: ${geocodeResponse.status}`);
    const geocodeData = await geocodeResponse.json();
    if (geocodeData.status !== "OK" || !geocodeData.results?.length) throw new Error("Address not found");

    const location = geocodeData.results[0].geometry.location;
    const formattedAddress = geocodeData.results[0].formatted_address;

    console.info("[solar-map] Geocoded:", formattedAddress, location);

    // 2) Google Solar API - Building Insights (closest)
    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&key=${googleApiKey}`;
    const solarRes = await fetch(solarApiUrl, { headers: { Accept: "application/json" } });
    if (!solarRes.ok) throw new Error(`Solar API error: ${solarRes.status}`);
    const solarData = await solarRes.json();

    const solarPotential = solarData.solarPotential || {};
    const roofSegmentStats: any[] = solarData.roofSegmentStats || solarPotential.roofSegmentStats || [];

    console.info(`[solar-map] Segments returned: ${roofSegmentStats.length}`);

    // 3) Extract REAL roof polygons - multiple sources and formats
    const roof_segments = (roofSegmentStats || [])
      .map((seg: any, i: number) => {
        const stats = seg?.stats || {};
        
        // Try multiple polygon sources in priority order
        const candidates = [
          seg?.plane?.boundary?.vertices,
          seg?.polygons?.[0]?.vertices,
          seg?.boundary?.vertices,
          seg?.polygon?.vertices,
          seg?.segments?.[0]?.polygon?.vertices,
          // Also try nested structures
          seg?.plane?.polygons?.[0]?.vertices,
          seg?.roofSegmentStats?.plane?.boundary?.vertices,
        ];
        
        let coords: { lat: number; lng: number }[] = [];
        for (const verts of candidates) {
          const parsed = parseVerts(verts);
          if (parsed.length >= 3) {
            coords = parsed;
            break;
          }
        }
        
        // Skip if no valid polygon found
        if (coords.length < 3) {
          console.log(`[solar-map] Segment ${i}: No valid polygon found`);
          return null;
        }
        
        console.log(`[solar-map] Segment ${i}: Found polygon with ${coords.length} points`);
        
        return {
          id: seg?.roofSegmentId || `segment_${i}`,
          coordinates: coords.map((p) => [p.lng, p.lat]), // store as [lng,lat]
          potential: classifyPotential(stats),
          area: stats.areaMeters2 || 0,
          panelsCount: stats.panelsCount || 0,
          yearlyEnergyDcKwh: Math.round(stats.yearlyEnergyDcKwh || 0),
          center: seg?.plane?.center ? {
            lat: seg.plane.center.latitude || seg.plane.center.lat,
            lng: seg.plane.center.longitude || seg.plane.center.lng
          } : null,
        };
      })
      .filter(Boolean);

    // 4) Energy summary (fallbacks when API has no configs)
    let panel_count = solarPotential.solarPanelConfigs?.[0]?.panelsCount || 20;
    let annual_kwh = Math.round(solarPotential.solarPanelConfigs?.[0]?.yearlyEnergyDcKwh || 8000);

    const monthly_kwh = Array.from({ length: 12 }, (_, i) => {
      const base = annual_kwh / 12;
      const season = Math.sin(((i - 5) / 12) * 2 * Math.PI) * 0.3; // smooth seasonality
      return Math.round(base * (1 + season));
    });

    const summary = {
      annual_kwh,
      monthly_kwh,
      co2_saved: Math.round(annual_kwh * 0.0004),
      panel_count,
      roof_area: solarPotential.wholeRoofStats?.areaMeters2 || 0,
      max_panels: solarPotential.wholeRoofStats?.panelsCount || 300,
      address: formattedAddress,
      roof_segments,
    };

    const actualSolarData = {
      baseAnnualKwh: annual_kwh,
      basePanelCount: panel_count,
      maxPanelCount: summary.max_panels,
    };

    // 5) Build enhanced Google-only embed with roof visualization and seasonal animation
    const embedHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        font-family: 'Google Sans', Roboto, system-ui, Segoe UI, sans-serif;
        background: #f8f9fa;
      }
      .main { display: flex; height: 100vh; max-height: 100svh; }
      .panel {
        width: 300px;
        background: #fff;
        box-shadow: 0 4px 20px rgba(0,0,0,.12);
        animation: slideIn .5s cubic-bezier(.16,1,.3,1);
      }
      .panel .sec { padding: 20px; border-bottom: 1px solid #eceff1; }
      .row { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; margin:10px 0; background:#e8f0fe; border-left:3px solid #1a73e8; border-radius:8px; }
      .tot { background:#eaf7ee; border-left-color:#34a853; }
      .label { font-size: 13px; color:#5f6368; }
      .value { font-weight: 600; color:#202124; }
      .slider { display:flex; gap:10px; align-items:center; }
      .slider input { flex:1; -webkit-appearance:none; appearance:none; height:6px; background:#e8eaed; border-radius:3px; outline:none; }
      .slider input::-webkit-slider-thumb { width:18px; height:18px; border-radius:50%; background:#1a73e8; -webkit-appearance:none; box-shadow:0 2px 4px rgba(0,0,0,.2); }
      .map { flex:1; min-width:0; position: relative; }
      #map { height: 100%; width: 100%; }
      @keyframes slideIn { from{ transform:translateX(-320px); opacity:0; } to { transform:translateX(0); opacity:1; } }
    </style>
  </head>
  <body>
    <div class="main">
      <div class="panel">
        <div class="sec">
          <div class="row"><span class="label">Address</span><span class="value">${formattedAddress}</span></div>
          <div class="row"><span class="label">Segments</span><span class="value">${roof_segments.length}</span></div>
        </div>
        <div class="sec">
          <div class="label" style="margin:6px 0 10px">Solar Panels</div>
          <div class="slider">
            <div id="panelCount" class="value" style="min-width:48px;text-align:center;background:#e8f0fe;padding:6px 10px;border-radius:6px">${panel_count}</div>
            <input id="panelSlider" type="range" min="1" max="${actualSolarData.maxPanelCount}" value="${panel_count}" />
          </div>
        </div>
        <div class="sec">
          <div class="row tot"><span class="label">Annual kWh</span><span id="annualKwh" class="value">${annual_kwh.toLocaleString()}</span></div>
          <div class="row tot"><span class="label">Monthly kWh</span><span id="monthlyKwh" class="value">${Math.round(annual_kwh/12).toLocaleString()}</span></div>
          <div class="row tot"><span class="label">CO₂ Saved</span><span id="co2Saved" class="value">${Math.round(annual_kwh*0.0004).toLocaleString()} tons</span></div>
        </div>
      </div>
      <div class="map"><div id="map"></div></div>
    </div>

    <script>
      // Expose globals for Google callback & UI updates
      window.roofSegments = ${JSON.stringify(roof_segments)};
      window.baseAnnual = ${actualSolarData.baseAnnualKwh};
      window.basePanels = ${actualSolarData.basePanelCount};
      window.allPolygons = [];
      window.animationId = null;

      // Enhanced seasonal color mapping (bright yellow to dark purple)
      window.getSeasonalColor = function(month, potential) {
        // Seasonal intensity: 0 = winter (dark), 1 = summer (bright)
        const intensity = 0.5 + 0.5 * Math.sin((month - 2) * Math.PI / 6);
        
        if (potential === 'high') {
          // Bright Yellow (summer) to Dark Red (winter)
          const r = Math.round(255);
          const g = Math.round(255 * (0.2 + 0.8 * intensity));
          const b = Math.round(30 * (1 - intensity));
          return \`rgb(\${r}, \${g}, \${b})\`;
        } else if (potential === 'medium') {
          // Orange (summer) to Purple (winter)  
          const r = Math.round(255 * (0.5 + 0.5 * intensity));
          const g = Math.round(140 * intensity);
          const b = Math.round(120 + 135 * (1 - intensity));
          return \`rgb(\${r}, \${g}, \${b})\`;
        } else {
          // Light Orange (summer) to Dark Purple (winter)
          const r = Math.round(150 + 105 * intensity);
          const g = Math.round(100 * intensity);
          const b = Math.round(180 + 75 * (1 - intensity));
          return \`rgb(\${r}, \${g}, \${b})\`;
        }
      };

      // Animate seasonal colors cycling through 12 months
      window.animateSeasons = function() {
        let month = 0;
        const animate = () => {
          window.allPolygons.forEach(polyData => {
            const color = window.getSeasonalColor(month, polyData.potential);
            polyData.polygon.setOptions({
              fillColor: color,
              strokeColor: color
            });
          });
          month = (month + 1) % 12;
          window.animationId = setTimeout(animate, 1200); // Change every 1.2 seconds
        };
        animate();
      };

      window.initMap = function(){
        const bounds = new google.maps.LatLngBounds();
        let hasSeg = false;
        
        // Calculate bounds from segments
        (window.roofSegments || []).forEach(s => {
          (s.coordinates || []).forEach(([lng, lat]) => {
            if (typeof lat === 'number' && typeof lng === 'number') {
              bounds.extend(new google.maps.LatLng(lat, lng));
              hasSeg = true;
            }
          });
        });

        const map = new google.maps.Map(document.getElementById('map'), {
          center: hasSeg ? bounds.getCenter() : {lat: ${location.lat}, lng: ${location.lng}},
          zoom: hasSeg ? 20 : 18,
          mapTypeId: 'satellite',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] }
          ]
        });

        if (hasSeg) {
          map.fitBounds(bounds);
          setTimeout(() => {
            map.setZoom(Math.min(map.getZoom(), 20));
          }, 100);
        }

        // Enhanced roof segment rendering with visibility
        console.log(`[Map] Rendering ${(window.roofSegments || []).length} roof segments`);
        
        (window.roofSegments || []).forEach((seg, i) => {
          if (!seg.coordinates || seg.coordinates.length < 3) {
            console.log(`[Map] Skipping segment ${i}: Invalid coordinates`);
            return;
          }
          
          console.log(`[Map] Rendering segment ${i} with ${seg.coordinates.length} points, potential: ${seg.potential}`);
          
          setTimeout(() => {
            const path = seg.coordinates.map(([lng, lat]) => ({ lat, lng }));
            const initialColor = window.getSeasonalColor(6, seg.potential); // Start with summer
            
            const polygon = new google.maps.Polygon({
              paths: path,
              strokeColor: initialColor,
              strokeOpacity: 0.95,
              strokeWeight: 3,
              fillColor: initialColor,
              fillOpacity: 0,
              map: map,
              zIndex: 1000
            });

            // Store polygon reference for animation
            window.allPolygons.push({
              polygon: polygon,
              potential: seg.potential,
              segmentId: seg.id
            });

            // Fade in effect with stronger opacity
            setTimeout(() => {
              polygon.setOptions({ fillOpacity: 0.8 });
            }, 300);

            // Enhanced hover effects
            polygon.addListener('mouseover', () => {
              polygon.setOptions({ 
                fillOpacity: 0.95, 
                strokeWeight: 4,
                zIndex: 2000
              });
            });
            
            polygon.addListener('mouseout', () => {
              polygon.setOptions({ 
                fillOpacity: 0.8, 
                strokeWeight: 3,
                zIndex: 1000
              });
            });

          }, i * 300); // Stagger segment appearance
        });

        // Start seasonal animation after all segments are loaded
        setTimeout(() => {
          console.log(`[Map] Starting seasonal animation for ${window.allPolygons.length} polygons`);
          if (window.allPolygons.length > 0) {
            window.animateSeasons();
          } else {
            console.log(`[Map] No polygons found for animation`);
          }
        }, (window.roofSegments || []).length * 300 + 1000);
      };

      // Panel slider updates
      window.update = function(n){
        const ratio = n / window.basePanels;
        const a = Math.round(window.baseAnnual * ratio);
        const m = Math.round(a / 12);
        const c = Math.round(a * 0.0004);
        
        const panelCountEl = document.getElementById('panelCount');
        const aEl = document.getElementById('annualKwh');
        const mEl = document.getElementById('monthlyKwh');
        const cEl = document.getElementById('co2Saved');
        
        if (panelCountEl) panelCountEl.textContent = String(n);
        if (aEl) aEl.textContent = a.toLocaleString();
        if (mEl) mEl.textContent = m.toLocaleString();
        if (cEl) cEl.textContent = c.toLocaleString() + ' tons';
      };
      
      window.updatePanelCount = window.update;

      window.addEventListener('load', function(){
        const slider = document.getElementById('panelSlider');
        if (slider) {
          slider.addEventListener('input', function(e) {
            window.update(parseInt(e.target.value, 10));
          });
        }
      });

      // Cleanup animation on page unload
      window.addEventListener('beforeunload', function() {
        if (window.animationId) {
          clearTimeout(window.animationId);
        }
      });
    </script>
    <script async defer src="https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap&libraries=geometry&loading=async"></script>
  </body>
</html>`;

    const embedUrl = `data:text/html;charset=utf-8,${encodeURIComponent(embedHtml)}`;

    const result = {
      status: "success",
      card: {
        type: "google_solar",
        title: "Your Roof Solar Potential",
        content: { embed_url: embedUrl, summary },
        animation: "swoop-left",
      },
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[solar-map] error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: (error as Error).message || "Failed to generate solar map",
        card: {
          type: "error",
          title: "Solar Map Error",
          content: { message: "We couldn't render the solar map for that address. Try another." },
          animation: "swoop-left",
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
