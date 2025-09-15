import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_SOLAR_API_KEY = Deno.env.get('GOOGLE_SOLAR_API_KEY')

interface SolarApiRequest {
  lat?: number
  lng?: number
  address?: string
}

interface GoogleSolarResponse {
  solarPotential: {
    panelConfigs: Array<{
      panelsCount: number
      yearlyEnergyDcKwh: number
      roofSegmentSummaries: Array<{
        pitchDegrees: number
        azimuthDegrees: number
        panelsCount: number
        yearlyEnergyDcKwh: number
        segmentIndex: number
      }>
    }>
    wholeRoofStats: {
      areaMeters2: number
      sunshineQuantiles: number[]
      groundAreaMeters2: number
    }
    roofSegmentStats: Array<{
      pitchDegrees: number
      azimuthDegrees: number
      statsType: string
      centerPoint: {
        latitude: number
        longitude: number
      }
      boundingBox: {
        sw: { latitude: number; longitude: number }
        ne: { latitude: number; longitude: number }
      }
      planeHeightAtCenterMeters: number
    }>
    solarPanelConfigs: Array<{
      panelsCount: number
      yearlyEnergyDcKwh: number
    }>
    financialAnalyses: Array<{
      monthlyBill: {
        currencyCode: string
        units: string
      }
      panelConfigIndex: number
    }>
  }
  imagery: {
    quality: string
    date: {
      year: number
      month: number
      day: number
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate API key
    if (!GOOGLE_SOLAR_API_KEY) {
      console.error('GOOGLE_SOLAR_API_KEY not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Solar API key' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request
    const url = new URL(req.url)
    let lat: number | null = null
    let lng: number | null = null
    let address: string | null = null

    // Try query parameters first
    const latParam = url.searchParams.get('lat')
    const lngParam = url.searchParams.get('lng')
    const addressParam = url.searchParams.get('address')

    if (latParam) lat = parseFloat(latParam)
    if (lngParam) lng = parseFloat(lngParam)
    if (addressParam) address = addressParam

    // Try body for POST requests
    if (req.method !== 'GET') {
      try {
        const body = await req.json() as SolarApiRequest
        if (body.lat) lat = body.lat
        if (body.lng) lng = body.lng
        if (body.address) address = body.address
      } catch (e) {
        console.warn('Failed to parse JSON body:', e)
      }
    }

    // Geocode address if coordinates not provided
    if ((lat === null || lng === null) && address) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_SOLAR_API_KEY}`
      console.log('Geocoding address:', address)
      
      const geoRes = await fetch(geocodeUrl)
      if (!geoRes.ok) {
        throw new Error(`Geocoding failed: ${geoRes.status}`)
      }
      
      const geoData = await geoRes.json()
      if (geoData.status !== 'OK' || !geoData.results?.[0]?.geometry?.location) {
        throw new Error(`Address not found: ${geoData.status}`)
      }
      
      lat = geoData.results[0].geometry.location.lat
      lng = geoData.results[0].geometry.location.lng
    }

    if (lat === null || lng === null) {
      return new Response(
        JSON.stringify({ error: 'Missing coordinates or address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching solar data for coordinates:', { lat, lng })

    // Call Google Solar API
    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${GOOGLE_SOLAR_API_KEY}`
    
    const solarRes = await fetch(solarApiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!solarRes.ok) {
      console.error('Solar API error:', solarRes.status, solarRes.statusText)
      const errorText = await solarRes.text()
      console.error('Solar API error details:', errorText)
      
      // Return fallback data if Solar API fails
      return new Response(
        JSON.stringify({
          panel_count: 0,
          capacity_kw: 0,
          rooftop_area_m2: 0,
          coordinates: { lat, lng },
          error: 'Solar data unavailable for this location',
          fallback: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const solarData: GoogleSolarResponse = await solarRes.json()
    console.log('Solar API response received, processing data...')

    // Extract the best panel configuration if provided by the API
    const panelConfigs = solarData.solarPotential?.panelConfigs || []
    const bestConfig = panelConfigs.reduce((best, current) =>
      current.yearlyEnergyDcKwh > (best?.yearlyEnergyDcKwh || 0) ? current : best
    , panelConfigs[0] || null)

    // Get rooftop area
    const rooftopArea = solarData.solarPotential?.wholeRoofStats?.areaMeters2 || 0

    // Calculate capacity in kW (assuming 400W panels)
    let panelCount = bestConfig?.panelsCount || 0
    let capacityKw = panelCount * 0.4 // 400W per panel
    let estimated = false

    // If API didn't return a config, estimate a conservative potential from roof segments
    if (!panelCount && (solarData.solarPotential?.roofSegmentStats?.length || 0) > 0) {
      const metersPerDegLat = 111_320
      const lat = solarData.solarPotential?.roofSegmentStats?.[0]?.centerPoint?.latitude || 0
      const metersPerDegLng = Math.cos(lat * Math.PI / 180) * metersPerDegLat
      let usableAreaM2 = 0
      for (const seg of solarData.solarPotential!.roofSegmentStats!) {
        const sw = seg.boundingBox.sw; const ne = seg.boundingBox.ne
        const widthM = Math.abs(ne.longitude - sw.longitude) * metersPerDegLng
        const heightM = Math.abs(ne.latitude - sw.latitude) * metersPerDegLat
        const area = widthM * heightM * Math.max(Math.cos((seg.pitchDegrees || 0) * Math.PI/180), 0.5)
        usableAreaM2 += area * 0.5 // 50% packing/obstructions
      }
      panelCount = Math.max(0, Math.floor(usableAreaM2 / 1.8))
      capacityKw = Math.round(panelCount * 0.4 * 100) / 100
      estimated = true
    }

    // Extract roof segments for overlay visualization
    const roofSegments = (solarData.solarPotential?.roofSegmentStats || []).map((segment) => {
      // Derive center if missing
      const sw = segment.boundingBox.sw;
      const ne = segment.boundingBox.ne;
      const center = (segment as any).centerPoint || {
        latitude: (sw.latitude + ne.latitude) / 2,
        longitude: (sw.longitude + ne.longitude) / 2,
      };
      const halfWidthLng = Math.abs(ne.longitude - sw.longitude) / 2;
      const halfHeightLat = Math.abs(ne.latitude - sw.latitude) / 2;
      const angleRad = (segment.azimuthDegrees || 0) * Math.PI / 180;

      // Build a rotated rectangle polygon approximating the roof segment
      const polygon = [
        { dx: -halfWidthLng, dy: -halfHeightLat },
        { dx: halfWidthLng, dy: -halfHeightLat },
        { dx: halfWidthLng, dy: halfHeightLat },
        { dx: -halfWidthLng, dy: halfHeightLat },
      ].map(({ dx, dy }) => {
        const rx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const ry = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        return {
          latitude: center.latitude + ry,
          longitude: center.longitude + rx,
        };
      });

      return {
        centerPoint: center,
        boundingBox: segment.boundingBox,
        pitchDegrees: segment.pitchDegrees,
        azimuthDegrees: segment.azimuthDegrees,
        planeHeightAtCenterMeters: segment.planeHeightAtCenterMeters,
        polygon,
      };
    })

    // Get panel placement from roof segment summaries
    const panelPlacements = bestConfig?.roofSegmentSummaries?.map(summary => ({
      segmentIndex: summary.segmentIndex,
      panelsCount: summary.panelsCount,
      yearlyEnergyDcKwh: summary.yearlyEnergyDcKwh,
      pitchDegrees: summary.pitchDegrees,
      azimuthDegrees: summary.azimuthDegrees
    })) || []

    const responseData = {
      panel_count: panelCount,
      capacity_kw: Math.round(capacityKw * 100) / 100,
      rooftop_area_m2: Math.round(rooftopArea * 100) / 100,
      coordinates: { lat, lng },
      roof_segments: roofSegments,
      panel_placements: panelPlacements,
      yearly_energy_kwh: bestConfig?.yearlyEnergyDcKwh || 0,
      imagery_date: solarData.imagery?.date,
      imagery_quality: solarData.imagery?.quality,
      estimated
    }

    console.log('Solar analysis complete:', responseData)

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Solar analysis function error:', error)
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