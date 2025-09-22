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
    // Support GET streaming proxy before attempting to read JSON
    const url = new URL(req.url);

    // STREAMING MEDIA PROXY (GET): avoids buffering entire file in memory
    if (req.method === 'GET' && url.searchParams.get('proxy_url') && (url.searchParams.get('media_type') === 'audio' || url.searchParams.get('media_type') === 'video')) {
      const proxyUrl = url.searchParams.get('proxy_url') as string;
      const mediaType = url.searchParams.get('media_type') as 'audio' | 'video';
      const rangeHeader = req.headers.get('Range') || undefined;

      console.log('Proxying media (STREAM) via GET:', { media_type: mediaType, hasRange: !!rangeHeader, proxy_url: proxyUrl?.slice(0, 80) + '...' });

      const mediaRes = await fetch(proxyUrl, {
        method: 'GET',
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
      });

      if (!mediaRes.ok) {
        const errText = await mediaRes.text();
        console.error('Proxy GET fetch failed:', mediaRes.status, errText);
        return new Response(JSON.stringify({ error: `Proxy GET failed: ${mediaRes.status}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Pass-through streaming response with important headers
      const contentType = mediaRes.headers.get('Content-Type') || (mediaType === 'audio' ? 'audio/mpeg' : 'video/mp4');
      const contentRange = mediaRes.headers.get('Content-Range');
      const contentLength = mediaRes.headers.get('Content-Length');
      const acceptRanges = mediaRes.headers.get('Accept-Ranges') || 'bytes';

      const headers: Record<string, string> = { ...corsHeaders, 'Content-Type': contentType, 'Accept-Ranges': acceptRanges };
      if (contentRange) headers['Content-Range'] = contentRange;
      if (contentLength) headers['Content-Length'] = contentLength;

      return new Response(mediaRes.body, {
        status: mediaRes.status,
        headers,
      });
    }

    // Fallback to JSON body for POST-based operations
    const body = await req.json().catch(() => ({}));
    const { text, audio_base64, talk_id, source_url } = body || {};

    const DID_API_KEY = Deno.env.get('DID_API_KEY');
    if (!DID_API_KEY) {
      console.error('D-ID API key not configured in environment');
      throw new Error('D-ID API key not configured');
    }

    console.log('D-ID avatar request', { 
      hasText: !!text, 
      hasAudio: !!audio_base64 || !!text, // hasAudio is true when text is present (TTS)
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

    // NOTE: POST proxying of media has been removed. Use GET with query params for streaming proxy.
    // Any POST request without text/talk_id/audio will fall through to validation below.


    // Validate input - require text or audio when creating a new talk
    if (!talk_id && !text && !audio_base64) {
      console.error('No text or audio provided for D-ID talk creation');
      return new Response(JSON.stringify({ error: 'No text or audio provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard clause: prevent too-short inputs that cause D-ID validation errors
    if (!talk_id && typeof text === 'string') {
      const trimmed = text.trim();
      if (trimmed.length < 3) {
        console.warn('D-ID input too short, rejecting early (length < 3)');
        return new Response(JSON.stringify({ error: 'Input too short for D-ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
              voice_id: "en-US-JennyNeural"
            }
          },
      config: {
        stitch: true, // Enable stitching for better quality
        fluent: false, // SPEED: No fluent processing for speed
        pad_audio: 0.0, // SPEED: Zero padding for immediate start
        auto_match: false, // SPEED: No auto-matching for speed
        normalization_factor: 1,
        motion_factor: 1, // NATURAL: Full motion for realism
        align_driver: true, // CRITICAL: Prevent zoom distortion
        align_expand_factor: 0.0, // CRITICAL: No crop/zoom expansion - maintains natural face framing
        result_format: "mp4", // Ensure MP4 for consistent playback
        background: "transparent", // Request transparent background (may be composited)
        driver_expressions: {
          expressions: [
            {
              start_frame: 0,
              expression: "neutral",
              intensity: 0.9
            }
          ],
          transition_frames: 2 // SPEED: Ultra-fast transitions for real-time feel
        }
      }
    };

    console.log('Creating D-ID talk with:', {
      source_url: talkPayload.source_url,
      script_type: talkPayload.script.type,
      hasText: !!text, // hasText: true when text provided
      hasAudio: !!audio_base64 || !!text, // hasAudio: true when audio OR text (TTS) provided
      text_preview: text?.substring(0, 50),
      voice_id: talkPayload.script.provider?.voice_id,
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
      const errorText = await response.text().catch(() => '');
      console.error('D-ID create talk error:', response.status, errorText);
      console.error('Request payload was:', talkPayload);

      // Pass through rate limit and validation to the client for proper backoff
      const status = response.status;
      const body = status === 429
        ? { error: 'rate_limited', retry_after_ms: 3000 }
        : { error: errorText || 'D-ID API error', upstream_status: status };

      return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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