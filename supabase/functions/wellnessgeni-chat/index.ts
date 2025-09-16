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
    const { message, client_id = 'solarclip', session_id, context } = await req.json();
    
    // Get API credentials from environment variables 
    const WELLNESS_GENI_API_KEY = Deno.env.get('WELLNESS_GENI_API_KEY');
    const WELLNESS_GENI_API_URL = Deno.env.get('WELLNESS_GENI_API_URL');
    
    if (!WELLNESS_GENI_API_KEY) {
      throw new Error('WellnessGeni API key not configured');
    }

    if (!WELLNESS_GENI_API_URL) {
      throw new Error('WellnessGeni API URL not configured');
    }

    console.log('WellnessGeni chat request:', { message, client_id, session_id, api_url: WELLNESS_GENI_API_URL });

    const response = await fetch(WELLNESS_GENI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
        // Add common alternative header names to maximize compatibility
        'apikey': `${WELLNESS_GENI_API_KEY}`,
        'x-api-key': `${WELLNESS_GENI_API_KEY}`,
      },
      body: JSON.stringify({
        message,
        client_id,
        session_id,
        context: {
          ...context,
          product: 'SolarClip',
          company: 'ClearNanoTech',
        }
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const errorBody = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : await response.text();
      console.error('WellnessGeni API error:', response.status, errorBody);
      throw new Error(`WellnessGeni API error: ${response.status}`);
    }

    let data: any = {};
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const textBody = await response.text();
      console.error('Unexpected non-JSON response from WellnessGeni:', textBody?.slice(0, 200));
      throw new Error('Invalid response from WellnessGeni (non-JSON). Check WELLNESSGENI_CHAT_URL');
    }

    console.log('WellnessGeni response:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in wellnessgeni-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      text: "I'm sorry, I'm having trouble connecting right now. Please try again.",
      cards: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});