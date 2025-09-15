import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')

function validateCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  )
}

function createStaticImageUrl(
  lat: number,
  lng: number,
  maptype: 'satellite' | 'roadmap' = 'satellite',
  zoom: string = '20',
  size: string = '640x640'
): string {
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap'
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom,
    size,
    maptype,
    key: GOOGLE_MAPS_API_KEY || ''
  })
  return `${baseUrl}?${params.toString()}`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY missing')
      return new Response('Missing API key', { status: 500, headers: corsHeaders })
    }

    const url = new URL(req.url)
    // Accept lat/lng, center ("lat,lng"), or address
    const latParam = url.searchParams.get('lat')
    const lngParam = url.searchParams.get('lng')
    const centerParam = url.searchParams.get('center')
    const addressParam = url.searchParams.get('address')

    let lat: number | null = null
    let lng: number | null = null

    if (latParam && lngParam) {
      lat = parseFloat(latParam)
      lng = parseFloat(lngParam)
    } else if (centerParam && centerParam.includes(',')) {
      const [latStr, lngStr] = centerParam.split(',')
      lat = parseFloat(latStr)
      lng = parseFloat(lngStr)
    }

    if ((lat === null || lng === null) && addressParam) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({ address: addressParam, key: GOOGLE_MAPS_API_KEY || '' }).toString()}`
      console.log('IMG Geocoding address:', { address: addressParam, geocodeUrl })
      const geoRes = await fetch(geocodeUrl)
      const geoData = await geoRes.json()
      if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
        lat = geoData.results[0].geometry.location.lat
        lng = geoData.results[0].geometry.location.lng
      } else {
        console.error('IMG Geocoding failed', geoData)
        return new Response('Address not found', { status: 404, headers: corsHeaders })
      }
    }

    if (lat === null || lng === null || !validateCoordinates(lat, lng)) {
      console.error('IMG invalid/missing coordinates', { lat, lng })
      return new Response('Invalid coordinates', { status: 400, headers: corsHeaders })
    }

    // Try satellite first, then roadmap
    let mapsUrl = createStaticImageUrl(lat, lng, 'satellite')
    console.log('IMG DEBUG satellite mapsUrl:', mapsUrl)
    let imgRes = await fetch(mapsUrl)
    if (!imgRes.ok) {
      console.warn('IMG satellite fetch failed, falling back to roadmap', imgRes.status, imgRes.statusText)
      mapsUrl = createStaticImageUrl(lat, lng, 'roadmap')
      console.log('IMG DEBUG roadmap mapsUrl:', mapsUrl)
      imgRes = await fetch(mapsUrl)
    }

    if (!imgRes.ok) {
      console.error('IMG fetch failed', imgRes.status, imgRes.statusText)
      return new Response('Failed to retrieve map image', { status: 502, headers: corsHeaders })
    }

    const buf = await imgRes.arrayBuffer()
    const contentType = imgRes.headers.get('content-type') || 'image/png'

    console.log('IMG served for coords:', { lat, lng })

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300'
      }
    })
  } catch (e) {
    console.error('solar-map-image error:', e)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})