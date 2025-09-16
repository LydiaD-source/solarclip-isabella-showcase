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
    const body = await req.json();
    const { text, audio_base64, talk_id } = body || {};
    
    const DID_API_KEY = Deno.env.get('DID_API_KEY');
    if (!DID_API_KEY) {
      throw new Error('D-ID API key not configured');
    }

    console.log('D-ID avatar request', { hasText: !!text, hasAudio: !!audio_base64, poll: !!talk_id });

    // Poll status for an existing talk
    if (talk_id) {
      const pollRes = await fetch(`https://api.d-id.com/talks/${talk_id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${DID_API_KEY}`,
        },
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        console.error('D-ID poll error:', pollRes.status, errText);
        throw new Error(`D-ID poll error: ${pollRes.status}`);
      }

      const pollData = await pollRes.json();
      return new Response(JSON.stringify(pollData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create talk with D-ID API
    const response = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${DID_API_KEY}`,
      },
      body: JSON.stringify({
        source_url: 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg',
        script: {
          type: audio_base64 ? 'audio' : 'text',
          input: audio_base64 ? `data:audio/mp3;base64,${audio_base64}` : text,
          provider: audio_base64 ? undefined : {
            type: 'elevenlabs',
            voice_id: 't0IcnDolatli2xhqgLgn',
          }
        },
        config: {
          fluent: true,
          pad_audio: 0.0,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D-ID API error:', response.status, errorText);
      throw new Error(`D-ID API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('D-ID talk created:', data.id);

    return new Response(JSON.stringify({ 
      talk_id: data.id,
      status: data.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in did-avatar function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});