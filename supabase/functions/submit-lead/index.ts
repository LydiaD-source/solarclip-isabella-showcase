import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { name, email, phone, address, notes, client_id = 'solarclip', session_id } = await req.json();
    
    if (!name || !email) {
      throw new Error('Name and email are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Submitting lead for ${name} (${email}), client: ${client_id}`);

    // Insert lead into database
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name,
        email,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        client_id,
        session_id: session_id || null,
        source: 'isabella_chat'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save lead');
    }

    console.log('Lead saved successfully:', data.id);

    // TODO: Add webhook to client CRM here
    // Placeholder for CRM integration
    const crmWebhookUrl = Deno.env.get('CRM_WEBHOOK_URL');
    if (crmWebhookUrl) {
      try {
        await fetch(crmWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lead_id: data.id,
            name,
            email,
            phone,
            address,
            notes,
            client_id,
            source: 'isabella_chat',
            created_at: data.created_at
          })
        });
        console.log('Lead forwarded to CRM successfully');
      } catch (crmError) {
        console.error('CRM webhook failed:', crmError);
        // Don't fail the entire request if CRM webhook fails
      }
    }

    return new Response(JSON.stringify({ 
      status: 'success',
      lead_id: data.id,
      message: 'Thank you! I\'ve captured your information and someone from our team will contact you soon.',
      card: {
        type: "confirmation",
        title: "Lead Captured Successfully",
        content: {
          message: `Thank you ${name}! I've saved your information and our solar experts will contact you within 24 hours to discuss your solar potential.`,
          next_steps: [
            "Solar assessment call within 24 hours",
            "Personalized solar design for your property", 
            "Financing options and incentives review"
          ]
        },
        animation: "swoop-left"
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in submit-lead function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});