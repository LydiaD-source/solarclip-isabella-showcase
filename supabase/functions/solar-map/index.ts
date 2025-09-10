import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { address } = await req.json();
    if (!address) throw new Error('Address is required');

    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) throw new Error('Google Maps API key not configured');

    // 1) Geocode
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    if (!geocodeResponse.ok) throw new Error(`Geocoding failed: ${geocodeResponse.status}`);
    const geocodeData = await geocodeResponse.json();
    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) throw new Error('Address not found');

    const location = geocodeData.results[0].geometry.location;
    const formattedAddress = geocodeData.results[0].formatted_address;

    // 2) Solar API
    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&key=${googleApiKey}`;
    const solarRes = await fetch(solarApiUrl, { headers: { Accept: 'application/json' } });
    if (!solarRes.ok) throw new Error(`Solar API error: ${solarRes.status}`);
    const solarData = await solarRes.json();

    const solarPotential = solarData.solarPotential || {};
    const roofSegmentStats = solarData.roofSegmentStats || solarPotential.roofSegmentStats || [];

    // 3) Extract real roof polygons (no bounding boxes)
    const parseVerts = (verts: any[]) =>
      (verts || [])
        .map((v: any) => ({ lat: v.latitude ?? v.lat ?? v.latLng?.latitude, lng: v.longitude ?? v.lng ?? v.latLng?.longitude }))
        .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');

    const classifyPotential = (stats: any) => {
      if (stats?.sunshineQuantiles?.length) {
        const avg = stats.sunshineQuantiles.reduce((a: number, b: number) => a + b, 0) / stats.sunshineQuantiles.length;
        if (avg > 1700) return 'high';
        if (avg < 1400) return 'low';
        return 'medium';
      }
      const a = stats?.azimuthDegrees;
      if (typeof a === 'number') {
        if (a >= 135 && a <= 225) return 'high';
        if (a >= 90 && a <= 270) return 'medium';
        return 'low';
      }
      return 'medium';
    };

    const roof_segments = (roofSegmentStats || [])
      .map((seg: any, i: number) => {
        const stats = seg.stats || {};
        const candidates = [
          seg.segments?.[0]?.polygon?.vertices,
          seg.plane?.boundary?.vertices,
          seg.boundary?.vertices,
          seg.polygon?.vertices,
        ];
        let coords: any[] = [];
        for (const verts of candidates) {
          const parsed = parseVerts(verts);
          if (parsed.length >= 3) { coords = parsed; break; }
        }
        if (coords.length < 3) return null;
        return {
          id: `segment_${i}`,
          coordinates: coords.map((p) => [p.lng, p.lat]), // store as [lng,lat]
          potential: classifyPotential(stats),
          area: stats.areaMeters2 || 0,
          panelsCount: stats.panelsCount || 0,
          yearlyEnergyDcKwh: Math.round(stats.yearlyEnergyDcKwh || 0),
        };
      })
      .filter(Boolean);

    // 4) Energy summary
    let panel_count = solarPotential.solarPanelConfigs?.[0]?.panelsCount || 20;
    let annual_kwh = Math.round(solarPotential.solarPanelConfigs?.[0]?.yearlyEnergyDcKwh || 8000);
    const monthly_kwh = Array.from({ length: 12 }, (_, i) => {
      const base = annual_kwh / 12;
      const season = Math.sin((i - 5) / 12 * 2 * Math.PI) * 0.3;
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

    // 5) Google Maps embed with cinematic polygon reveal (pink/purple/blue)
    const embedUrl = `data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      *{box-sizing:border-box}
      body{margin:0;height:100vh;overflow:hidden;font-family:'Google Sans',Roboto,system-ui,Segoe UI,sans-serif;background:#f8f9fa}
      .main{display:flex;height:100vh}
      .panel{width:300px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.12);animation:slideIn .5s cubic-bezier(.16,1,.3,1)}
      .panel .sec{padding:20px;border-bottom:1px solid #eceff1}
      .row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;margin:10px 0;background:#e8f0fe;border-left:3px solid #1a73e8;border-radius:8px}
      .tot{background:#eaf7ee;border-left-color:#34a853}
      .label{font-size:13px;color:#5f6368}
      .value{font-weight:600;color:#202124}
      .slider{display:flex;gap:10px;align-items:center}
      .slider input{flex:1;-webkit-appearance:none;appearance:none;height:6px;background:#e8eaed;border-radius:3px;outline:none}
      .slider input::-webkit-slider-thumb{width:18px;height:18px;border-radius:50%;background:#1a73e8;-webkit-appearance:none;box-shadow:0 2px 4px rgba(0,0,0,.2)}
      #map{flex:1}
      .map{flex:1;min-width:0}
      @keyframes slideIn{from{transform:translateX(-320px);opacity:0}to{transform:translateX(0);opacity:1}}
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
      // Expose globals so Google Maps callback can find them
      window.roofSegments = ${JSON.stringify(roof_segments)};
      window.baseAnnual = ${actualSolarData.baseAnnualKwh};
      window.basePanels = ${actualSolarData.basePanelCount};

      window.color = function(p){
        return p==='high' ? '#FF69B4' : p==='low' ? '#4299E1' : '#9F7AEA';
      };

      window.initMap = function(){
        const bounds = new google.maps.LatLngBounds();
        let hasSeg = false;
        (window.roofSegments || []).forEach(s=>{
          (s.coordinates||[]).forEach(([lng,lat])=>{ if(typeof lat==='number'&&typeof lng==='number'){ bounds.extend(new google.maps.LatLng(lat,lng)); hasSeg=true; } });
        });
        const map = new google.maps.Map(document.getElementById('map'),{
          center: hasSeg ? bounds.getCenter() : {lat: ${location.lat}, lng: ${location.lng}},
          zoom: hasSeg ? 20 : 18,
          mapTypeId:'satellite',
          streetViewControl:false, mapTypeControl:false, fullscreenControl:true, gestureHandling:'greedy',
          styles:[{ featureType:'all', elementType:'labels', stylers:[{visibility:'off'}]}]
        });
        if(hasSeg){ map.fitBounds(bounds); map.setZoom(Math.min(map.getZoom(),20)); }

        // Staggered reveal with fade-in
        (window.roofSegments || []).forEach((seg, i)=>{
          if(!seg.coordinates || seg.coordinates.length<3) return;
          setTimeout(()=>{
            const path = seg.coordinates.map(([lng,lat])=>({lat,lng}));
            const poly = new google.maps.Polygon({
              paths: path,
              strokeColor: window.color(seg.potential), strokeOpacity:.9, strokeWeight:2,
              fillColor: window.color(seg.potential), fillOpacity: 0,
              map
            });
            setTimeout(()=> poly.setOptions({ fillOpacity: .65 }), 120);
            poly.addListener('mouseover',()=> poly.setOptions({ fillOpacity:.85, strokeWeight:3 }));
            poly.addListener('mouseout',()=> poly.setOptions({ fillOpacity:.65, strokeWeight:2 }));
          }, i*160);
        });
      };

      // Panel slider UI updates
      window.update = function(n){
        const ratio = n / window.basePanels; const a = Math.round(window.baseAnnual*ratio); const m = Math.round(a/12); const c = Math.round(a*0.0004);
        const panelCountEl = document.getElementById('panelCount');
        const aEl = document.getElementById('annualKwh');
        const mEl = document.getElementById('monthlyKwh');
        const cEl = document.getElementById('co2Saved');
        if(panelCountEl) panelCountEl.textContent = String(n);
        if(aEl) aEl.textContent = a.toLocaleString();
        if(mEl) mEl.textContent = m.toLocaleString();
        if(cEl) cEl.textContent = c.toLocaleString()+ ' tons';
      };
      window.updatePanelCount = window.update;

      window.addEventListener('load', function(){
        const slider = document.getElementById('panelSlider');
        if(slider){
          slider.addEventListener('input', function(e){ window.update(parseInt(e.target.value,10)); });
        }
      });
    </script>
    <script async defer src="https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap&libraries=geometry"></script>
  </body>
</html>
    `)};

    const result = {
      status: 'success',
      card: {
        type: 'google_solar',
        title: 'Your Roof Solar Potential',
        content: { embed_url: embedUrl, summary },
        animation: 'swoop-left'
      }
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('solar-map error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: (error as Error).message || 'Failed to generate solar map',
      card: {
        type: 'error',
        title: 'Solar Map Error',
        content: { message: "We couldn't render the solar map for that address. Try another." },
        animation: 'swoop-left'
      }
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
