import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build form-data for OpenAI depending on incoming request type
    const oaiForm = new FormData();

    if (contentType.includes('multipart/form-data')) {
      // Frontend sent a direct file upload
      const incoming = await req.formData();
      const file = incoming.get('file');
      if (!file || !(file instanceof Blob)) {
        throw new Error('No audio file provided in form-data under key "file"');
      }
      const fileName = (file as any).name || 'audio.webm';
      oaiForm.append('file', file, fileName);
      oaiForm.append('model', 'whisper-1');
    } else {
      // Backward compatibility: JSON body with base64 audio
      const { audio, mimeType } = await req.json();
      if (!audio) {
        throw new Error('No audio data provided');
      }
      const binaryAudio = processBase64Chunks(audio);
      const inferredType = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'audio/webm';
      const ext = inferredType.includes('mp4') ? 'mp4' : inferredType.includes('wav') ? 'wav' : 'webm';
      const blob = new Blob([binaryAudio], { type: inferredType });
      oaiForm.append('file', blob, `audio.${ext}`);
      oaiForm.append('model', 'whisper-1');
    }

    // Send to OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: oaiForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Speech transcription successful:', result.text?.slice(0, 100));

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in speech-to-text function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});