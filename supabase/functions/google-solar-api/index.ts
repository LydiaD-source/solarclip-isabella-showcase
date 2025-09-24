import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const GOOGLE_SOLAR_API_KEY = Deno.env.get('GOOGLE_SOLAR_API_KEY');
    if (!GOOGLE_SOLAR_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Solar API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Fetching solar data for address:', address);

    // First, get the location coordinates using Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_SOLAR_API_KEY}`;
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      return new Response(
        JSON.stringify({ error: 'Address not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const location = geocodeData.results[0].geometry.location;
    console.log('Geocoded location:', location);

    // Then, call the Solar API with data layers for roof geometry
    const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&requiredQuality=MEDIUM&key=${GOOGLE_SOLAR_API_KEY}`;
    
    const solarResponse = await fetch(solarUrl);
    
    if (!solarResponse.ok) {
      const errorText = await solarResponse.text();
      console.error('Solar API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Solar API ${solarResponse.status}: ${errorText}` }),
        { 
          status: solarResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const solarData = await solarResponse.json();
    
    // Also fetch the data layers for roof geometry if we got building insights
    let combinedData = solarData;
    if (solarData.name) {
      const dataLayersUrl = `https://solar.googleapis.com/v1/dataLayers:get?location.latitude=${location.lat}&location.longitude=${location.lng}&radiusMeters=100&view=IMAGERY_AND_ANNUAL_FLUX_LAYERS&requiredQuality=MEDIUM&exactQualityRequired=false&pixelSizeMeters=0.5&key=${GOOGLE_SOLAR_API_KEY}`;
      console.log('Fetching data layers:', dataLayersUrl);
      
      try {
        const dataLayersResponse = await fetch(dataLayersUrl);
        if (dataLayersResponse.ok) {
          const dataLayersData = await dataLayersResponse.json();
          console.log('Data layers received:', JSON.stringify(dataLayersData, null, 2));
          combinedData = {
            ...solarData,
            dataLayers: dataLayersData
          };
        }
      } catch (error) {
        console.warn('Failed to fetch data layers:', error);
      }
    }
    console.log('Solar data received:', JSON.stringify(combinedData, null, 2));

    return new Response(
      JSON.stringify(combinedData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in google-solar-api function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});