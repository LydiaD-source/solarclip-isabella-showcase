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

    const googleApiKey = Deno.env.get('GOOGLE_SOLAR_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Solar API key not configured');
    }

    console.log(`Fetching solar data for address: ${address}, client: ${client_id}`);

    // First, geocode the address to get lat/lng coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      console.error('Geocoding API error:', await geocodeResponse.text());
      throw new Error('Failed to geocode address');
    }
    
    const geocodeData = await geocodeResponse.json();
    // Handle common geocoding failure modes gracefully
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('Geocoding failed:', geocodeData.status, geocodeData.error_message);
      return new Response(JSON.stringify({
        error: 'address_not_found',
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
    
    // Call Google Solar API with lat/lng coordinates
    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&key=${googleApiKey}`;
    const response = await fetch(solarApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Google Solar API error:', await response.text());
      throw new Error('Failed to fetch solar data');
    }

    const solarData = await response.json();
    
    // Process the solar data and create summary
    // Prefer monthly energy direct from API if available; otherwise compute a reasonable fallback
    const apiMonthly = solarData.solarPotential?.monthlyEnergyKwh || solarData.solarPotential?.monthlyEnergy?.map((m: any) => Math.round(m.energyKwh));
    const fallbackMonthly = Array.from({ length: 12 }, (_, i) => Math.round(700 + Math.sin(i / 12 * 2 * Math.PI) * 200));
    const monthly_kwh = Array.isArray(apiMonthly) && apiMonthly.length === 12 ? apiMonthly : fallbackMonthly;
    const estAnnual = solarData.solarPotential?.maxArrayPanelsCount
      ? Math.round(solarData.solarPotential.maxArrayPanelsCount * 300 * 365)
      : monthly_kwh.reduce((a: number, b: number) => a + b, 0);

    const summary = {
      annual_kwh: estAnnual,
      monthly_kwh,
      co2_saved: Math.round(estAnnual * 0.0004),
      panel_count: solarData.solarPotential?.maxArrayPanelsCount || 24,
      roof_area: solarData.solarPotential?.maxArrayAreaMeters2 || 150
    };

    // Create embed URL for the solar map visualization
    const embedUrl = `https://solar.google.com/solar/p/${encodeURIComponent(address)}`;

    const response_data = {
      embed_url: embedUrl,
      summary: summary,
      title: `Solar potential for ${address}`,
      raw_data: solarData,
      card: {
        type: "google_solar",
        title: `Solar Analysis: ${address}`,
        content: {
          summary: summary,
          embed_url: embedUrl
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