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
    console.log(`Geocoding URL: ${geocodeUrl}`);
    
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      const errorText = await geocodeResponse.text();
      console.error('Geocoding API error:', errorText);
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
    console.log('Geocoding response:', geocodeData.status, geocodeData.results?.length);
    
    // Handle common geocoding failure modes gracefully
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('Geocoding failed:', geocodeData.status, geocodeData.error_message);
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
    console.log(`Calling Solar API: ${solarApiUrl}`);
    
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
      
      if (response.status === 404) {
        return new Response(JSON.stringify({
          status: 'error',
          message: "No solar data available for this location yet. Please try a different address.",
          card: {
            type: "error",
            title: "Solar Data Unavailable",
            content: { message: "No solar data available for this location yet. Please try a different address." },
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

    // Create embed URL for the solar map visualization
    const embedUrl = `https://sunroof.withgoogle.com/place?address=${encodeURIComponent(formattedAddress)}`;

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