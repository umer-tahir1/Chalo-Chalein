import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  isWithinPakistan,
  PAKISTAN_BOUNDS,
  PAKISTAN_CENTER,
  PAKISTAN_ERROR_MESSAGE,
} from '../utils/market';

export interface LatLng {
  lat: number;
  lng: number;
}

interface RideMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driverLocation?: LatLng | null;
  driverRouteGeoJSON?: any;
  className?: string;
  onRouteData?: (distanceKm: number, durationMin: number) => void;
  onValidationError?: (message: string) => void;
}

export function RideMap({
  pickup,
  dropoff,
  driverLocation,
  driverRouteGeoJSON,
  className = '',
  onRouteData,
  onValidationError,
}: RideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ pickup?: any; dropoff?: any; driver?: any; route?: any; driverRoute?: any }>({});
  const driverAnimFrameRef = useRef<number | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      const center = pickup || dropoff || PAKISTAN_CENTER;
      const map = L.map(containerRef.current, { zoomControl: false, maxBoundsViscosity: 1.0 }).setView(
        [center.lat, center.lng],
        6
      );

      map.setMaxBounds([
        [PAKISTAN_BOUNDS.minLat, PAKISTAN_BOUNDS.minLng],
        [PAKISTAN_BOUNDS.maxLat, PAKISTAN_BOUNDS.maxLng],
      ]);
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers + route
  useEffect(() => {
    if (!mapRef.current) {
      const timer = setTimeout(() => updateMarkersAndRoute(), 300);
      return () => clearTimeout(timer);
    }
    updateMarkersAndRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driverLocation?.lat, driverLocation?.lng, driverRouteGeoJSON]);

  async function updateMarkersAndRoute() {
    const map = mapRef.current;
    if (!map) return;

    if (pickup && !isWithinPakistan(pickup.lat, pickup.lng)) {
      onValidationError?.(PAKISTAN_ERROR_MESSAGE);
      return;
    }

    if (dropoff && !isWithinPakistan(dropoff.lat, dropoff.lng)) {
      onValidationError?.(PAKISTAN_ERROR_MESSAGE);
      return;
    }

    const L = (await import('leaflet')).default;

    // Helper: create circle div icon
    const circleIcon = (color: string, emoji?: string) =>
      L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:10px">${emoji || ''}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        className: '',
      });

    // Pickup marker
    if (pickup) {
      if (layersRef.current.pickup) {
        layersRef.current.pickup.setLatLng([pickup.lat, pickup.lng]);
      } else {
        layersRef.current.pickup = L.marker([pickup.lat, pickup.lng], {
          icon: circleIcon('#3b82f6'),
        })
          .addTo(map)
          .bindPopup('Pickup');
      }
    } else {
      if (layersRef.current.pickup) {
        map.removeLayer(layersRef.current.pickup);
        delete layersRef.current.pickup;
      }
    }

    // Dropoff marker
    if (dropoff) {
      if (layersRef.current.dropoff) {
        layersRef.current.dropoff.setLatLng([dropoff.lat, dropoff.lng]);
      } else {
        layersRef.current.dropoff = L.marker([dropoff.lat, dropoff.lng], {
          icon: circleIcon('#ef4444'),
        })
          .addTo(map)
          .bindPopup('Drop-off');
      }
    } else {
      if (layersRef.current.dropoff) {
        map.removeLayer(layersRef.current.dropoff);
        delete layersRef.current.dropoff;
      }
    }

    // Driver marker (smooth transition)
    if (driverLocation) {
      if (layersRef.current.driver) {
        const marker = layersRef.current.driver;
        const start = marker.getLatLng();
        const end = L.latLng(driverLocation.lat, driverLocation.lng);

        if (driverAnimFrameRef.current) {
          cancelAnimationFrame(driverAnimFrameRef.current);
          driverAnimFrameRef.current = null;
        }

        const startAt = performance.now();
        const durationMs = 1200;
        const tick = (t: number) => {
          const p = Math.min(1, (t - startAt) / durationMs);
          const eased = 1 - (1 - p) * (1 - p);
          const lat = start.lat + (end.lat - start.lat) * eased;
          const lng = start.lng + (end.lng - start.lng) * eased;
          marker.setLatLng([lat, lng]);
          if (p < 1) {
            driverAnimFrameRef.current = requestAnimationFrame(tick);
          }
        };

        driverAnimFrameRef.current = requestAnimationFrame(tick);
      } else {
        layersRef.current.driver = L.marker([driverLocation.lat, driverLocation.lng], {
          icon: circleIcon('#f59e0b', '🚗'),
        })
          .addTo(map)
          .bindPopup('Your Driver');
      }
    }

    if (driverRouteGeoJSON?.coordinates?.length) {
      if (layersRef.current.driverRoute) map.removeLayer(layersRef.current.driverRoute);
      layersRef.current.driverRoute = L.geoJSON(driverRouteGeoJSON, {
        style: { color: '#0ea5e9', weight: 5, opacity: 0.85, dashArray: '8,6' },
      }).addTo(map);
    } else if (layersRef.current.driverRoute) {
      map.removeLayer(layersRef.current.driverRoute);
      delete layersRef.current.driverRoute;
    }

    // Draw route + fit bounds
    if (pickup && dropoff) {
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes?.[0]) {
          const route = data.routes[0];
          const routeStaysInPakistan = (route.geometry?.coordinates || []).every(
            (coord: number[]) => isWithinPakistan(coord[1], coord[0])
          );
          if (!routeStaysInPakistan) {
            onValidationError?.(PAKISTAN_ERROR_MESSAGE);
            return;
          }

          if (layersRef.current.route) map.removeLayer(layersRef.current.route);
          layersRef.current.route = L.geoJSON(route.geometry, {
            style: { color: '#22c55e', weight: 5, opacity: 0.85 },
          }).addTo(map);

          onRouteData?.(
            Math.round((route.distance / 1000) * 10) / 10,
            Math.round(route.duration / 60)
          );
        }
      } catch {
        // Fallback straight line
        if (layersRef.current.route) map.removeLayer(layersRef.current.route);
        layersRef.current.route = L.polyline(
          [
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ],
          { color: '#22c55e', weight: 4, dashArray: '10,8' }
        ).addTo(map);

        // Haversine fallback distance
        const R = 6371;
        const dLat = ((dropoff.lat - pickup.lat) * Math.PI) / 180;
        const dLng = ((dropoff.lng - pickup.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((pickup.lat * Math.PI) / 180) *
            Math.cos((dropoff.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        onRouteData?.(Math.round(dist * 10) / 10, Math.round((dist / 40) * 60));
      }

      const fitPoints: [number, number][] = [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ];
      if (driverLocation) fitPoints.push([driverLocation.lat, driverLocation.lng]);

      map.fitBounds(fitPoints, { padding: [60, 60], maxZoom: 15 });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14);
    }
  }

  useEffect(() => {
    return () => {
      if (driverAnimFrameRef.current) {
        cancelAnimationFrame(driverAnimFrameRef.current);
        driverAnimFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ minHeight: '260px' }}
    />
  );
}
