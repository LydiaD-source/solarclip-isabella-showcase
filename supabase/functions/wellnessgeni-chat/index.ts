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
    
    const WELLNESSGENI_API_KEY = Deno.env.get('WELLNESSGENI_API_KEY');
    if (!WELLNESSGENI_API_KEY) {
      throw new Error('WellnessGeni API key not configured');
    }

    console.log('WellnessGeni chat request:', { message, client_id, session_id });

    // Call WellnessGeni API at the actual deployed site
    const response = await fetch('https://isabela-soul-connect.lovable.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WELLNESSGENI_API_KEY}`,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WellnessGeni API error:', response.status, errorText);
      throw new Error(`WellnessGeni API error: ${response.status}`);
    }

    const data = await response.json();
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