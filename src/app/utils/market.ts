export const PAKISTAN_CENTER = { lat: 30.3753, lng: 69.3451 };

// Approximate country bounding box used for hard validation.
export const PAKISTAN_BOUNDS = {
  minLat: 23.5,
  maxLat: 37.3,
  minLng: 60.8,
  maxLng: 77.9,
};

export const PAKISTAN_ERROR_MESSAGE = 'Service is only available within Pakistan';

export function isWithinPakistan(lat: number, lng: number) {
  return (
    lat >= PAKISTAN_BOUNDS.minLat &&
    lat <= PAKISTAN_BOUNDS.maxLat &&
    lng >= PAKISTAN_BOUNDS.minLng &&
    lng <= PAKISTAN_BOUNDS.maxLng
  );
}

export const CANCELLATION_REASONS = [
  'Driver is too far',
  'Driver asked to cancel',
  'Found another ride',
  'Personal reason',
  'Driver misconduct',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const DRIVER_COMPLAINT_REASONS = new Set<CancellationReason>([
  'Driver is too far',
  'Driver asked to cancel',
  'Driver misconduct',
]);

export type RideTypeId = 'bike' | 'mini' | 'ac_car' | 'premium' | 'courier';

export interface RideTypeConfig {
  id: RideTypeId;
  label: string;
  description: string;
  etaRange: string;
  minFare: number;
  baseFare: number;
  perKm: number;
}

export const RIDE_TYPES: RideTypeConfig[] = [
  {
    id: 'bike',
    label: 'Bike',
    description: 'Fast and economical for solo travel',
    etaRange: '2-5 min',
    minFare: 90,
    baseFare: 50,
    perKm: 16,
  },
  {
    id: 'mini',
    label: 'Mini',
    description: 'Economy car for daily commutes',
    etaRange: '3-7 min',
    minFare: 180,
    baseFare: 110,
    perKm: 24,
  },
  {
    id: 'ac_car',
    label: 'AC Car',
    description: 'Comfort ride with air conditioning',
    etaRange: '4-8 min',
    minFare: 230,
    baseFare: 140,
    perKm: 30,
  },
  {
    id: 'premium',
    label: 'Premium Car',
    description: 'High-end ride with top-rated drivers',
    etaRange: '6-10 min',
    minFare: 350,
    baseFare: 220,
    perKm: 42,
  },
  {
    id: 'courier',
    label: 'Courier Delivery',
    description: 'Send packages safely across the city',
    etaRange: '5-12 min',
    minFare: 140,
    baseFare: 80,
    perKm: 20,
  },
];

export function getRideType(id: RideTypeId | null | undefined) {
  return RIDE_TYPES.find((r) => r.id === id) || null;
}

export function calculateFare(rideType: RideTypeConfig, distanceKm: number) {
  const rawSuggested = Math.round(rideType.baseFare + distanceKm * rideType.perKm);
  const suggestedFare = Math.max(rideType.minFare, rawSuggested);
  const ramadanDiscountPercent = distanceKm > 10 ? 10 : 0;
  const discountedSuggestedFare =
    ramadanDiscountPercent > 0
      ? Math.max(rideType.minFare, Math.round(suggestedFare * 0.9))
      : suggestedFare;

  return {
    minimumFare: rideType.minFare,
    suggestedFare,
    ramadanDiscountPercent,
    discountedSuggestedFare,
  };
}