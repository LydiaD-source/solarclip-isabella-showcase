import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')

interface SolarMapRequest {
  lat: number
  lng: number
}

function validateCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && 
    !isNaN(lng) && 
    lat >= -90 && 
    lat <= 90 && 
    lng >= -180 && 
    lng <= 180
  )
}

function createSatelliteImageUrl(lat: number, lng: number): string {
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap'
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '20',
    size: '640x640',
    maptype: 'satellite',
    key: GOOGLE_MAPS_API_KEY || ''
  })
  
  return `${baseUrl}?${params.toString()}`
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate API key
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing API key' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse query parameters
    const url = new URL(req.url)
    const latParam = url.searchParams.get('lat')
    const lngParam = url.searchParams.get('lng')

    // Validate required parameters
    if (!latParam || !lngParam) {
      console.log('Missing required parameters:', { lat: latParam, lng: lngParam })
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: lat and lng are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse coordinates
    const lat = parseFloat(latParam)
    const lng = parseFloat(lngParam)

    // Validate coordinates
    if (!validateCoordinates(lat, lng)) {
      console.log('Invalid coordinates:', { lat, lng })
      return new Response(
        JSON.stringify({ 
          error: 'Invalid coordinates: lat must be between -90 and 90, lng must be between -180 and 180' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create satellite image URL
    const mapsUrl = createSatelliteImageUrl(lat, lng)
    
    // Log request for debugging
    console.log('Solar map request:', {
      lat,
      lng,
      mapsUrl
    })

    // Return response
    const response = {
      mapsUrl,
      coordinates: { lat, lng },
      zoom: 20,
      size: '640x640'
    }

    console.log('Solar map response:', response)

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
    )

  } catch (error) {
    console.error('Solar map function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})