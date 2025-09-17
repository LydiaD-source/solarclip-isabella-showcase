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
    const { message, session_id, client_id: reqClientId, context = {}, persona_id: reqPersona } = await req.json();

    // Normalize client_id to match WellnessGeni admin (case sensitive)
    const normalizeId = (v?: string) => {
      if (!v) return 'SolarClip';
      return v.toLowerCase() === 'solarclip' ? 'SolarClip' : v;
    };

    // Get client_id from request or use default
    let client_id = normalizeId(reqClientId);
    
    // Get API credentials from environment variables 
    const WELLNESS_GENI_API_KEY = Deno.env.get('WELLNESS_GENI_API_KEY');
    const WELLNESS_GENI_API_URL = Deno.env.get('WELLNESS_GENI_API_URL') || Deno.env.get('WELLNESSGENI_CHAT_URL') || '';
    const SOLARCLIP_GUIDE = Deno.env.get('SOLARCLIP_GUIDE');
    const WELLNESS_GENI_CLIENT_ID = Deno.env.get('WELLNESS_GENI_CLIENT_ID');
    const WELLNESS_GENI_PERSONA_ID = Deno.env.get('WELLNESS_GENI_PERSONA_ID');

    // Do NOT blindly override client_id with secret to avoid cross-client template mixups
    // Prefer explicit client_id from request. As a fallback only (when none provided), use secret.
    if (!reqClientId && WELLNESS_GENI_CLIENT_ID) client_id = WELLNESS_GENI_CLIENT_ID;

    // Log client selection
    console.log('Client selection:', {
      client_id,
      usedSecretClient: !reqClientId && !!WELLNESS_GENI_CLIENT_ID,
      hasGuide: !!SOLARCLIP_GUIDE,
    });
    
    // Log config presence (no secrets) for debugging
    const urlHost = (() => { try { return new URL(WELLNESS_GENI_API_URL).host; } catch { return 'invalid-url'; } })();
    console.log('WellnessGeni config check:', {
      hasKey: !!WELLNESS_GENI_API_KEY,
      hasUrl: !!WELLNESS_GENI_API_URL,
      hasTemplate: !!SOLARCLIP_GUIDE,
      hasPersonaId: !!WELLNESS_GENI_PERSONA_ID,
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

    // Resolve persona_id mapping: map local 'solarclip' to built-in Isabella promoter
    let persona_id: string | undefined;
    const normalizedPersona = (reqPersona || '').toLowerCase();
    if (normalizedPersona === 'solarclip') {
      persona_id = WELLNESS_GENI_PERSONA_ID || undefined;
      // Force correct client routing for SolarClip
      client_id = 'SolarClip';
    } else if (reqPersona && reqPersona.trim().length > 0) {
      // Pass through any other provided persona ids for future clients
      persona_id = reqPersona;
    }

    // Hard fail early if we expected to map 'solarclip' but the secret is missing
    if (normalizedPersona === 'solarclip' && !persona_id) {
      console.error('Missing WELLNESS_GENI_PERSONA_ID: cannot resolve built-in Isabella persona.');
      return new Response(JSON.stringify({
        error: 'Server configuration error: WELLNESS_GENI_PERSONA_ID is not set',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WellnessGeni chat request with client-template mapping:', { 
      message: String(message).slice(0, 120), 
      client_id, 
      session_id, 
      api_url: WELLNESS_GENI_API_URL,
      persona_intent: reqPersona,
      resolvedPersona: !!persona_id,
      resolvedPersonaId: persona_id,
      usingMessagesArray: true,
      clientTemplateMapping: true
    });

    // CLIENT-TEMPLATE MAPPING SYSTEM
    // Allow one Isabella persona to serve multiple clients with specific guides
    const getClientGuide = (clientId: string) => {
      const normalizedClientId = (clientId || '').toLowerCase().trim();
      
      // Validate client_id
      if (!normalizedClientId) {
        console.warn('Empty client_id provided, using default configuration');
        return {
          guide: '',
          header: `CRITICAL: You are Isabella, a helpful assistant. Please specify a client for personalized assistance.`,
          clientName: 'Unknown'
        };
      }
      
      switch (normalizedClientId) {
        case 'solarclip':
          if (!SOLARCLIP_GUIDE) {
            console.error('SOLARCLIP_GUIDE not found in environment variables');
            return {
              guide: '',
              header: `CRITICAL: You are Isabella, a SolarClip ambassador. However, the SolarClip guide is not available.`,
              clientName: 'SolarClip'
            };
          }
          return {
            guide: SOLARCLIP_GUIDE,
            header: `CRITICAL: You are Isabella, a SolarClip ambassador. Use ONLY the SolarClip guide below. Do NOT mention Ovela Interactive or any other company. Follow the SolarClip persona strictly.`,
            clientName: 'SolarClip'
          };
        case 'ovela':
        case 'ovelainteractive':
          return {
            guide: '', // Ovela uses default persona template from WellnessGeni
            header: `CRITICAL: You are Isabella, an Ovela Interactive ambassador. Use your default Ovela template.`,
            clientName: 'Ovela Interactive'
          };
        default:
          console.warn(`Unknown client_id: ${clientId}, using default configuration`);
          return {
            guide: '',
            header: `CRITICAL: Override any default persona templates. Use ONLY the client-specific guide below. Client: ${clientId}.`,
            clientName: clientId
          };
      }
    };

    // Handle session-based conversation history
    let messages: any[];
    let isNewSession = false;
    let baseGuide = '';
    let overrideHeader = '';
    let systemGuide = '';

    if (!sessionStore.has(session_id)) {
      // Get client-specific guide and header
      const clientConfig = getClientGuide(client_id);
      baseGuide = clientConfig.guide;
      overrideHeader = clientConfig.header;
      
      // Build system guide: override header + client-specific guide (if any)
      systemGuide = [overrideHeader, baseGuide].filter(Boolean).join('\n\n');

      messages = [
        { role: 'system', content: systemGuide || 'You are a helpful assistant. Use the provided client guide when available.' },
        { role: 'user', content: message }
      ];
      sessionStore.set(session_id, messages);
      isNewSession = true;
      
      // Enhanced logging for client-template mapping
      console.log('New session initialized with client-template mapping:', {
        session_id,
        client_id,
        clientName: clientConfig.clientName,
        hasGuide: !!baseGuide,
        guideLength: baseGuide?.length || 0,
        systemGuideLength: systemGuide?.length || 0,
        persona_id: persona_id || 'none'
      });
    } else {
      // Existing session: append only new user message
      messages = [...sessionStore.get(session_id)!, { role: 'user', content: message }];
      console.log('Continuing session:', session_id, 'message count:', messages.length);
    }

    // Build a base payload; ensure 'message' is ONLY the user's text (system guide lives in messages[0])
    const payloadMessage = message;

    const payloadBase = {
      message: payloadMessage,
      session_id,
      client_id,
      messages,
      context: { 
        ...(context || {}), 
        client_id, 
        client_guide: baseGuide || undefined, 
        override_client_template: !!baseGuide,
        system_prompt: systemGuide || baseGuide || undefined,
        guide_template: baseGuide || undefined
      }
    };

    // Log payload shape for debugging (sanitized)
    console.log('Prepared payloadBase with client-template mapping:', {
      hasMessage: typeof payloadBase.message === 'string',
      messageLen: String(payloadBase.message || '').length,
      messagesCount: Array.isArray(messages) ? messages.length : 0,
      hasSystemInMessages0: messages?.[0]?.role === 'system',
      systemGuideLength: messages?.[0]?.content?.length || 0,
      contextKeys: Object.keys(payloadBase.context || {}),
      client_id,
      hasClientGuide: !!baseGuide,
      overrideClientTemplate: !!baseGuide,
      persona_id: persona_id || 'none'
    });
    // Helper to call upstream with a given persona_id
    const callUpstreamWithPersona = async (pid: string) => {
      const response = await fetch(WELLNESS_GENI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
          'apikey': `${WELLNESS_GENI_API_KEY}`,
          'x-api-key': `${WELLNESS_GENI_API_KEY}`,
        },
        body: JSON.stringify({ ...payloadBase, persona_id: pid }),
      });
      const contentType = response.headers.get('content-type') || '';
      console.log('WellnessGeni upstream response:', { status: response.status, contentType, persona_id: pid });

      let parsedError: any = null;
      if (!response.ok) {
        const raw = contentType.includes('application/json')
          ? await response.json().catch(() => ({}))
          : await response.text();
        parsedError = typeof raw === 'string' ? { error: raw } : raw;
        console.error('WellnessGeni API error:', response.status, parsedError, { persona_id: pid });
      }

      return { response, contentType, parsedError };
    };

    // First attempt with provided/mapped persona_id
    let pidToUse = persona_id as string;
    let { response, contentType, parsedError } = await callUpstreamWithPersona(pidToUse);

    // If invalid persona id, try alternate hyphen/underscore variant once
    if (!response.ok && (parsedError?.error || '').toString().toLowerCase().includes('invalid persona')) {
      const altPid = pidToUse.includes('-') ? pidToUse.replace(/-/g, '_') : pidToUse.replace(/_/g, '-');
      if (altPid !== pidToUse) {
        console.warn('Retrying WellnessGeni with alternate persona_id variant', { original: pidToUse, alternate: altPid });
        const retry = await callUpstreamWithPersona(altPid);
        response = retry.response;
        contentType = retry.contentType;
        parsedError = retry.parsedError;
        if (response.ok) {
          console.log('Alternate persona_id variant succeeded');
        }
      }
    }

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: 'Upstream WellnessGeni error',
        status: response.status,
        details: parsedError || { error: 'Unknown error' },
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // If upstream returned empty response, retry with a messages-only payload (no top-level message)
    if ((typeof data?.response === 'string' && data.response.trim() === '') || (!data?.response && !data?.text)) {
      console.warn('Empty response detected. Retrying with messages-only payload...');

      // Attempt 1: messages-only (keep persona_id)
      const altBody1 = {
        session_id,
        client_id,
        persona_id: pidToUse,
        messages,
        context: payloadBase.context,
      } as const;
      console.log('Retry #1 WellnessGeni with messages-only payload', {
        messagesCount: Array.isArray(altBody1.messages) ? altBody1.messages.length : 0,
        hasSystemInMessages0: altBody1.messages?.[0]?.role === 'system',
        persona_id: pidToUse,
      });
      let retryRes = await fetch(WELLNESS_GENI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
          'apikey': `${WELLNESS_GENI_API_KEY}`,
          'x-api-key': `${WELLNESS_GENI_API_KEY}`,
        },
        body: JSON.stringify(altBody1),
      });
      let retryContentType = retryRes.headers.get('content-type') || '';
      console.log('Retry #1 upstream response:', { status: retryRes.status, contentType: retryContentType });
      let retryData: any = null;
      if (retryContentType.includes('application/json')) {
        retryData = await retryRes.json().catch(() => ({}));
      } else {
        const raw = await retryRes.text().catch(() => '');
        console.error('Retry #1 received non-JSON body', raw?.slice(0, 200));
      }

      const retry1Empty = !retryRes.ok || ((typeof retryData?.response === 'string' && retryData.response.trim() === '') || (!retryData?.response && !retryData?.text));

      // Attempt 2: messages-only WITHOUT persona_id (let upstream resolve by client/system)
      if (retry1Empty) {
        console.warn('Retry #1 still empty. Retrying #2 without persona_id...');
        const altBody2 = {
          session_id,
          client_id,
          messages,
          context: payloadBase.context,
        } as const;
        console.log('Retry #2 WellnessGeni with messages-only (no persona_id)', {
          messagesCount: Array.isArray(altBody2.messages) ? altBody2.messages.length : 0,
          hasSystemInMessages0: altBody2.messages?.[0]?.role === 'system',
        });
        retryRes = await fetch(WELLNESS_GENI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
            'apikey': `${WELLNESS_GENI_API_KEY}`,
            'x-api-key': `${WELLNESS_GENI_API_KEY}`,
          },
          body: JSON.stringify(altBody2),
        });
        retryContentType = retryRes.headers.get('content-type') || '';
        console.log('Retry #2 upstream response:', { status: retryRes.status, contentType: retryContentType });
        if (retryContentType.includes('application/json')) {
          retryData = await retryRes.json().catch(() => ({}));
        } else {
          const raw2 = await retryRes.text().catch(() => '');
          console.error('Retry #2 received non-JSON body', raw2?.slice(0, 200));
        }
      }

      const retry2Empty = !retryRes.ok || ((typeof retryData?.response === 'string' && retryData.response.trim() === '') || (!retryData?.response && !retryData?.text));

      // Attempt 3: top-level message ONLY (no messages)
      if (retry2Empty) {
        console.warn('Retry #2 still empty. Retrying #3 with top-level message only...');
        const altBody3 = {
          message: payloadMessage,
          session_id,
          client_id,
          persona_id: pidToUse,
          context: payloadBase.context,
        } as const;
        console.log('Retry #3 WellnessGeni with top-level message only', {
          hasMessage: typeof altBody3.message === 'string',
          messageLen: String(altBody3.message || '').length,
          persona_id: pidToUse,
        });
        const retryRes3 = await fetch(WELLNESS_GENI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WELLNESS_GENI_API_KEY}`,
            'apikey': `${WELLNESS_GENI_API_KEY}`,
            'x-api-key': `${WELLNESS_GENI_API_KEY}`,
          },
          body: JSON.stringify(altBody3),
        });
        const retryContentType3 = retryRes3.headers.get('content-type') || '';
        console.log('Retry #3 upstream response:', { status: retryRes3.status, contentType: retryContentType3 });
        if (retryContentType3.includes('application/json')) {
          const retryData3 = await retryRes3.json().catch(() => ({}));
          if (retryRes3.ok) data = retryData3;
        } else {
          const raw3 = await retryRes3.text().catch(() => '');
          console.error('Retry #3 received non-JSON body', raw3?.slice(0, 200));
        }
      } else {
        // If retry #1 or #2 produced data, adopt it
        if (retryRes.ok && retryData) data = retryData;
      }
    }

    // Update session store with conversation history
    if (data.response || data.text) {
      const assistantResponse = data.response || data.text;
      const updatedMessages = [...messages, { role: 'assistant', content: assistantResponse }];
      sessionStore.set(session_id, updatedMessages);
      console.log('Session updated:', session_id, 'total messages:', updatedMessages.length);
    }

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