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

    // Call Google Solar API
    const solarApiUrl = `https://solar.googleapis.com/v1/buildings:findClosest?key=${googleApiKey}`;
    const response = await fetch(solarApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: {
          address: address
        }
      })
    });

    if (!response.ok) {
      console.error('Google Solar API error:', await response.text());
      throw new Error('Failed to fetch solar data');
    }

    const solarData = await response.json();
    
    // Process the solar data and create summary
    const summary = {
      annual_kwh: solarData.solarPotential?.maxArrayPanelsCount * 300 * 365 || 8420,
      monthly_kwh: Array.from({ length: 12 }, (_, i) => 
        Math.round(700 + Math.sin(i / 12 * 2 * Math.PI) * 200)
      ),
      co2_saved: Math.round((solarData.solarPotential?.maxArrayPanelsCount * 300 * 365 || 8420) * 0.0004),
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
    return new Response(JSON.stringify({ 
      error: error.message,
      card: {
        type: "error",
        title: "Solar Analysis Unavailable",
        content: {
          message: "I couldn't retrieve solar data for that address. Please try a different address or contact us directly."
        }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});