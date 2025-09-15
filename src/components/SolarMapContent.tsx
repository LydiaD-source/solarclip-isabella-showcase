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

  useEffect(() => {
    if (!address) return;

    setLoading(true);
    setError(null);

    fetch(`/functions/v1/solar-map?address=${encodeURIComponent(address)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to fetch solar data");
        }
        return res.json();
      })
      .then((data) => {
        setSolarData({
          panel_count: data.panel_count ?? 0,
          capacity_kw: data.capacity_kw ?? 0,
          rooftop_area_m2: data.rooftop_area_m2 ?? 0,
          mapsUrl: data.mapsUrl ?? "",
          coordinates: data.coordinates ?? { lat: 0, lng: 0 },
          zoom: data.zoom ?? 20,
          size: data.size ?? "640x640",
        });
      })
      .catch((err) => {
        console.error("Solar API fetch error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return <div>Loading solar map...</div>;
  }

  if (error) {
    return <div>Error loading solar map: {error}</div>;
  }

  if (!solarData) {
    return <div>No solar data available.</div>;
  }

  return (
    <div className="solar-map-container" style={{ textAlign: "center" }}>
      {solarData.mapsUrl ? (
        <img
          src={solarData.mapsUrl}
          alt="Solar map"
          style={{ width: "100%", maxWidth: "640px", height: "auto" }}
        />
      ) : (
        <div>No map image available</div>
      )}
      <div className="solar-info" style={{ marginTop: "1rem" }}>
        <p>Estimated Panels: {solarData.panel_count}</p>
        <p>Capacity: {solarData.capacity_kw} kW</p>
        <p>Rooftop Area: {solarData.rooftop_area_m2} m²</p>
      </div>
    </div>
  );
};

export default SolarMapContent;
export { SolarMapContent };
