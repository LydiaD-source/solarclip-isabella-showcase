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
    const { text, audio_base64, talk_id, source_url } = body || {};
    
    const DID_API_KEY = Deno.env.get('DID_API_KEY');
    if (!DID_API_KEY) {
      console.error('D-ID API key not configured in environment');
      throw new Error('D-ID API key not configured');
    }

    console.log('D-ID avatar request', { 
      hasText: !!text, 
      hasAudio: !!audio_base64, 
      poll: !!talk_id,
      textPreview: text?.substring(0, 50),
      audioSize: audio_base64?.length 
    });

    // Poll status for an existing talk
    if (talk_id) {
      console.log('Polling D-ID talk status for ID:', talk_id);
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
        throw new Error(`D-ID poll error: ${pollRes.status} - ${errText}`);
      }

      const pollData = await pollRes.json();
      console.log('D-ID poll result:', { 
        status: pollData.status, 
        hasResultUrl: !!pollData.result_url,
        hasAudioUrl: !!pollData.audio_url,
        id: pollData.id 
      });
      return new Response(JSON.stringify(pollData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Proxy remote media (audio/video) to bypass CORS
    const { proxy_url, media_type } = body || {};
    if (proxy_url && (media_type === 'audio' || media_type === 'video')) {
      console.log('Proxying media from URL:', { media_type, proxy_url: proxy_url?.slice(0, 60) + '...' });
      const mediaRes = await fetch(proxy_url);
      if (!mediaRes.ok) {
        const errText = await mediaRes.text();
        console.error('Proxy fetch failed:', mediaRes.status, errText);
        throw new Error(`Proxy fetch failed: ${mediaRes.status}`);
      }
      const arrayBuffer = await mediaRes.arrayBuffer();
      // Convert to base64 to return safely with CORS headers
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const contentType = mediaRes.headers.get('Content-Type') || (media_type === 'audio' ? 'audio/mpeg' : 'video/mp4');
      return new Response(JSON.stringify({ base64, content_type: contentType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // OPTIMIZED: Create talk with D-ID API - faster processing config
    const talkPayload = {
      source_url: source_url || 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg',
      script: audio_base64
        ? {
            type: 'audio',
            input: `data:audio/mp3;base64,${audio_base64}`,
          }
        : {
            type: 'text',
            input: text,
            provider: {
              type: "microsoft",
              voice_id: "en-US-AriaNeural"
            }
          },
      config: {
        // ULTRA-PERFORMANCE SETTINGS for sub-2-second generation
        stitch: false,          // Skip stitching for maximum speed
        fluent: false,          // Much faster processing
        pad_audio: 0,           // Instant start, no padding
        auto_match: false,      // Skip auto-matching delays
        normalization_factor: 1, // Skip normalization processing
        motion_factor: 0.75,    // Fixed: must be 0.5-1.5 range
        sharpen: false,         // Skip sharpening delays
        align_driver: false,    // Skip alignment processing
        align_expand_factor: 0, // No expansion delays
        result_format: 'mp4',   // Fastest format
        driver_expressions: {   // Minimal expressions for speed
          expressions: []
        }
      }
    };

    console.log('Creating D-ID talk with:', {
      source_url: talkPayload.source_url,
      script_type: talkPayload.script.type,
      has_audio: !!audio_base64,
      has_text: !!text,
      api_key_length: DID_API_KEY?.length
    });

    const response = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${DID_API_KEY}`,
      },
      body: JSON.stringify(talkPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D-ID create talk error:', response.status, errorText);
      console.error('Request payload was:', talkPayload);
      throw new Error(`D-ID API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('D-ID talk created successfully:', { 
      id: data.id, 
      status: data.status,
      created_at: data.created_at 
    });

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