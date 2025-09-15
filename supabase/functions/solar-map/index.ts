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

function createStaticImageUrl(lat: number, lng: number, maptype: 'satellite' | 'roadmap' = 'satellite'): string {
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap'
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '20',
    size: '640x640',
    maptype,
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

    // Parse query parameters and optional body
    const url = new URL(req.url)
    const latParam = url.searchParams.get('lat')
    const lngParam = url.searchParams.get('lng')
    const addressParam = url.searchParams.get('address')

    let lat: number | null = null
    let lng: number | null = null
    let address: string | null = addressParam

    // Try to read JSON body for POST requests (and gracefully for others)
    try {
      if (req.method !== 'GET') {
        const body = await req.json().catch(() => null) as Partial<SolarMapRequest & { address?: string }>|null
        if (body) {
          if (typeof body.lat === 'number') lat = body.lat
          if (typeof body.lng === 'number') lng = body.lng
          if (!address && typeof body.address === 'string') address = body.address
        }
      }
    } catch (e) {
      console.warn('Failed to parse JSON body:', e)
    }

    // Use query params if present
    if (latParam) lat = parseFloat(latParam)
    if (lngParam) lng = parseFloat(lngParam)

    // If still missing, try geocoding when an address is provided
    if ((lat === null || lng === null) && address) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({ address, key: GOOGLE_MAPS_API_KEY || '' }).toString()}`
      console.log('Geocoding address:', { address, geocodeUrl })
      const geoRes = await fetch(geocodeUrl, { headers: { 'Accept': 'application/json' } })
      if (!geoRes.ok) {
        console.error('Geocoding HTTP error:', geoRes.status, geoRes.statusText)
        return new Response(
          JSON.stringify({ error: 'Failed to geocode address', status: geoRes.status }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const geoData = await geoRes.json()
      if (geoData.status !== 'OK' || !geoData.results?.[0]?.geometry?.location) {
        console.error('Geocoding returned no results:', geoData.status, geoData.error_message)
        return new Response(
          JSON.stringify({ error: 'Address not found', geocodeStatus: geoData.status, message: geoData.error_message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      lat = geoData.results[0].geometry.location.lat
      lng = geoData.results[0].geometry.location.lng
    }

    // Validate we have coordinates
    if (lat === null || lng === null) {
      console.log('Missing required parameters after parsing:', { lat, lng, address })
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: provide lat & lng via query or JSON body, or an address to geocode' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate coordinates range
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

// Create static image URL with fallback
    let mapsUrl = ''
    try {
      mapsUrl = createStaticImageUrl(lat, lng, 'satellite')
    } catch (e) {
      console.warn('Failed to generate satellite mapsUrl, falling back to roadmap:', e)
    }
    if (!mapsUrl) {
      mapsUrl = createStaticImageUrl(lat, lng, 'roadmap')
      console.log('Fallback to roadmap mapsUrl:', mapsUrl)
    }

    // Explicit debug logs
    console.log('DEBUG: mapsUrl generated:', mapsUrl)
    console.log('DEBUG: coordinates used:', { lat, lng })

    // Log request for debugging
    console.log('Solar map request:', { lat, lng, mapsUrl })

    // Return response with safe defaults for solar fields
    const safeSolarData = {
      panel_count: 0,
      capacity_kw: 0,
      rooftop_area_m2: 0,
      mapsUrl,
      coordinates: { lat, lng },
      zoom: 20,
      size: '640x640'
    }

    console.log('Solar map response:', safeSolarData)

    return new Response(
      JSON.stringify(safeSolarData),
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