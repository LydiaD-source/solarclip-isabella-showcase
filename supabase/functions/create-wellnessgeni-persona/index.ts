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
    const { persona_id, name, description, template } = await req.json();
    
    // Get API credentials from environment variables 
    const WELLNESS_GENI_API_KEY = Deno.env.get('WELLNESS_GENI_API_KEY');
    const WELLNESS_GENI_API_URL = Deno.env.get('WELLNESS_GENI_API_URL') || Deno.env.get('WELLNESSGENI_CHAT_URL') || '';
    
    if (!WELLNESS_GENI_API_KEY) {
      throw new Error('WellnessGeni API key not configured');
    }

    if (!WELLNESS_GENI_API_URL) {
      throw new Error('WellnessGeni API URL not configured');
    }

    console.log('Creating WellnessGeni persona:', { persona_id, name, description });

    // Try different possible persona creation endpoints
    const possibleEndpoints = [
      `${WELLNESS_GENI_API_URL}/personas`,
      `${WELLNESS_GENI_API_URL}/persona`,
      `${WELLNESS_GENI_API_URL}/create-persona`,
      `${WELLNESS_GENI_API_URL}/admin/personas`,
    ];

    const payload = {
      persona_id,
      name,
      description,
      template,
      client_id: 'solarclip',
    };

    let lastError = null;

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying persona creation at: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
            'apikey': `${WELLNESS_GENI_API_KEY}`,
            'x-api-key': `${WELLNESS_GENI_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const contentType = response.headers.get('content-type') || '';
        let responseData;
        
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = { text: await response.text() };
        }

        console.log(`Response from ${endpoint}:`, response.status, responseData);

        if (response.ok) {
          return new Response(JSON.stringify({
            success: true,
            persona_id,
            endpoint,
            data: responseData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastError = { endpoint, status: response.status, data: responseData };
      } catch (error) {
        console.log(`Error trying ${endpoint}:`, error.message);
        lastError = { endpoint, error: error.message };
      }
    }

    // If we reach here, all endpoints failed
    console.error('All persona creation endpoints failed:', lastError);
    
    return new Response(JSON.stringify({
      error: 'Could not create persona - all endpoints failed',
      lastError,
      endpoints_tried: possibleEndpoints,
      suggestion: 'The persona may need to be created manually in WellnessGeni admin or via a different API endpoint'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-wellnessgeni-persona function:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});