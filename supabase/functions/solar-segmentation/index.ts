import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("solar-segmentation function called");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, lat, lng } = await req.json();
    console.log("Getting segmentation for:", { address, lat, lng });

    const apiKey = Deno.env.get('GOOGLE_SOLAR_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_SOLAR_API_KEY not found');
    }

    // Call buildingInsights with requiredQuality for better data
    const buildingInsightsUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
    
    console.log("Calling buildingInsights API for segmentation data");
    const buildingResponse = await fetch(buildingInsightsUrl);
    
    if (!buildingResponse.ok) {
      const errorText = await buildingResponse.text();
      console.error("buildingInsights API error:", errorText);
      throw new Error(`buildingInsights API error: ${buildingResponse.status}`);
    }

    const buildingData = await buildingResponse.json();
    console.log("buildingInsights response received");

    // Extract segmentation data
    const solarPotential = buildingData.solarPotential;
    const roofSegmentStats = solarPotential?.roofSegmentStats || [];
    
    console.log(`Found ${roofSegmentStats.length} roof segments`);

    // Get dataLayers for polygon geometry
    const dataLayers = buildingData.solarPotential?.dataLayers;
    const polygons = [];

    if (dataLayers) {
      console.log("Processing dataLayers for polygon data");
      
      // Look for mask and imagery layers that contain polygon data
      if (dataLayers.maskUrl) {
        console.log("Found maskUrl in dataLayers");
      }
      
      if (dataLayers.rgbUrl) {
        console.log("Found rgbUrl in dataLayers");
      }

      // Process roof segment stats and create polygons from available geometry
      for (let i = 0; i < roofSegmentStats.length; i++) {
        const segment = roofSegmentStats[i];
        
        // Check if segment has actual geometry
        let segmentPolygon = null;
        
        if (segment.plane?.boundary?.polygon?.vertices) {
          // Convert Google's polygon format to our format
          segmentPolygon = segment.plane.boundary.polygon.vertices.map((vertex: any) => [
            vertex.x || 0,
            vertex.y || 0
          ]);
          console.log(`Segment ${i}: Using plane boundary polygon with ${segmentPolygon.length} vertices`);
        } else if (segment.boundingBox) {
          // Fallback to bounding box if no polygon available
          const bbox = segment.boundingBox;
          segmentPolygon = [
            [bbox.sw.longitude, bbox.sw.latitude],
            [bbox.ne.longitude, bbox.sw.latitude], 
            [bbox.ne.longitude, bbox.ne.latitude],
            [bbox.sw.longitude, bbox.ne.latitude]
          ];
          console.log(`Segment ${i}: Using bounding box fallback`);
        }

        if (segmentPolygon) {
          // Determine potential based on solar stats
          let potential = 'medium';
          if (segment.stats?.areaMeters2 > 50 && segment.azimuthDegrees >= 135 && segment.azimuthDegrees <= 225) {
            potential = 'high';
          } else if (segment.stats?.areaMeters2 < 20) {
            potential = 'low';
          }

          polygons.push({
            id: `segment-${i}`,
            polygon: segmentPolygon,
            potential: potential,
            stats: segment.stats,
            azimuth: segment.azimuthDegrees,
            tilt: segment.pitchDegrees,
            panelCount: Math.floor((segment.stats?.areaMeters2 || 0) / 2) // Estimate 2m² per panel
          });
        }
      }
    }

    const result = {
      success: true,
      segmentation: {
        address: address,
        location: { lat, lng },
        roofSegmentStats: roofSegmentStats,
        polygons: polygons,
        dataLayers: dataLayers ? {
          hasMask: !!dataLayers.maskUrl,
          hasRgb: !!dataLayers.rgbUrl,
          hasAnnualFlux: !!dataLayers.annualFluxUrl,
          hasMonthlyFlux: !!dataLayers.monthlyFluxUrl
        } : null,
        metadata: {
          totalSegments: roofSegmentStats.length,
          polygonsFound: polygons.length,
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`Segmentation result: ${polygons.length} polygons from ${roofSegmentStats.length} segments`);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in solar-segmentation function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});