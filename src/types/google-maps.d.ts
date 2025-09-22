declare global {
  interface Window {
    google: typeof google;
  }
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: HTMLElement, opts?: MapOptions);
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeId?: MapTypeId | string;
      tilt?: number;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      zoomControl?: boolean;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setPosition(latLng: LatLng | LatLngLiteral): void;
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: Function): void;
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
      icon?: MarkerIcon;
    }

    interface MarkerIcon {
      path: SymbolPath;
      scale: number;
      fillColor: string;
      fillOpacity: number;
      strokeWeight: number;
      strokeColor: string;
    }

    enum SymbolPath {
      CIRCLE = 'circle'
    }

    class Rectangle {
      constructor(opts?: RectangleOptions);
      addListener(eventName: string, handler: Function): void;
    }

    interface RectangleOptions {
      bounds?: LatLngBounds | LatLngBoundsLiteral;
      map?: Map;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }

    interface LatLngBoundsLiteral {
      north: number;
      south: number;
      east: number;
      west: number;
    }

    class LatLngBounds {
      constructor(sw?: LatLng, ne?: LatLng);
      getNorthEast(): LatLng;
      getSouthWest(): LatLng;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      setContent(content: string | HTMLElement): void;
      setPosition(position: LatLng | LatLngLiteral): void;
      open(map?: Map, anchor?: Marker): void;
      close(): void;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
      position?: LatLng | LatLngLiteral;
    }

    enum MapTypeId {
      HYBRID = 'hybrid',
      ROADMAP = 'roadmap',
      SATELLITE = 'satellite',
      TERRAIN = 'terrain'
    }
  }
}

export {};