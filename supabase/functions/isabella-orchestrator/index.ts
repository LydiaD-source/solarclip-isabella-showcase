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
    
    console.log(`Isabella processing message: ${message} for client: ${client_id}`);

    // Simulate Isabella's orchestration logic
    // This will later integrate with WellnessGeni/OpenAI
    let response = {
      text: '',
      cards: [],
      actions: []
    };

    const lowerMessage = message.toLowerCase();

    // Check if user is asking for videos/presentation
    if (lowerMessage.includes('show') || lowerMessage.includes('video') || lowerMessage.includes('demo')) {
      response = {
        text: "Here's our SolarClip presentation video.",
        cards: [
          {
            type: "video",
            title: "SolarClip Presentation",
            content: {
              url: "https://res.cloudinary.com/di5gj4nyp/video/upload/v1757341336/VIDEO-2025-04-11-11-30-14_1_xywu7x.mp4",
              description: "Revolutionary clip-on solar technology"
            }
          }
        ],
        actions: ['play_video']
      };
    }
    // Check if user wants solar analysis or provided an address
    else if (lowerMessage.includes('solar') && (lowerMessage.includes('map') || lowerMessage.includes('analysis') || lowerMessage.includes('potential'))) {
      // Check if message contains what looks like an address
      const hasAddress = /\d+.*\w+.*\w+/.test(message) || 
                        message.includes(',') || 
                        /\b(street|st|avenue|ave|drive|dr|road|rd|lane|ln|boulevard|blvd|way|court|ct|place|pl)\b/i.test(message);
      
      if (hasAddress) {
        // Extract potential address from the message
        const addressMatch = message.match(/(?:\d+.*|.*(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|boulevard|blvd|way|court|ct|place|pl).*)/i);
        const extractedAddress = addressMatch ? addressMatch[0].trim() : message.trim();
        
        try {
          console.log(`Calling solar-map for address: ${extractedAddress}`);
          
          // Call the solar-map function directly
          const solarResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/solar-map`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              client_id,
              address: extractedAddress,
              session_id
            })
          });

          if (solarResponse.ok) {
            const solarData = await solarResponse.json();
            
            if (solarData.status === 'success') {
              response = {
                text: `Great! I found solar data for ${solarData.summary?.address || extractedAddress}. Here's your solar potential analysis:`,
                cards: [solarData.card],
                actions: ['solar_analysis_complete']
              };
            } else {
              response = {
                text: solarData.message || "I couldn't find solar data for that address. Please try a different address.",
                cards: [],
                actions: ['request_address']
              };
            }
          } else {
            throw new Error('Solar API call failed');
          }
        } catch (error) {
          console.error('Error calling solar-map:', error);
          response = {
            text: "I'm having trouble analyzing that address right now. Please try again or provide a more complete address.",
            cards: [],
            actions: ['request_address']
          };
        }
      } else {
        response = {
          text: "I can analyze the solar potential for any address. Please provide the address you'd like me to analyze (for example: '123 Main Street, City, State' or '1600 Amphitheatre Parkway, Mountain View, CA, USA').",
          cards: [],
          actions: ['request_address']
        };
      }
    }
    // Check if user is providing contact info (basic lead capture detection)
    else if (lowerMessage.includes('@') || lowerMessage.includes('email') || lowerMessage.includes('contact')) {
      response = {
        text: "I'd be happy to connect you with our solar experts. Let me gather some information to ensure you get the best service.",
        cards: [
          {
            type: "lead_form",
            title: "Get Your Free Solar Consultation",
            fields: ['name', 'email', 'phone', 'address']
          }
        ],
        actions: ['collect_lead_info']
      };
    }
    // Address provided without 'solar' keyword
    else if (/\d+.*\w+.*\w+/.test(message) || message.includes(',') || /\b(street|st|avenue|ave|drive|dr|road|rd|lane|ln|boulevard|blvd|way|court|ct|place|pl)\b/i.test(message)) {
      // Extract potential address from the message
      const addressMatch = message.match(/(?:\d+.*|.*(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|boulevard|blvd|way|court|ct|place|pl).*)/i);
      const extractedAddress = addressMatch ? addressMatch[0].trim() : message.trim();
      
      try {
        console.log(`Calling solar-map for address: ${extractedAddress}`);
        
        const solarResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/solar-map`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            client_id,
            address: extractedAddress,
            session_id
          })
        });

        const solarData = await solarResponse.json();
        if (solarResponse.ok && solarData.status === 'success') {
          response = {
            text: `Great! I found solar data for ${solarData.summary?.address || extractedAddress}. Here's your solar potential analysis:`,
            cards: [solarData.card],
            actions: ['solar_analysis_complete']
          };
        } else {
          response = {
            text: solarData.message || "Sorry, I couldn’t locate that address. Please try another.",
            cards: [solarData.card || { type: 'error', title: 'Address Not Found', content: { message: "Sorry, I couldn’t locate that address. Please try another." } }],
            actions: ['request_address']
          };
        }
      } catch (error) {
        console.error('Error calling solar-map:', error);
        response = {
          text: "I'm having trouble analyzing that address right now. Please try again or provide a more complete address.",
          cards: [ { type: 'error', title: 'Solar Analysis Unavailable', content: { message: "I couldn't retrieve solar data right now. Please try again later." } } ],
          actions: ['request_address']
        };
      }
    }
    // Default greeting/general response
    else {
      response = {
        text: "Hello! I'm Isabella, your AI ambassador at SolarClip. I can show you our revolutionary clip-on solar technology, analyze solar potential for any address, or connect you with our experts. What would you like to explore?",
        cards: [],
        actions: ['show_options']
      };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in isabella-orchestrator function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      text: "I apologize, but I'm having trouble processing your request right now. Please try again or contact our support team directly."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});