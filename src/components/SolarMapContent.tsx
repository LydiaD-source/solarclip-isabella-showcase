import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SolarData = {
  panel_count: number;
  capacity_kw: number;
  rooftop_area_m2: number;
  mapsUrl: string;
  coordinates: { lat: number; lng: number };
  zoom: number;
  size: string;
};

interface SolarMapContentProps {
  address: string;
}

const SolarMapContent: React.FC<SolarMapContentProps> = ({ address }) => {
  const [solarData, setSolarData] = useState<SolarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setSolarData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('solar-map', {
          body: { address }
        });
        if (fnError) throw fnError;
        console.log('Solar analysis response:', data);
        setSolarData({
          panel_count: data?.panel_count ?? 0,
          capacity_kw: data?.capacity_kw ?? 0,
          rooftop_area_m2: data?.rooftop_area_m2 ?? 0,
          mapsUrl: data?.mapsUrl ?? "",
          coordinates: data?.coordinates ?? { lat: 0, lng: 0 },
          zoom: data?.zoom ?? 20,
          size: data?.size ?? "640x640",
        });
      } catch (e: any) {
        console.error("Solar API fetch error:", e);
        setError(e?.message || "Error loading solar data");
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  const panelCount = solarData?.panel_count ?? 0;
  const capacityKw = solarData?.capacity_kw ?? 0;
  const rooftopArea = solarData?.rooftop_area_m2 ?? 0;
  const mapUrl = solarData?.mapsUrl ?? "";

  const [displayUrl, setDisplayUrl] = useState<string>(mapUrl);
  useEffect(() => {
    setDisplayUrl(mapUrl);
  }, [mapUrl]);

  if (!mapUrl) {
    return null;
  }

  const projectRef = 'mzikfyqzwepnubdsclfd';

  return (
    <div className="solar-map-container" style={{ width: '100%', height: '400px' }}>
      <img
        key={displayUrl}
        src={displayUrl}
        alt="Solar map"
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
        loading="eager"
        onError={() => {
          if (!displayUrl.includes(`${projectRef}.supabase.co/functions/v1/solar-map-image`)) {
            const lat = solarData?.coordinates?.lat
            const lng = solarData?.coordinates?.lng
            let proxied = `https://${projectRef}.supabase.co/functions/v1/solar-map-image`;
            if (lat && lng) {
              proxied += `?lat=${lat}&lng=${lng}`
            } else if (address) {
              proxied += `?address=${encodeURIComponent(address)}`
            }
            console.warn('Falling back to proxied image URL:', proxied)
            setDisplayUrl(proxied)
            return
          }
          console.error('Failed to load mapsUrl:', displayUrl);
        }}
      />
      <div className="solar-info" style={{ marginTop: '1rem' }}>
        <p>Estimated Panels: {panelCount}</p>
        <p>Capacity: {capacityKw} kW</p>
        <p>Rooftop Area: {rooftopArea} m²</p>
      </div>
    </div>
  );
};

export default SolarMapContent;
export { SolarMapContent };
