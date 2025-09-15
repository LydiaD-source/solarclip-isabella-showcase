import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')
const MAPBOX_PUBLIC_TOKEN = Deno.env.get('MAPBOX_PUBLIC_TOKEN')

function validateCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  )
}

function createGoogleStaticImageUrl(
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

function createMapboxStaticImageUrl(
  lat: number,
  lng: number,
  zoom: string = '20',
  size: string = '640x640'
): string {
  const [w, h] = size.split('x').map((n) => parseInt(n, 10) || 640)
  const clampedW = Math.min(Math.max(w, 1), 1280)
  const clampedH = Math.min(Math.max(h, 1), 1280)
  // Mapbox expects lng,lat order
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/${clampedW}x${clampedH}?access_token=${MAPBOX_PUBLIC_TOKEN || ''}`
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
    const zoomParam = url.searchParams.get('zoom') || '20'
    const sizeParam = url.searchParams.get('size') || '640x640'

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

    // Try Google satellite first, then Mapbox satellite, then Google roadmap
    let mapsUrl = createGoogleStaticImageUrl(lat, lng, 'satellite', zoomParam, sizeParam)
    console.log('IMG DEBUG Google satellite mapsUrl:', mapsUrl)
    let imgRes = await fetch(mapsUrl)

    if (!imgRes.ok) {
      console.warn('IMG Google satellite fetch failed', imgRes.status, imgRes.statusText)

      if (MAPBOX_PUBLIC_TOKEN) {
        const mapboxUrl = createMapboxStaticImageUrl(lat, lng, zoomParam, sizeParam)
        console.log('IMG DEBUG Mapbox satellite mapsUrl:', mapboxUrl)
        const mapboxRes = await fetch(mapboxUrl)
        if (mapboxRes.ok) {
          const buf = await mapboxRes.arrayBuffer()
          const contentType = mapboxRes.headers.get('content-type') || 'image/png'
          console.log('IMG served via Mapbox for coords:', { lat, lng })
          return new Response(buf, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=300'
            }
          })
        } else {
          console.warn('IMG Mapbox satellite fetch failed', mapboxRes.status, mapboxRes.statusText)
        }
      }

      // Fallback to Google roadmap
      mapsUrl = createGoogleStaticImageUrl(lat, lng, 'roadmap', zoomParam, sizeParam)
      console.log('IMG DEBUG Google roadmap mapsUrl:', mapsUrl)
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