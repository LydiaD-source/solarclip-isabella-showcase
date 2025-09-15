import React, { useEffect, useState } from "react";

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
  const [imgError, setImgError] = useState(false);
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
        const res = await fetch(`/functions/v1/solar-map?address=${encodeURIComponent(address)}`);
        if (!res.ok) {
          let message = "Failed to fetch solar data";
          try {
            const err = await res.json();
            message = err?.error || err?.message || message;
          } catch {}
          throw new Error(message);
        }
        const data = await res.json();
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

  // Safe derived values to avoid any undefined reads
  const panelCount = solarData?.panel_count ?? 0;
  const capacityKw = solarData?.capacity_kw ?? 0;
  const rooftopArea = solarData?.rooftop_area_m2 ?? 0;
  const mapUrl = solarData?.mapsUrl ?? "";
  
  // Reset image error when URL changes
  useEffect(() => {
    setImgError(false);
  }, [mapUrl]);
  if (loading) {
    return <div>Loading solar map...</div>;
  }

  // Show a graceful error but never crash the UI
  if (error && !mapUrl) {
    return <div>Error loading solar map: {error}</div>;
  }

  return (
    <div className="solar-map-container" style={{ width: "100%", height: "400px" }}>
      {mapUrl && !imgError ? (
        <img
          src={mapUrl}
          alt="Satellite view"
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Map could not be loaded
        </div>
      )}
      <div className="solar-info" style={{ marginTop: "1rem" }}>
        <p>Estimated Panels: {panelCount}</p>
        <p>Capacity: {capacityKw} kW</p>
        <p>Rooftop Area: {rooftopArea} m²</p>
      </div>
    </div>
  );
};

export default SolarMapContent;
export { SolarMapContent };
