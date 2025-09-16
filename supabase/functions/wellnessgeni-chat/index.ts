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
    const { message, session_id, client_id: reqClientId, context = {}, persona_id: reqPersona } = await req.json();

    // Normalize to match WellnessGeni admin (case sensitive)
    const normalizeId = (v?: string) => {
      if (!v) return 'SolarClip';
      return v.toLowerCase() === 'solarclip' ? 'SolarClip' : v;
    };

    const client_id = normalizeId(reqClientId);
    const persona_id = normalizeId(reqPersona); // Ensure correct case
    
    // Get API credentials from environment variables 
    const WELLNESS_GENI_API_KEY = Deno.env.get('WELLNESS_GENI_API_KEY');
    const WELLNESS_GENI_API_URL = Deno.env.get('WELLNESS_GENI_API_URL') || Deno.env.get('WELLNESSGENI_CHAT_URL') || '';
    const SOLARCLIP_GUIDE = Deno.env.get('SOLARCLIP_GUIDE');
    
    // Log config presence (no secrets) for debugging
    const urlHost = (() => { try { return new URL(WELLNESS_GENI_API_URL).host; } catch { return 'invalid-url'; } })();
    console.log('WellnessGeni config check:', {
      hasKey: !!WELLNESS_GENI_API_KEY,
      hasUrl: !!WELLNESS_GENI_API_URL,
      hasTemplate: !!SOLARCLIP_GUIDE,
      templateLen: SOLARCLIP_GUIDE?.length || 0,
      urlHost,
    });
    
    if (!WELLNESS_GENI_API_KEY) {
      throw new Error('WellnessGeni API key not configured');
    }

    if (!WELLNESS_GENI_API_URL) {
      throw new Error('WellnessGeni API URL not configured');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('Invalid request: missing message');
      return new Response(JSON.stringify({ 
        error: 'Missing required field: message' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WellnessGeni chat request:', { 
      message: String(message).slice(0, 120), 
      client_id, 
      persona_id,
      session_id, 
      api_url: WELLNESS_GENI_API_URL 
    });

    const contextPayload = {
      persona_template: SOLARCLIP_GUIDE || '',
    };

    const initialPayload: any = {
      message,
      session_id,
      client_id,
      persona_id, // attempt with explicit persona first
      context: contextPayload,
    };

    let response = await fetch(WELLNESS_GENI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
        // Add common alternative header names to maximize compatibility
        'apikey': `${WELLNESS_GENI_API_KEY}`,
        'x-api-key': `${WELLNESS_GENI_API_KEY}`,
      },
      body: JSON.stringify(initialPayload),
    });

    // Determine content type and handle invalid persona fallback
    let contentType = response.headers.get('content-type') || '';
    console.log('WellnessGeni upstream response meta:', { status: response.status, contentType });
    if (!response.ok) {
      const raw = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : await response.text();
      const errorBody: any = typeof raw === 'string' ? { error: raw } : raw;
      console.error('WellnessGeni API error:', response.status, errorBody);

      const invalidPersona = response.status === 400 && JSON.stringify(errorBody).toLowerCase().includes('invalid persona_id');
      if (invalidPersona) {
        const attempted: string[] = [];
        const variants = ['SolarClip', 'solarclip'];
        for (const alt of variants) {
          if (alt === persona_id) continue;
          attempted.push(alt);
          console.warn(`Persona id invalid. Retrying with variant persona_id "${alt}"`);
          const retryPayload = { message, session_id, client_id: alt, persona_id: alt, context: contextPayload };
          response = await fetch(WELLNESS_GENI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
              'apikey': `${WELLNESS_GENI_API_KEY}`,
              'x-api-key': `${WELLNESS_GENI_API_KEY}`,
            },
            body: JSON.stringify(retryPayload),
          });
          contentType = response.headers.get('content-type') || '';
          console.log('Retry upstream response meta:', { status: response.status, contentType, alt });
          if (response.ok) break;
        }
        if (!response.ok) {
          const retryError = contentType.includes('application/json')
            ? await response.json().catch(() => ({}))
            : await response.text();
          console.error('All persona_id retries failed:', response.status, retryError, { attempted });
          return new Response(JSON.stringify({
            error: 'Upstream WellnessGeni error after persona_id retries',
            status: response.status,
            details: retryError,
            attempted_persona_ids: [persona_id, ...attempted],
          }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({
          error: 'Upstream WellnessGeni error',
          status: response.status,
          details: errorBody,
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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