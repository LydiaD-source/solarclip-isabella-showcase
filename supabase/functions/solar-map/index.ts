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
    // Support both POST (JSON body) and GET (query params)
    const url = new URL(req.url);
    const isEmbed = url.searchParams.get('embed') === '1' || url.searchParams.get('format') === 'html';
    const origin = `${url.protocol}//${url.host}`;

    const body = await req.json().catch(() => ({}));
    const q = new URL(req.url).searchParams;
    const qAddress = q.get('address') || undefined;
    const latParam = q.get('lat');
    const lngParam = q.get('lng');
    const address: string | undefined = req.method === 'GET' ? qAddress : (body?.address);

    // Debug: verify env var injection for Google keys
    const GOOGLE_SOLAR_KEY = Deno.env.get("GOOGLE_SOLAR_API_KEY");
    const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    console.log("[solar-map] GOOGLE_SOLAR_KEY length:", GOOGLE_SOLAR_KEY?.length);
    console.log("[solar-map] GOOGLE_MAPS_KEY length:", GOOGLE_MAPS_KEY?.length);

    const googleApiKey = GOOGLE_MAPS_KEY || GOOGLE_SOLAR_KEY;
    if (!GOOGLE_SOLAR_KEY) throw new Error("GOOGLE_SOLAR_API_KEY not configured");
    if (!googleApiKey) throw new Error("Google Maps/Solar API key not configured");

    let location: { lat: number; lng: number };
    let formattedAddress: string | undefined = address;
    let viewport: any = null;

    // Support direct lat/lng testing (bypass geocoding)
    if (latParam && lngParam && !isNaN(parseFloat(latParam)) && !isNaN(parseFloat(lngParam))) {
      location = { lat: parseFloat(latParam), lng: parseFloat(lngParam) };
      formattedAddress = formattedAddress || `${location.lat}, ${location.lng}`;
      console.info("[solar-map] Using provided lat/lng:", location);
    } else {
      if (!address) {
        throw new Error("Address is required");
      }

      console.info("[solar-map] Geocoding address:", address);

      // 1) Geocoding to coordinates
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      if (!geocodeResponse.ok) throw new Error(`Geocoding failed: ${geocodeResponse.status}`);
      const geocodeData = await geocodeResponse.json();
      if (geocodeData.status !== "OK" || !geocodeData.results?.length) throw new Error("Address not found");

      location = geocodeData.results[0].geometry.location;
      formattedAddress = geocodeData.results[0].formatted_address;
      viewport = geocodeData.results[0].geometry.viewport || null;

      console.info("[solar-map] Geocoded:", formattedAddress, location, viewport ? "with viewport" : "no viewport");
    }

    // 2) Google Solar API - Building Insights (closest)
    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&key=${googleApiKey}`;
    const solarRes = await fetch(solarApiUrl, { headers: { Accept: "application/json" } });
    if (!solarRes.ok) throw new Error(`Solar API error: ${solarRes.status}`);
    const solarData = await solarRes.json();

    const solarPotential = solarData.solarPotential || {};
    const roofSegmentStats: any[] = solarPotential.roofSegmentStats || [];

    console.info(`[solar-map] Segments returned: ${roofSegmentStats.length}`);
    if (roofSegmentStats.length) {
      try {
        const sample = roofSegmentStats[0] || {};
        console.info('[solar-map] Sample segment keys:', Object.keys(sample));
        console.info('[solar-map] Sample boundingBox:', JSON.stringify(sample?.boundingBox || null));
        console.info('[solar-map] Sample center:', JSON.stringify(sample?.center || null));
        console.info('[solar-map] Note: Building Insights roofSegmentStats do not include polygon geometry; only stats, center, and boundingBox are returned.');
      } catch (_) {}
    }

    // 3) Extract REAL roof polygons - multiple sources and formats
    let roof_segments = (roofSegmentStats || [])
      .map((seg: any, i: number) => {
        const stats = seg?.stats || {};

        // Debug: log available geometry fields for this segment
        const hasPlaneBoundary = !!seg?.plane?.boundary?.vertices?.length;
        const hasPolygons = Array.isArray(seg?.polygons) && seg.polygons.length > 0;
        const hasBoundary = !!seg?.boundary?.vertices?.length;
        const hasPolygon = !!seg?.polygon?.vertices?.length;
        console.info(`[solar-map] Segment ${i} geometry flags => plane.boundary: ${hasPlaneBoundary}, polygons: ${hasPolygons}, boundary: ${hasBoundary}, polygon: ${hasPolygon}`);

        // Try multiple polygon sources in priority order (handle nested arrays)
        const bboxVerts = seg?.boundingBox ? [
          { latitude: seg.boundingBox.sw?.latitude, longitude: seg.boundingBox.sw?.longitude },
          { latitude: seg.boundingBox.sw?.latitude, longitude: seg.boundingBox.ne?.longitude },
          { latitude: seg.boundingBox.ne?.latitude, longitude: seg.boundingBox.ne?.longitude },
          { latitude: seg.boundingBox.ne?.latitude, longitude: seg.boundingBox.sw?.longitude },
        ] : null;
        const candidates: any[] = [
          seg?.plane?.boundary?.vertices,
          seg?.polygons?.[0]?.vertices,
          seg?.boundary?.vertices,
          seg?.polygon?.vertices,
          seg?.segments?.[0]?.polygon?.vertices,
          seg?.plane?.polygons?.[0]?.vertices,
          seg?.roofSegmentStats?.plane?.boundary?.vertices,
          // Additional guesses based on API variations
          seg?.segmentPolygon?.vertices,
          seg?.plane?.contours?.[0]?.vertices,
          seg?.plane?.outerBoundary?.vertices,
          seg?.plane?.exterior?.vertices,
          Array.isArray(seg?.polygons) ? seg.polygons.map((p: any) => p?.vertices) : null,
          bboxVerts,
        ].filter(Boolean);

        const tryParse = (v: any): { lat: number; lng: number }[] => {
          if (!v) return [];
          if (Array.isArray(v) && v.length && Array.isArray(v[0])) {
            // It's a list of vertex lists; return the first valid
            for (const inner of v) {
              const p = parseVerts(inner);
              if (p.length >= 3) return p;
            }
            return [];
          }
          return parseVerts(v);
        };
        
        let coords: { lat: number; lng: number }[] = [];
        let usedBBox = false;
        const bboxParsed = bboxVerts ? parseVerts(bboxVerts) : [];
        for (const verts of candidates) {
          const parsed = tryParse(verts);
          if (parsed.length >= 3) {
            coords = parsed;
            // Heuristic: if this matches the bbox polygon, mark it
            if (bboxParsed.length >= 3 && parsed.length === bboxParsed.length) {
              const a = JSON.stringify(parsed.slice(0, 2));
              const b = JSON.stringify(bboxParsed.slice(0, 2));
              usedBBox = a === b;
            }
            break;
          }
        }
        
        // Skip if no valid polygon found
        if (coords.length < 3) {
          console.warn(`[solar-map] Segment ${i}: No valid polygon found in known fields`);
          return null;
        }
        
        console.info(`[solar-map] Segment ${i}: Using polygon with ${coords.length} points${usedBBox ? ' (from boundingBox fallback)' : ''}`);
        
        return {
          id: seg?.roofSegmentId || seg?.segmentId || `segment_${i}`,
          // Store as [lng, lat]
          polygon: coords.map((p) => [p.lng, p.lat]),
          // Keep legacy key for backward compatibility
          coordinates: coords.map((p) => [p.lng, p.lat]),
          potential: classifyPotential(stats),
          area: stats.areaMeters2 || stats.areaMeters || 0,
          panelsCount: stats.panelsCount || 0,
          yearlyEnergyDcKwh: Math.round(stats.yearlyEnergyDcKwh || 0),
          center: seg?.center ? {
            lat: seg.center.latitude || seg.center.lat,
            lng: seg.center.longitude || seg.center.lng
          } : null,
        };
      })
      .filter(Boolean as any);

    // 3b) Fallback to geocode viewport bounding box if no polygons were found
    if ((!roof_segments || roof_segments.length === 0) && viewport) {
      console.warn('[solar-map] No segment polygons available – falling back to geocode viewport bounding box');
      try {
        const ne = viewport.northeast;
        const sw = viewport.southwest;
        const nw = { lat: ne.lat, lng: sw.lng } as any;
        const se = { lat: sw.lat, lng: ne.lng } as any;
        const coords = [
          { lat: sw.lat, lng: sw.lng },
          { lat: se.lat, lng: se.lng },
          { lat: ne.lat, lng: ne.lng },
          { lat: nw.lat, lng: nw.lng },
        ];
        roof_segments = [{
          id: 'bbox_fallback',
          polygon: coords.map((p) => [p.lng, p.lat]),
          coordinates: coords.map((p) => [p.lng, p.lat]),
          potential: 'medium',
          area: 0,
          panelsCount: 0,
          yearlyEnergyDcKwh: 0,
          center: null,
        }];
      } catch (e) {
        console.error('[solar-map] Failed to build viewport fallback polygon:', e);
      }
    }

    // 4) Energy summary (fallbacks when API has no configs)
    let panel_count = solarPotential.solarPanelConfigs?.[0]?.panelsCount || 20;
    let annual_kwh = Math.round(solarPotential.solarPanelConfigs?.[0]?.yearlyEnergyDcKwh || 8000);

    const monthly_kwh = Array.from({ length: 12 }, (_, i) => {
      const base = annual_kwh / 12;
      const season = Math.sin(((i - 5) / 12) * 2 * Math.PI) * 0.3; // smooth seasonality
      return Math.round(base * (1 + season));
    });

    // Prefer real flux from API; fallback to kWh seasonality
    const monthly_flux: number[] = (solarPotential.monthlyFlux && Array.isArray(solarPotential.monthlyFlux) && solarPotential.monthlyFlux.length === 12)
      ? solarPotential.monthlyFlux
      : monthly_kwh;

    const summary = {
      annual_kwh,
      monthly_kwh,
      monthly_flux,
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
      maxFlux: Math.max(...monthly_flux),
    };

    // 4b) Fetch Google Solar Data Layers (DATA_LAYERS raster tiles + bounding box)
    let data_layers: any = null;
    try {
      // Updated requirements: start at 100m, retry at 300m
      let radiusMeters = 100;

      async function fetchDataLayers(rad: number) {
        const url = `https://solar.googleapis.com/v1/dataLayers:compute?key=${GOOGLE_SOLAR_KEY}`;
        const body = {
          location: { 
            latitude: location.lat, 
            longitude: location.lng 
          },
          radiusMeters: rad,
          requiredQuality: "HIGH",
          view: "DATA_LAYERS"
        };

        console.info('[solar-map] dataLayers:compute url:', url);
        console.info('[solar-map] dataLayers:compute body:', JSON.stringify(body));

        const res = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[solar-map] Google error:", res.status, "URL:", res.url, "Response:", text.slice(0, 500));
          return { ok: false, json: null };
        }

        const data = await res.json();
        console.info('[solar-map] dataLayers:compute success, keys:', Object.keys(data || {}));
        return { ok: true, json: data };
      }

      let attempt = await fetchDataLayers(radiusMeters);
      const missingImagery = !attempt.ok || !attempt.json || !attempt.json.imagery || (!attempt.json.imagery.imageryDate && !attempt.json.imagery.rasterUrlTemplate);
      if (missingImagery) {
        const newRadius = 300;
        console.warn('[solar-map] Retrying dataLayers:compute with radiusMeters =', newRadius);
        attempt = await fetchDataLayers(newRadius);
        radiusMeters = newRadius;
      }

      if (attempt.ok && attempt.json) {
        const dlJson = attempt.json || {};
        const imagery = dlJson.imagery || {};

        // Append API key to raster template/urls as required when using API key auth
        const appendKey = (url?: string | null) => {
          if (!url) return null;
          if (url.includes('key=')) return url; // already contains key/signature
          if (url.indexOf('?') > -1) return `${url}&key=${GOOGLE_SOLAR_KEY}`;
          return `${url}?key=${GOOGLE_SOLAR_KEY}`;
        };

        function normalizeBBox(b: any): { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null {
          if (!b) return null;
          // Common shape: { sw: {latitude, longitude}, ne: {latitude, longitude} }
          const sw = b.sw || b.southWest || b.southwest;
          const ne = b.ne || b.northEast || b.northeast;
          if (sw && ne && typeof sw.latitude === 'number' && typeof sw.longitude === 'number' && typeof ne.latitude === 'number' && typeof ne.longitude === 'number') {
            return { sw: { lat: sw.latitude, lng: sw.longitude }, ne: { lat: ne.latitude, lng: ne.longitude } };
          }
          // Array form: [minLng, minLat, maxLng, maxLat]
          if (Array.isArray(b) && b.length === 4) {
            return { sw: { lat: b[1], lng: b[0] }, ne: { lat: b[3], lng: b[2] } };
          }
          // Object with min/max
          if (typeof b.minLat === 'number' && typeof b.minLng === 'number' && typeof b.maxLat === 'number' && typeof b.maxLng === 'number') {
            return { sw: { lat: b.minLat, lng: b.minLng }, ne: { lat: b.maxLat, lng: b.maxLng } };
          }
          return null;
        }

        const rasterUrlTemplate = appendKey(imagery?.rasterUrlTemplate);
        const bbox = normalizeBBox(imagery?.boundingBox);

        data_layers = {
          imagery: {
            rasterUrlTemplate: rasterUrlTemplate,
            boundingBox: bbox,
            imageryDate: imagery?.imageryDate || null,
          },
          center: { lat: location.lat, lng: location.lng },
          radiusMeters,
        };
        console.info('[solar-map] Data Layers imagery keys:', Object.keys(imagery || {}));
      } else {
        console.warn('[solar-map] Data Layers unavailable after retries');
      }
    } catch (e) {
      console.error('[solar-map] Failed to fetch Data Layers:', e);
    }

    // 5) Build enhanced Google-only embed with roof visualization, Data Layers overlay, and seasonal animation
    const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
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
        width: 280px;
        background: #fff;
        box-shadow: 0 4px 20px rgba(0,0,0,.12);
        animation: slideIn .5s cubic-bezier(.16,1,.3,1);
        overflow-y: auto;
      }
      .panel .sec { padding: 14px 16px; border-bottom: 1px solid #eceff1; }
      .row { display:flex; justify-content:space-between; align-items:center; padding:8px 10px; margin:6px 0; background:#e8f0fe; border-left:3px solid #1a73e8; border-radius:8px; }
      .tot { background:#eaf7ee; border-left-color:#34a853; }
      .label { font-size: 12px; color:#5f6368; }
      .value { font-weight: 600; color:#202124; }
      .slider { display:flex; gap:10px; align-items:center; }
      .slider input { flex:1; -webkit-appearance:none; appearance:none; height:6px; background:#e8eaed; border-radius:3px; outline:none; }
      .slider input::-webkit-slider-thumb { width:16px; height:16px; border-radius:50%; background:#1a73e8; -webkit-appearance:none; box-shadow:0 2px 4px rgba(0,0,0,.2); }
      .map { flex:1; min-width:0; position: relative; }
      #map { height: 100%; width: 100%; }
      @keyframes slideIn { from{ transform:translateX(-320px); opacity:0; } to { transform:translateX(0); opacity:1; } }
    </style>
  </head>
  <body>
    <div class="main">
      <div class="panel">
        <div class="sec">
          <div class="label" style="margin:6px 0 10px">Month</div>
          <div class="slider">
            <div id="monthLabel" class="value" style="min-width:48px;text-align:center;background:#e8f0fe;padding:6px 10px;border-radius:6px">Jul</div>
            <input id="monthSlider" type="range" min="0" max="11" value="6" />
          </div>
        </div>
        <div class="sec">
          <div class="row"><span class="label">Address</span><span class="value">${formattedAddress}</span></div>
          <div class="row"><span class="label">Segments</span><span class="value">${roof_segments.length}</span></div>
          <div class="row"><span class="label">Data Layers</span><span class="value">${data_layers && data_layers.imagery && data_layers.imagery.rasterUrlTemplate ? 'Available' : 'Unavailable'}</span></div>
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

    <script src="https://unpkg.com/geotiff@2.0.7/dist-browser/geotiff.min.js"></script>
    <script>
      // Expose globals for Google callback & UI updates
      window.roofSegments = ${JSON.stringify(roof_segments)};
      window.baseAnnual = ${actualSolarData.baseAnnualKwh};
      window.basePanels = ${actualSolarData.basePanelCount};
      window.allPolygons = [];
      window.animationId = null;
      window.monthlyFlux = ${JSON.stringify(monthly_flux)};
      window.maxFlux = ${Math.max(...monthly_flux)};
      window.currentMonth = 6;
      window.monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      window.dataLayers = ${JSON.stringify(data_layers)};
      window.center = { lat: ${location.lat}, lng: ${location.lng} };
      window.allowedOrigin = "${allowedOrigin}";
      window.hasDataLayers = !!(window.dataLayers && window.dataLayers.imagery && window.dataLayers.imagery.rasterUrlTemplate);
    
      // Potential-based seasonal color mapping using monthly flux
      (function(){
        function blend(a, b, t){ return [
          Math.round(a[0] + (b[0]-a[0]) * t),
          Math.round(a[1] + (b[1]-a[1]) * t),
          Math.round(a[2] + (b[2]-a[2]) * t)
        ]; }
        function rgb(arr){ return 'rgb(' + arr[0] + ', ' + arr[1] + ', ' + arr[2] + ')'; }
        function baseFor(p){
          // Base hues by potential: high=yellow, medium=purple/pink, low=blue
          if (p === 'high') return [255, 215, 0];      // yellow
          if (p === 'low') return [66, 133, 244];      // blue (Google blue)
          return [186, 85, 211];                       // medium = orchid/purple
        }
        window.colorFor = function(potential, month){
          var flux = (window.monthlyFlux && window.monthlyFlux[month] != null) ? window.monthlyFlux[month] : 0;
          var t = (window.maxFlux && window.maxFlux > 0) ? (flux / window.maxFlux) : 0.5; // 0 winter -> 1 summer
          // Shade intensity by blending from white to base color
          var c = blend([255,255,255], baseFor(potential), t);
          return rgb(c);
        };
        window.setMonthColor = function(month){
          window.currentMonth = month;
          (window.allPolygons || []).forEach(function(polyData){
            var color = window.colorFor(polyData.potential, month);
            polyData.polygon.setOptions({ fillColor: color, strokeColor: color });
          });
          var label = document.getElementById('monthLabel');
          if (label) label.textContent = window.monthNames[month];
        };
        window.transitionMonth = function(nextMonth){
          var steps = 10, duration = 500, interval = duration / steps, step = 0;
          var startMonth = window.currentMonth || 6;
          var startColors = (window.allPolygons || []).map(function(pd){ return { pd: pd, color: window.colorFor(pd.potential, startMonth) }; });
          var endColors = (window.allPolygons || []).map(function(pd){ return { pd: pd, color: window.colorFor(pd.potential, nextMonth) }; });
          function parseRgb(s){ var m = (s || '').match(/\d+/g) || [0,0,0]; return [parseInt(m[0],10)||0, parseInt(m[1],10)||0, parseInt(m[2],10)||0]; }
          function lerp(a,b,t){ return Math.round(a + (b-a)*t); }
          var timer = setInterval(function(){
            step++;
            var t = step / steps;
            for (var i=0;i<startColors.length;i++){
              var s = parseRgb(startColors[i].color);
              var e = parseRgb(endColors[i].color);
              var r = lerp(s[0], e[0], t), g = lerp(s[1], e[1], t), b = lerp(s[2], e[2], t);
              startColors[i].pd.polygon.setOptions({ fillColor: 'rgb(' + r + ', ' + g + ', ' + b + ')', strokeColor: 'rgb(' + r + ', ' + g + ', ' + b + ')' });
            }
            if (step >= steps){ clearInterval(timer); window.setMonthColor(nextMonth); }
          }, interval);
        };
      })();
      
      // Google Solar Imagery overlay (raster tiles via rasterUrlTemplate)
      function addImageryOverlay(map){
        try {
          const imagery = window.dataLayers && window.dataLayers.imagery;
          if (!imagery || !imagery.rasterUrlTemplate) {
            console.log('[Imagery] Not available');
            try { if (window.parent) window.parent.postMessage({ type: 'solar_embed_error', reason: 'missing_imagery' }, window.allowedOrigin || '*'); } catch (e) { /* no-op */ }
            return;
          }
          const template = imagery.rasterUrlTemplate;
          const overlay = new google.maps.ImageMapType({
            name: 'Solar Imagery',
            tileSize: new google.maps.Size(256, 256),
            opacity: 0.7,
            getTileUrl: function(coord, zoom){
              return template
                .replace('{x}', coord.x)
                .replace('{y}', coord.y)
                .replace('{z}', zoom);
            }
          });
          map.overlayMapTypes.insertAt(0, overlay);
          window.hasDataLayers = true;

          // Fit bounds to imagery bounding box if present
          const bb = imagery.boundingBox;
          if (bb && bb.sw && bb.ne) {
            const bounds = new google.maps.LatLngBounds(
              new google.maps.LatLng(bb.sw.lat, bb.sw.lng),
              new google.maps.LatLng(bb.ne.lat, bb.ne.lng)
            );
            map.fitBounds(bounds);
          } else {
            try { if (window.parent) window.parent.postMessage({ type: 'solar_embed_error', reason: 'missing_bounding_box' }, window.allowedOrigin || '*'); } catch (e) { /* no-op */ }
          }
        } catch (err) {
          console.warn('[Imagery] Failed to add overlay', err);
        }
      }
      
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

        // Initialize Google Solar Imagery overlay
        try { addImageryOverlay(map); } catch (e) { console.warn('[Map] addImageryOverlay failed', e); }

        if (hasSeg) {
          map.fitBounds(bounds);
          setTimeout(() => {
            map.setZoom(Math.min(map.getZoom(), 20));
          }, 100);
        }

        // Enhanced roof segment rendering with visibility
        console.log('[Map] Rendering ' + (window.roofSegments || []).length + ' roof segments');
        
        (window.roofSegments || []).forEach((seg, i) => {
          if (!seg.coordinates || seg.coordinates.length < 3) {
            console.log('[Map] Skipping segment ' + i + ': Invalid coordinates');
            return;
          }
          
          console.log('[Map] Rendering segment ' + i + ' with ' + seg.coordinates.length + ' points, potential: ' + seg.potential);
          
          setTimeout(() => {
            const path = (seg.polygon || seg.coordinates).map(([lng, lat]) => ({ lat, lng }));
            const initialColor = window.colorFor(seg.potential, window.currentMonth);
            
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
              polygon.setOptions({ fillOpacity: 0.7 });
            }, 200);

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

        // Apply initial month colors after segments are loaded
        setTimeout(() => {
          console.log('[Map] Applying month color to ' + window.allPolygons.length + ' polygons');
          if (window.allPolygons.length > 0) {
            window.setMonthColor(window.currentMonth);
          }
        }, (window.roofSegments || []).length * 300 + 500);
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
        const panel = document.getElementById('panelSlider');
        if (panel) {
          panel.addEventListener('input', function(e) {
            const v = parseInt((e.target && e.target.value) || '0', 10);
            window.update(v);
          });
        }
        const month = document.getElementById('monthSlider');
        if (month) {
          month.addEventListener('input', function(e) {
            const v = parseInt((e.target && e.target.value) || '6', 10);
            window.transitionMonth(v);
          });
        }
        if (typeof window.setMonthColor === 'function') {
          window.setMonthColor(window.currentMonth || 6);
        }
        // Notify parent that the embed is ready; use configured origin (defaults to '*')
        try { if (window.parent) window.parent.postMessage({ type: 'solar_embed_ready', hasDataLayers: (window.hasDataLayers === true) }, window.allowedOrigin || '*'); } catch (e) { /* no-op */ }
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

    // If requested as an embed, return the HTML directly
    if (isEmbed) {
      return new Response(embedHtml, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
    }

    // Otherwise, return JSON with a direct embed URL to this function using the public host
    const fwdHost = req.headers.get('x-forwarded-host');
    const fwdProto = req.headers.get('x-forwarded-proto') || 'https';
    const publicOrigin = fwdHost
      ? `${fwdProto}://${fwdHost}`
      : (Deno.env.get('SUPABASE_URL') || `${url.protocol}//${url.host}`);
    let embedUrl = `${publicOrigin}${url.pathname}?embed=1&address=${encodeURIComponent(address)}`;
    // Enforce HTTPS to avoid mixed-content issues in iframes
    embedUrl = embedUrl.replace(/^http:\/\//, 'https://');

    const result = {
      status: "success",
      card: {
        type: "google_solar",
        title: "Your Roof Solar Potential",
        content: {
          embed_url: embedUrl,
          summary,
          roof_segments,
          has_data_layers: !!(data_layers && data_layers.imagery && data_layers.imagery.rasterUrlTemplate),
          data_layers_error: !(data_layers && data_layers.imagery && data_layers.imagery.rasterUrlTemplate)
            ? { error: "Data layers unavailable", address: formattedAddress }
            : undefined
        },
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
