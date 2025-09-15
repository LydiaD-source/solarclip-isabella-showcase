import React, { useEffect, useState } from 'react';

interface SolarMapContentProps {
  card?: {
    content?: any;
  };
  onAction?: (action: string, data?: any) => void;
}

// Minimal shape expected from the API
type SolarData = {
  panel_count?: number;
  capacity_kw?: number;
  rooftop_area_m2?: number;
  mapsUrl?: string;
  summary?: {
    annual_kwh?: number;
    roof_area?: number;
    panel_count?: number;
    co2_saved?: number;
    address?: string;
  };
};

export const SolarMapContent = ({ card, onAction }: SolarMapContentProps) => {
  // Local state with safe defaults
  const [solarData, setSolarData] = useState<SolarData | undefined>(card?.content ?? undefined);
  const [loading, setLoading] = useState<boolean>(!card?.content);
  const [error, setError] = useState<string | null>(null);

  // Fetch logic (non-blocking). If content provided via props, we use it; otherwise we try fetching.
  useEffect(() => {
    let isActive = true;

    const initFromProps = () => {
      // Always safely set from props if available
      if (card?.content) {
        setSolarData(card.content as SolarData);
        setLoading(false);
        setError(null);
        return true;
      }
      return false;
    };

    const fetchFromApi = async () => {
      try {
        setLoading(true);
        setError(null);

        // Prefer an explicit apiUrl passed in content; otherwise try a conventional edge function path.
        const apiUrl: string = (card as any)?.content?.apiUrl || '/functions/v1/solar-map';

        // Do not block rendering if this fails; we'll just show a graceful fallback.
        const res = await fetch(apiUrl).catch(() => undefined);
        if (!res || !res.ok) throw new Error('Request failed');

        const data = (await res.json()) as SolarData;
        if (!isActive) return;
        setSolarData(data);
      } catch (e) {
        if (!isActive) return;
        console.warn('Solar map fetch error (non-blocking):', e);
        setError('Map unavailable');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    // Prefer props; otherwise try fetching once.
    if (!initFromProps()) {
      fetchFromApi();
    }

    return () => {
      isActive = false;
    };
  }, [card?.content]);

  // Safe derived reads using optional chaining and defaults
  const panelCount = solarData?.panel_count ?? solarData?.summary?.panel_count ?? 0;
  const capacityKw = solarData?.capacity_kw ?? 0;
  const rooftopArea = solarData?.rooftop_area_m2 ?? solarData?.summary?.roof_area ?? 0;
  const mapUrl = solarData?.mapsUrl ?? '';
  const annualKwh = solarData?.summary?.annual_kwh ?? 0;

  // Loading fallback
  if (!solarData && loading) return <div>Loading solar map...</div>;

  return (
    <div className="space-y-4">
      {/* Explicit container dimensions so image is visible */}
      <div
        style={{ width: '100%', height: '400px' }}
        className="relative bg-muted rounded-lg overflow-hidden border"
      >
        {mapUrl ? (
          <img
            src={mapUrl}
            alt="Solar map"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={() => setError('Map unavailable')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {error || 'Map unavailable'}
          </div>
        )}

        {/* Non-blocking overlay with current stats (safe values) */}
        {mapUrl && (
          <div className="absolute top-2 left-2 bg-background/90 px-2 py-1 rounded-md shadow-sm">
            <div className="text-xs font-medium">{panelCount} panels</div>
            <div className="text-xs text-muted-foreground">{annualKwh.toLocaleString()} kWh/yr</div>
          </div>
        )}
      </div>

      {/* Safe stats grid; never crashes even if values are missing */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-2">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Panels:</strong><br />
            {panelCount}
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Capacity:</strong><br />
            {capacityKw} kW
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Roof Area:</strong><br />
            {rooftopArea} m²
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Address:</strong><br />
            {solarData?.summary?.address ?? ''}
          </p>
        </div>
      </div>

      {/* Optional CTA, kept non-blocking and safe */}
      <div className="space-y-2">
        <button
          className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground"
          onClick={() =>
            onAction?.('request_quote', {
              panel_count: panelCount,
              annual_kwh: annualKwh,
              address: solarData?.summary?.address ?? '',
            })
          }
        >
          Get Quote
        </button>
      </div>
    </div>
  );
};