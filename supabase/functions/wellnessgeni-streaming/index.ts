import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory session storage for conversation history
const sessionStore = new Map<string, any[]>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, session_id, client_id: reqClientId, context = {}, persona_id: reqPersona, stream = false } = await req.json();

    // Get API credentials
    const WELLNESS_GENI_API_KEY = Deno.env.get('WELLNESS_GENI_API_KEY');
    const WELLNESS_GENI_API_URL = Deno.env.get('WELLNESS_GENI_API_URL') || Deno.env.get('WELLNESSGENI_CHAT_URL') || '';
    const SOLARCLIP_GUIDE = Deno.env.get('SOLARCLIP_GUIDE');
    const WELLNESS_GENI_PERSONA_ID = Deno.env.get('WELLNESS_GENI_PERSONA_ID');
    const SOLARCLIP_SYSTEM_INSTRUCTIONS = Deno.env.get('SOLARCLIP_SYSTEM_INSTRUCTIONS');
    
    if (!WELLNESS_GENI_API_KEY || !WELLNESS_GENI_API_URL) {
      throw new Error('Missing WellnessGeni configuration');
    }

    console.log('[Streaming] Request:', { 
      message: message?.slice(0, 50), 
      session_id, 
      stream,
      persona_id: reqPersona 
    });

    // Handle session and build messages array
    let client_id = reqClientId || 'SolarClip';
    let persona_id = reqPersona === 'solarclip' ? WELLNESS_GENI_PERSONA_ID : reqPersona;
    
    let messages: any[];
    if (!sessionStore.has(session_id)) {
      // New session - initialize with system instructions
      const systemMessages = [];
      
      if (SOLARCLIP_SYSTEM_INSTRUCTIONS) {
        systemMessages.push({ role: 'system', content: SOLARCLIP_SYSTEM_INSTRUCTIONS });
      }
      
      if (SOLARCLIP_GUIDE) {
        systemMessages.push({ 
          role: 'system', 
          content: `CRITICAL: You are Isabella, a SolarClip ambassador. Use ONLY the SolarClip guide below. ${SOLARCLIP_GUIDE}` 
        });
      }
      
      messages = [
        ...systemMessages,
        { role: 'user', content: message }
      ];
      sessionStore.set(session_id, messages);
    } else {
      // Existing session
      messages = [...sessionStore.get(session_id)!, { role: 'user', content: message }];
    }

    // Prepare streaming request to WellnessGeni
    const payload = {
      message,
      session_id,
      client_id,
      persona_id,
      messages,
      stream: true, // Always request streaming from upstream
      context: {
        ...context,
        client_id,
        stream_mode: true,
        max_tokens: 150, // Shorter responses for faster D-ID processing
        temperature: 0.7,
      }
    };

    console.log('[Streaming] Calling upstream with streaming enabled');
    
    // Call WellnessGeni API with streaming
    const response = await fetch(WELLNESS_GENI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
        'apikey': WELLNESS_GENI_API_KEY,
        'x-api-key': WELLNESS_GENI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Streaming] Upstream error:', response.status, error);
      throw new Error(`Upstream error: ${response.status}`);
    }

    // Check if upstream supports streaming
    const contentType = response.headers.get('content-type') || '';
    
    if (stream && contentType.includes('text/event-stream')) {
      // Stream response directly from upstream
      console.log('[Streaming] Proxying upstream stream');
      
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Upstream doesn't support streaming or client doesn't want it
      // Convert to streaming format
      console.log('[Streaming] Converting regular response to stream');
      
      const data = await response.json();
      const responseText = data.response || data.text || '';
      
      if (!responseText) {
        throw new Error('Empty response from upstream');
      }

      // Update session history
      const updatedMessages = [...messages, { role: 'assistant', content: responseText }];
      sessionStore.set(session_id, updatedMessages);

      if (stream) {
        // Simulate streaming by breaking response into chunks
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const words = responseText.split(' ');
            let index = 0;

            const sendChunk = () => {
              if (index >= words.length) {
                // Send final chunk
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }

              // Send 2-3 words at a time for realistic streaming
              const chunkSize = Math.min(3, words.length - index);
              const chunk = words.slice(index, index + chunkSize).join(' ');
              
              if (index + chunkSize < words.length) {
                // Add space for continuation
                const chunkData = {
                  choices: [{
                    delta: { content: chunk + ' ' }
                  }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
              } else {
                // Final chunk without trailing space
                const chunkData = {
                  choices: [{
                    delta: { content: chunk }
                  }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
              }
              
              index += chunkSize;
              
              // Send next chunk with realistic delay
              setTimeout(sendChunk, 50 + Math.random() * 100);
            };

            // Start streaming after brief delay
            setTimeout(sendChunk, 100);
          }
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Return regular JSON response
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

  } catch (error) {
    console.error('[Streaming] Error:', error);
    
    if (stream) {
      // Return error in streaming format
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          const errorData = {
            choices: [{
              delta: { 
                content: "I'm sorry, I'm having trouble connecting right now. Please try again." 
              }
            }]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(errorStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      return new Response(JSON.stringify({ 
        error: error.message,
        text: "I'm sorry, I'm having trouble connecting right now. Please try again."
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
});
