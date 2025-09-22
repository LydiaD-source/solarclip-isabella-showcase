import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, address, projectDescription } = await req.json();
    
    if (!name || !email || !address) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and address are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      // Fallback: Just log the data and return success for now
      console.log('Quote request (no email service configured):', {
        name,
        email,
        address,
        projectDescription,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Quote request received (email service will be configured)' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const resend = new Resend(RESEND_API_KEY);

    // Send email to sales team
    const emailResponse = await resend.emails.send({
      from: "SolarClip Quote <noreply@clearnanotech.com>",
      to: ["sales@clearnanotech.com"],
      subject: `New SolarClip™ Quote Request from ${name}`,
      html: `
        <h2>New SolarClip™ Quote Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Property Address:</strong> ${address}</p>
        <p><strong>Project Description:</strong></p>
        <p>${projectDescription || 'No additional details provided'}</p>
        <hr>
        <p><em>Submitted at: ${new Date().toLocaleString()}</em></p>
      `,
    });

    console.log('Quote email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: 'Quote request sent successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-quote-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});