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
        text: "I'll show you our complete SolarClip presentation. Let me start with how our clip-on technology revolutionizes solar installation.",
        cards: [
          {
            type: "video_sequence",
            sequence: [
              {
                id: "intro_video",
                title: "SolarClip Introduction",
                cloudinary_tag: "solarclip_intro",
                announcement: "First, let me show you how SolarClip changes everything about solar installation."
              },
              {
                id: "comparison_video", 
                title: "Traditional vs SolarClip",
                cloudinary_tag: "solarclip_comparison",
                announcement: "Now see how we compare to traditional installation methods."
              },
              {
                id: "demo_video",
                title: "Installation Process",
                cloudinary_tag: "solarclip_demo",
                announcement: "Finally, watch our revolutionary installation process in action."
              }
            ]
          }
        ],
        actions: ['start_video_sequence']
      };
    }
    // Check if user wants solar analysis
    else if (lowerMessage.includes('solar') && (lowerMessage.includes('map') || lowerMessage.includes('analysis') || lowerMessage.includes('potential'))) {
      response = {
        text: "I can analyze the solar potential for any address. Please provide the address you'd like me to analyze.",
        cards: [],
        actions: ['request_address']
      };
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