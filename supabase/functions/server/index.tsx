import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono().basePath("/make-server-93f7752e");
app.use('*', logger(console.log));
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['*'],
  exposeHeaders: ['*'],
}));

// Setup Supabase Client helper
const getSupabase = () => {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return createClient(url, key);
};

// Helper: Authenticate user from x-user-token header
const getUserFromRequest = async (c: any) => {
  const userToken = c.req.header('x-user-token');
  if (!userToken) return null;
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(userToken);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
};

const toError = (message: string, status = 400) => ({ error: message, status });

const getRequestContext = async (c: any) => {
  const authUser = await getUserFromRequest(c);
  if (!authUser) return { error: toError('Unauthorized', 401) };
  if (!authUser.email_confirmed_at) return { error: toError('Email is not verified', 403) };

  const profile = await kv.get(`user:${authUser.id}`);
  if (!profile) return { error: toError('User profile not found', 404) };

  return {
    authUser,
    profile,
  };
};

const getClientSessionId = (c: any) => String(c.req.header('x-client-session-id') || '').trim();
const getSessionKey = (userId: string) => `user_session:${userId}`;

const assertRole = (profile: any, roles: string[]) => {
  if (!roles.includes(profile?.role)) {
    return toError('Forbidden', 403);
  }
  return null;
};

const PAKISTAN_BOUNDS = {
  minLat: 23.5,
  maxLat: 37.3,
  minLng: 60.8,
  maxLng: 77.9,
};

const PAKISTAN_ONLY_MESSAGE = 'Service is only available within Pakistan';

const RIDE_TYPES: Record<string, { minFare: number; baseFare: number; perKm: number }> = {
  bike: { minFare: 90, baseFare: 50, perKm: 16 },
  mini: { minFare: 180, baseFare: 110, perKm: 24 },
  ac_car: { minFare: 230, baseFare: 140, perKm: 30 },
  premium: { minFare: 350, baseFare: 220, perKm: 42 },
  courier: { minFare: 140, baseFare: 80, perKm: 20 },
};

const CANCELLATION_REASONS = new Set([
  'Driver is too far',
  'Driver asked to cancel',
  'Found another ride',
  'Personal reason',
  'Driver misconduct',
  'Session ended',
]);

const DRIVER_COMPLAINT_REASONS = new Set([
  'Driver is too far',
  'Driver asked to cancel',
  'Driver misconduct',
]);

const MATCHING_RADIUS_STEPS_KM = [5, 8, 10];
const DRIVER_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;
const APPROACH_COUNTDOWN_SECONDS = 5 * 60;
const ARRIVAL_ENTER_RADIUS_METERS = 25;
const ARRIVAL_EXIT_RADIUS_METERS = 75;
const ARRIVAL_HYSTERESIS_SECONDS = 90;
const ETA_DELAY_THRESHOLD_MIN = 3;
const CLIENT_SESSION_TTL_MS = 70 * 1000;

const isSessionRecordActive = (session: any, sessionId?: string) => {
  if (!session?.isActive) return false;
  if (sessionId && session.sessionId !== sessionId) return false;
  const ts = new Date(session.lastSeenAt || session.startedAt || 0).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= CLIENT_SESSION_TTL_MS;
};

const getAndValidateActiveSession = async (userId: string, sessionId?: string) => {
  const session = await kv.get(getSessionKey(userId));
  if (!session || !isSessionRecordActive(session, sessionId)) return null;
  return session;
};

const assertActiveClientSession = async (c: any, userId: string) => {
  const sessionId = getClientSessionId(c);
  if (!sessionId) return { error: toError('Active client session is required', 401) };
  const session = await getAndValidateActiveSession(userId, sessionId);
  if (!session) return { error: toError('Session expired or invalid. Please log in again.', 401) };
  return { session, sessionId };
};

const cancelRideAsSessionEnded = async (ride: any) => {
  if (!ride || ['cancelled', 'completed', 'in_progress'].includes(ride.status)) return ride;

  const nowIso = new Date().toISOString();
  const notifications = [...(ride.notifications || [])];
  notifications.push({
    type: 'session_ended',
    message: 'Ride request cancelled because the passenger session ended.',
    createdAt: nowIso,
    read: false,
  });

  const updated = {
    ...ride,
    status: 'cancelled',
    cancelledAt: nowIso,
    cancellation: {
      cancelledBy: 'system',
      reason: 'Session ended',
      at: nowIso,
    },
    notifications,
    updatedAt: nowIso,
  };

  await kv.set(`ride:${ride.id}`, updated);
  return updated;
};

const ensurePassengerSessionForRide = async (ride: any) => {
  const passengerId = ride?.passengerId;
  const passengerSessionId = ride?.passengerSessionId;
  if (!passengerId || !passengerSessionId) return true;

  const active = await getAndValidateActiveSession(passengerId, passengerSessionId);
  if (active) return true;

  await cancelRideAsSessionEnded(ride);
  return false;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isDriverStatusFresh = (updatedAt?: string) => {
  if (!updatedAt) return false;
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= DRIVER_LOCATION_MAX_AGE_MS;
};

const findNearbyOnlineDrivers = async (pickupLat: number, pickupLng: number) => {
  const driverStatuses = await kv.getByPrefix('driver_status:');
  const onlineWithCoords = (driverStatuses || [])
    .filter(
      (d: any) =>
        d?.isOnline &&
        d?.location?.latitude &&
        d?.location?.longitude &&
        isDriverStatusFresh(d?.updatedAt)
    )
    .map((d: any) => {
      const distanceKm = haversineKm(
        pickupLat,
        pickupLng,
        Number(d.location.latitude),
        Number(d.location.longitude)
      );
      return {
        driverId: d.driverId,
        location: d.location,
        updatedAt: d.updatedAt,
        distanceKm,
      };
    })
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  for (const radiusKm of MATCHING_RADIUS_STEPS_KM) {
    const matched = onlineWithCoords.filter((d: any) => d.distanceKm <= radiusKm);
    if (matched.length > 0) {
      return {
        radiusKm,
        drivers: matched,
      };
    }
  }

  return {
    radiusKm: MATCHING_RADIUS_STEPS_KM[MATCHING_RADIUS_STEPS_KM.length - 1],
    drivers: [],
  };
};

const fetchDrivingRoute = async (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;

    const withinPakistan = route.geometry.coordinates.every((coord: number[]) =>
      isWithinPakistan(Number(coord?.[1]), Number(coord?.[0]))
    );
    if (!withinPakistan) return null;

    return {
      distanceMeters: Number(route.distance || 0),
      durationSeconds: Number(route.duration || 0),
      geometry: route.geometry,
    };
  } catch {
    return null;
  }
};

const buildTrackingUpdate = async (
  ride: any,
  location: { latitude: number; longitude: number },
  options?: { gpsSignalLost?: boolean }
) => {
  const pickupLat = Number(ride?.pickupLatitude ?? ride?.pickupCoords?.lat);
  const pickupLng = Number(ride?.pickupLongitude ?? ride?.pickupCoords?.lng);

  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const driverLat = Number(location.latitude);
  const driverLng = Number(location.longitude);

  const route = await fetchDrivingRoute(driverLat, driverLng, pickupLat, pickupLng);
  const fallbackDistanceKm = haversineKm(driverLat, driverLng, pickupLat, pickupLng);
  const distanceMeters = route?.distanceMeters ?? Math.round(fallbackDistanceKm * 1000);
  const durationSeconds = route?.durationSeconds ?? Math.max(60, Math.round((fallbackDistanceKm / 28) * 3600));
  const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const previousEta = Number(ride?.driverEtaMin || 0);
  const delayIncreased = Number.isFinite(previousEta) && previousEta > 0 && etaMinutes - previousEta >= ETA_DELAY_THRESHOLD_MIN;
  const nowMs = Date.now();
  const stickyUntilMs = ride?.arrivalHysteresisUntil
    ? new Date(ride.arrivalHysteresisUntil).getTime()
    : 0;
  const wasArrived = ride?.status === 'driver_arrived';

  let hasArrived = distanceMeters <= ARRIVAL_ENTER_RADIUS_METERS;
  if (wasArrived) {
    hasArrived = distanceMeters <= ARRIVAL_EXIT_RADIUS_METERS || nowMs <= stickyUntilMs;
  }

  const nextStickyUntilIso = hasArrived
    ? new Date(nowMs + ARRIVAL_HYSTERESIS_SECONDS * 1000).toISOString()
    : null;

  const notifications = [...(ride.notifications || [])];
  if (hasArrived && !ride.arrivalNotifiedAt) {
    notifications.push({
      type: 'driver_arrived',
      message: 'Your rider has arrived. Please be ready outside.',
      createdAt: nowIso,
      read: false,
    });
  }
  if (delayIncreased) {
    notifications.push({
      type: 'driver_delay',
      message: `Driver ETA changed to ${etaMinutes} min due to route conditions.`,
      createdAt: nowIso,
      read: false,
    });
  }

  return {
    driverLocation: {
      latitude: driverLat,
      longitude: driverLng,
    },
    driverLocationUpdatedAt: nowIso,
    driverRouteGeoJSON: route?.geometry || ride?.driverRouteGeoJSON || null,
    driverDistanceToPickupMeters: distanceMeters,
    driverEtaMin: etaMinutes,
    trackingSignal: options?.gpsSignalLost ? 'degraded' : 'good',
    trackingLastSeenAt: nowIso,
    delayDetectedAt: delayIncreased ? nowIso : ride?.delayDetectedAt || null,
    delayMinutes: delayIncreased ? etaMinutes - previousEta : ride?.delayMinutes || 0,
    approachCountdownSeconds: APPROACH_COUNTDOWN_SECONDS,
    approachCountdownStartedAt:
      etaMinutes <= 5
        ? ride?.approachCountdownStartedAt || nowIso
        : ride?.approachCountdownStartedAt || null,
    arrivalHysteresisUntil: nextStickyUntilIso,
    arrivalNotifiedAt: hasArrived ? (ride?.arrivalNotifiedAt || nowIso) : ride?.arrivalNotifiedAt || null,
    userGuidance: hasArrived
      ? 'Your rider has arrived. Please be ready outside.'
      : 'Your driver is approaching. Please be outside and ready for pickup.',
    notifications,
    status: ride?.status === 'in_progress' ? 'in_progress' : (hasArrived ? 'driver_arrived' : 'driver_en_route'),
  };
};

const isWithinPakistan = (lat?: number, lng?: number) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= PAKISTAN_BOUNDS.minLat &&
    lat <= PAKISTAN_BOUNDS.maxLat &&
    lng >= PAKISTAN_BOUNDS.minLng &&
    lng <= PAKISTAN_BOUNDS.maxLng
  );
};

const calculateRidePricing = (rideType: string, distanceKm: number) => {
  const config = RIDE_TYPES[rideType];
  if (!config) return null;
  const suggestedFare = Math.max(config.minFare, Math.round(config.baseFare + config.perKm * distanceKm));
  const ramadanDiscountPercent = distanceKm > 10 ? 10 : 0;
  const discountedSuggestedFare =
    ramadanDiscountPercent > 0
      ? Math.max(config.minFare, Math.round(suggestedFare * (1 - ramadanDiscountPercent / 100)))
      : suggestedFare;

  return {
    minimumFare: config.minFare,
    suggestedFare,
    ramadanDiscountPercent,
    discountedSuggestedFare,
  };
};

const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const decodeBase64ToUint8Array = (base64String: string) => {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// ════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════

// Signup Route (email/password)
app.post('/auth/signup', async (c) => {
  try {
    const {
      email,
      password,
      name,
      role,
      phone,
      address,
      driverVerification,
      vehicleDetails,
    } = await c.req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase())) {
      return c.json({ error: 'A valid email is required' }, 400);
    }
    const supabase = getSupabase();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role, phone, address },
      email_confirm: false,
    });

    if (error) throw error;

    // Auto-create a user profile record in KV
    if (data.user) {
      const userProfile = {
        id: data.user.id,
        email,
        name,
        phone: phone || '',
        address: address || '',
        role: role || 'passenger',
        vehicleDetails: vehicleDetails || null,
        driverVerification:
          role === 'driver'
            ? {
                status: 'pending',
                submittedAt: new Date().toISOString(),
                cnicFrontUrl: driverVerification?.cnicFrontUrl || '',
                cnicBackUrl: driverVerification?.cnicBackUrl || '',
                licenseNumber: driverVerification?.licenseNumber || '',
                licenseExpiry: driverVerification?.licenseExpiry || '',
                vehiclePhotos: driverVerification?.vehiclePhotos || [],
                notes: '',
              }
            : null,
        createdAt: new Date().toISOString()
      };
      await kv.set(`user:${data.user.id}`, userProfile);
    }

    return c.json({ user: data.user });
  } catch (error: any) {
    console.error("Signup error:", error);
    return c.json({ error: error.message }, 400);
  }
});

app.post('/session/start', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const body = await c.req.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || getClientSessionId(c) || '').trim();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const nowIso = new Date().toISOString();
  await kv.set(getSessionKey(ctx.authUser.id), {
    userId: ctx.authUser.id,
    sessionId,
    isActive: true,
    startedAt: nowIso,
    lastSeenAt: nowIso,
  });

  return c.json({ ok: true, sessionId });
});

app.post('/session/heartbeat', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const body = await c.req.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || getClientSessionId(c) || '').trim();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const existing = await kv.get(getSessionKey(ctx.authUser.id));
  if (existing?.sessionId && existing.sessionId !== sessionId) {
    return c.json({ error: 'Session mismatch' }, 409);
  }

  const nowIso = new Date().toISOString();
  await kv.set(getSessionKey(ctx.authUser.id), {
    userId: ctx.authUser.id,
    sessionId,
    isActive: true,
    startedAt: existing?.startedAt || nowIso,
    lastSeenAt: nowIso,
  });

  return c.json({ ok: true, sessionId });
});

app.post('/session/end', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const body = await c.req.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || getClientSessionId(c) || '').trim();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const existing = await kv.get(getSessionKey(ctx.authUser.id));
  if (existing?.sessionId && existing.sessionId !== sessionId) {
    return c.json({ error: 'Session mismatch' }, 409);
  }

  const nowIso = new Date().toISOString();
  await kv.set(getSessionKey(ctx.authUser.id), {
    userId: ctx.authUser.id,
    sessionId,
    isActive: false,
    startedAt: existing?.startedAt || nowIso,
    lastSeenAt: nowIso,
    endedAt: nowIso,
  });

  if (ctx.profile.role === 'passenger') {
    const rides = await kv.getByPrefix('ride:');
    const activeRides = rides.filter((ride: any) =>
      ride?.passengerId === ctx.authUser.id &&
      ride?.passengerSessionId === sessionId &&
      ['pending', 'negotiating', 'accepted', 'driver_en_route', 'driver_arrived'].includes(ride?.status)
    );
    for (const ride of activeRides) {
      await cancelRideAsSessionEnded(ride);
    }
  }

  return c.json({ ok: true, sessionId });
});

// ════════════════════════════════════════
// USER ROUTES
// ════════════════════════════════════════

// User Profile Update
app.put('/users/:id', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const id = c.req.param('id');
  if (ctx.authUser.id !== id && ctx.profile.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updates = await c.req.json();
  const existing = await kv.get(`user:${id}`);

  if (!existing) {
    return c.json({ error: "User not found" }, 404);
  }

  const updatedUser = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(`user:${id}`, updatedUser);
  return c.json(updatedUser);
});

// Get User Profile
app.get('/users/:id', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const id = c.req.param('id');
  if (ctx.authUser.id !== id && ctx.profile.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const user = await kv.get(`user:${id}`);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

// ════════════════════════════════════════
// RIDE ROUTES
// ════════════════════════════════════════

// Create a new ride request (Passenger)
app.post('/rides', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['passenger']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);
    const sessionCheck = await assertActiveClientSession(c, ctx.authUser.id);
    if ('error' in sessionCheck) return c.json({ error: sessionCheck.error.message }, sessionCheck.error.status);

    const ride = await c.req.json();
    if (ride.passengerId !== ctx.authUser.id) {
      return c.json({ error: 'Forbidden passenger context' }, 403);
    }

    const pickup = ride?.pickupCoords;
    const dropoff = ride?.dropoffCoords;
    if (!isWithinPakistan(pickup?.lat, pickup?.lng) || !isWithinPakistan(dropoff?.lat, dropoff?.lng)) {
      return c.json({ error: PAKISTAN_ONLY_MESSAGE }, 400);
    }

    if (!ride.rideType || !RIDE_TYPES[ride.rideType]) {
      return c.json({ error: 'Ride type is required' }, 400);
    }

    const distanceKm = Number(ride?.distanceKm || 0);
    const pricing = calculateRidePricing(ride.rideType, distanceKm);
    if (!pricing) return c.json({ error: 'Invalid ride type' }, 400);

    const offered = Number(ride.offerPrice || 0);
    if (!offered || offered < pricing.minimumFare) {
      return c.json({ error: `Offer must be at least PKR ${pricing.minimumFare}` }, 400);
    }

    const { radiusKm, drivers } = await findNearbyOnlineDrivers(
      Number(pickup.lat),
      Number(pickup.lng)
    );
    const nearbyDrivers = drivers.slice(0, 25).map((d: any) => ({
      driverId: d.driverId,
      status: 'viewed your request',
      distanceKm: Math.round(d.distanceKm * 100) / 100,
      updatedAt: new Date().toISOString(),
    }));
    const hasNearbyDrivers = nearbyDrivers.length > 0;
    const createdAt = new Date().toISOString();

    const rideId = crypto.randomUUID();
    const newRide = {
      id: rideId,
      ...ride,
      passengerSessionId: sessionCheck.sessionId,
      pickupLatitude: Number(pickup.lat),
      pickupLongitude: Number(pickup.lng),
      matchingRadiusKm: radiusKm,
      minimumFare: pricing.minimumFare,
      suggestedFare: pricing.suggestedFare,
      discountedSuggestedFare: pricing.discountedSuggestedFare,
      ramadanDiscountPercent: pricing.ramadanDiscountPercent,
      hasNearbyDrivers,
      nearbyDrivers,
      driverActivities: nearbyDrivers,
      status: 'pending', // pending, negotiating, accepted, in_progress, completed, cancelled
      bids: [],
      notifications: hasNearbyDrivers
        ? []
        : [{
            type: 'no_drivers_available',
            message: 'No nearby drivers are currently online for this route. We will notify you when one appears.',
            createdAt,
            read: false,
          }],
      createdAt
    };

    await kv.set(`ride:${rideId}`, newRide);
    return c.json(newRide);
  } catch (err: any) {
    console.error("Create ride error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Get all pending/negotiating rides (for Drivers to see)
app.get('/rides', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
  const roleError = assertRole(ctx.profile, ['driver', 'admin']);
  if (roleError) return c.json({ error: roleError.message }, roleError.status);

  const driverId = c.req.query('driverId');
  const rides = await kv.getByPrefix('ride:');
  const activeRides = [];
  for (const ride of rides) {
    if (!['pending', 'negotiating'].includes(ride?.status)) continue;
    const sessionOk = await ensurePassengerSessionForRide(ride);
    if (sessionOk) activeRides.push(ride);
  }

  let visibleRides = activeRides;

  if (ctx.profile.role === 'driver') {
    if (!driverId) {
      return c.json({ error: 'driverId is required' }, 400);
    }
    if (ctx.authUser.id !== driverId) {
      return c.json({ error: 'Forbidden driver context' }, 403);
    }

    const status = await kv.get(`driver_status:${driverId}`);
    if (!status?.isOnline || !isDriverStatusFresh(status?.updatedAt)) {
      return c.json([]);
    }
    const driverLoc = status?.location;
    if (!driverLoc?.latitude || !driverLoc?.longitude) {
      return c.json([]);
    }

    visibleRides = activeRides
      .map((ride: any) => {
        const pLat = Number(ride.pickupLatitude ?? ride?.pickupCoords?.lat);
        const pLng = Number(ride.pickupLongitude ?? ride?.pickupCoords?.lng);
        if (!pLat || !pLng) return null;

        const distanceKm = haversineKm(
          Number(driverLoc.latitude),
          Number(driverLoc.longitude),
          pLat,
          pLng
        );
        const threshold = Number(ride.matchingRadiusKm || MATCHING_RADIUS_STEPS_KM[0]);
        if (distanceKm > threshold) return null;

        return {
          ...ride,
          driverDistanceKm: Math.round(distanceKm * 100) / 100,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.driverDistanceKm - b.driverDistanceKm);
  }

  if (driverId && ctx.profile.role === 'driver') {
    for (const ride of visibleRides) {
      const existing = (ride.driverActivities || []).find((a: any) => a.driverId === driverId);
      if (!existing) {
        ride.driverActivities = [
          ...(ride.driverActivities || []),
          { driverId, status: 'viewed your request', updatedAt: new Date().toISOString() },
        ];
      }
      await kv.set(`ride:${ride.id}`, ride);
    }
  }

  return c.json(visibleRides);
});

// Get rides for a specific user (Passenger or Driver)
app.get('/rides/user/:userId', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const userId = c.req.param('userId');
  if (ctx.authUser.id !== userId && ctx.profile.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const role = c.req.query('role'); // 'passenger' or 'driver'
  const rides = await kv.getByPrefix('ride:');

  const userRides = rides.filter((r: any) => {
    if (role === 'passenger') return r.passengerId === userId;
    if (role === 'driver') return r.driverId === userId || r.bids?.some((b: any) => b.driverId === userId);
    return false;
  });

  const sorted = [...userRides].sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return c.json(sorted);
});

// Get specific ride
app.get('/rides/:id', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const ride = await kv.get(`ride:${c.req.param('id')}`);
  if (!ride) return c.json({ error: "Ride not found" }, 404);

  const canAccess =
    ctx.profile.role === 'admin' ||
    ride.passengerId === ctx.authUser.id ||
    ride.driverId === ctx.authUser.id ||
    (ride.bids || []).some((b: any) => b.driverId === ctx.authUser.id);
  if (!canAccess) return c.json({ error: 'Forbidden' }, 403);

  return c.json(ride);
});

// Submit a bid/counter-offer (Driver)
app.post('/rides/:id/bids', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['driver']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const rideId = c.req.param('id');
    const bid = await c.req.json();
    if (bid.driverId !== ctx.authUser.id) return c.json({ error: 'Forbidden driver context' }, 403);

    const ride = await kv.get(`ride:${rideId}`);

    if (!ride) return c.json({ error: "Ride not found" }, 404);
    if (!(await ensurePassengerSessionForRide(ride))) {
      return c.json({ error: 'Ride request expired because passenger session ended' }, 409);
    }

    const driver = await kv.get(`user:${bid.driverId}`);
    const verificationStatus = driver?.driverVerification?.status;
    if (verificationStatus !== 'approved') {
      return c.json({ error: 'Driver account is not approved by admin yet' }, 403);
    }

    // Check if driver already bid — update their bid
    const existingBidIdx = (ride.bids || []).findIndex((b: any) => b.driverId === bid.driverId);
    const bidId = crypto.randomUUID();
    const newBid = { id: bidId, ...bid, createdAt: new Date().toISOString() };

    if (existingBidIdx >= 0) {
      ride.bids[existingBidIdx] = { ...ride.bids[existingBidIdx], ...bid, updatedAt: new Date().toISOString() };
    } else {
      ride.bids = [...(ride.bids || []), newBid];
    }

    ride.driverActivities = (ride.driverActivities || []).map((item: any) =>
      item.driverId === bid.driverId
        ? { ...item, status: 'sent offer', updatedAt: new Date().toISOString() }
        : item
    );

    ride.status = 'negotiating';
    await kv.set(`ride:${rideId}`, ride);
    return c.json(ride);
  } catch (err: any) {
    console.error("Submit bid error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Accept a bid (Passenger)
app.post('/rides/:id/accept-bid', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['passenger']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const rideId = c.req.param('id');
    const { bidId, driverId, finalPrice } = await c.req.json();
    const ride = await kv.get(`ride:${rideId}`);

    if (!ride) return c.json({ error: "Ride not found" }, 404);
    if (ride.passengerId !== ctx.authUser.id) return c.json({ error: 'Forbidden passenger context' }, 403);
    const sessionCheck = await assertActiveClientSession(c, ctx.authUser.id);
    if ('error' in sessionCheck) return c.json({ error: sessionCheck.error.message }, sessionCheck.error.status);
    if (ride.passengerSessionId && ride.passengerSessionId !== sessionCheck.sessionId) {
      return c.json({ error: 'Ride belongs to a previous session' }, 409);
    }

    // Get driver info
    const driver = await kv.get(`user:${driverId}`);

    ride.status = 'driver_en_route';
    ride.driverId = driverId;
    ride.driverName = driver?.name || 'Driver';
    ride.acceptedBidId = bidId;
    ride.finalPrice = finalPrice;
    ride.acceptedAt = new Date().toISOString();
    ride.driverActivities = (ride.driverActivities || []).map((item: any) =>
      item.driverId === driverId
        ? { ...item, status: 'accepted', updatedAt: new Date().toISOString() }
        : item
    );

    const driverStatus = await kv.get(`driver_status:${driverId}`);
    if (driverStatus?.location?.latitude && driverStatus?.location?.longitude) {
      const tracking = await buildTrackingUpdate(ride, driverStatus.location);
      if (tracking) {
        Object.assign(ride, tracking);
      }
    }

    await kv.set(`ride:${rideId}`, ride);
    return c.json(ride);
  } catch (err: any) {
    console.error("Accept bid error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Driver directly accepts a ride request and starts en-route tracking
app.post('/rides/:id/driver-accept', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['driver']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const rideId = c.req.param('id');
    const { driverId, finalPrice } = await c.req.json();
    if (!driverId || driverId !== ctx.authUser.id) {
      return c.json({ error: 'Forbidden driver context' }, 403);
    }

    if (ctx.profile?.driverVerification?.status !== 'approved') {
      return c.json({ error: 'Driver account is not approved by admin yet' }, 403);
    }

    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) return c.json({ error: 'Ride not found' }, 404);
    if (!(await ensurePassengerSessionForRide(ride))) {
      return c.json({ error: 'Ride request expired because passenger session ended' }, 409);
    }
    if (!['pending', 'negotiating', 'accepted', 'driver_en_route'].includes(ride.status)) {
      return c.json({ error: 'Ride is no longer available for acceptance' }, 409);
    }
    if (ride.driverId && ride.driverId !== driverId) {
      return c.json({ error: 'Ride already accepted by another driver' }, 409);
    }

    const driver = await kv.get(`user:${driverId}`);
    ride.status = 'driver_en_route';
    ride.driverId = driverId;
    ride.driverName = driver?.name || 'Driver';
    ride.finalPrice = Number(finalPrice || ride.offerPrice || 0);
    ride.acceptedAt = new Date().toISOString();
    ride.driverActivities = (ride.driverActivities || []).map((item: any) =>
      item.driverId === driverId
        ? { ...item, status: 'accepted', updatedAt: new Date().toISOString() }
        : item
    );

    const driverStatus = await kv.get(`driver_status:${driverId}`);
    if (driverStatus?.location?.latitude && driverStatus?.location?.longitude) {
      const tracking = await buildTrackingUpdate(ride, driverStatus.location);
      if (tracking) {
        Object.assign(ride, tracking);
      }
    }

    await kv.set(`ride:${rideId}`, ride);
    return c.json(ride);
  } catch (err: any) {
    console.error('Driver accept error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Update Ride Status (driver arrived, ride started, completed, cancelled)
app.put('/rides/:id/status', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

    const rideId = c.req.param('id');
    const { status, cancelledBy, cancellationReason } = await c.req.json();
    const ride = await kv.get(`ride:${rideId}`);

    if (!ride) return c.json({ error: "Ride not found" }, 404);
    if (!['completed', 'cancelled'].includes(status) && !(await ensurePassengerSessionForRide(ride))) {
      return c.json({ error: 'Ride request expired because passenger session ended' }, 409);
    }

    const isPassenger = ride.passengerId === ctx.authUser.id;
    const isAssignedDriver = ride.driverId === ctx.authUser.id;
    const isAdmin = ctx.profile.role === 'admin';

    if (!isPassenger && !isAssignedDriver && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (status === 'completed' && !isAssignedDriver && !isAdmin) {
      return c.json({ error: 'Only assigned driver can complete ride' }, 403);
    }

    if (status === 'cancelled' && !isPassenger && !isAdmin) {
      return c.json({ error: 'Only passenger can cancel ride' }, 403);
    }

    if (status === 'in_progress' && !isAssignedDriver && !isAdmin) {
      return c.json({ error: 'Only assigned driver can start trip' }, 403);
    }

    if (status === 'in_progress' && !['driver_arrived', 'driver_en_route', 'accepted'].includes(ride.status)) {
      return c.json({ error: 'Trip can only start after driver is en route/arrived' }, 409);
    }

    ride.status = status;
    ride.updatedAt = new Date().toISOString();

    if (status === 'in_progress') {
      ride.startedAt = ride.startedAt || new Date().toISOString();
      ride.userGuidance = 'Trip started. Enjoy your ride.';
    } else if (status === 'completed') {
      ride.completedAt = new Date().toISOString();
    } else if (status === 'cancelled') {
      if (!cancellationReason || !CANCELLATION_REASONS.has(cancellationReason)) {
        return c.json({ error: 'Valid cancellation reason is required' }, 400);
      }

      ride.cancelledAt = new Date().toISOString();
      ride.cancellation = {
        cancelledBy: cancelledBy || 'passenger',
        reason: cancellationReason,
        at: new Date().toISOString(),
      };

      if (DRIVER_COMPLAINT_REASONS.has(cancellationReason) && ride.driverId) {
        const driverStatsKey = `driver_stats:${ride.driverId}`;
        const driverStats = (await kv.get(driverStatsKey)) || {
          driverId: ride.driverId,
          demeritPoints: 0,
          complaints: [],
        };
        driverStats.demeritPoints += 1;
        driverStats.complaints = [
          ...(driverStats.complaints || []),
          {
            rideId,
            reason: cancellationReason,
            reportedAt: new Date().toISOString(),
          },
        ];
        await kv.set(driverStatsKey, driverStats);
      }

      const userIdToTrack = isPassenger ? ctx.authUser.id : ride.passengerId;
      if (userIdToTrack) {
        const cancellationStatsKey = `user_cancellation_stats:${userIdToTrack}`;
        const existingStats = (await kv.get(cancellationStatsKey)) || {
          userId: userIdToTrack,
          cancellations: [],
          suspicious: false,
        };
        const nowIso = new Date().toISOString();
        const recent = (existingStats.cancellations || []).filter((iso: string) => {
          return Date.now() - new Date(iso).getTime() <= 7 * 24 * 60 * 60 * 1000;
        });
        recent.push(nowIso);
        existingStats.cancellations = recent;
        existingStats.suspicious = recent.length >= 5;
        await kv.set(cancellationStatsKey, existingStats);
      }
    }

    await kv.set(`ride:${rideId}`, ride);
    return c.json(ride);
  } catch (err: any) {
    console.error("Update status error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Mark ride notifications as read (supports mark-all and selected indexes)
app.patch('/rides/:id/notifications/read', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

    const rideId = c.req.param('id');
    const { markAll, notificationIndexes } = await c.req.json();
    const ride = await kv.get(`ride:${rideId}`);

    if (!ride) return c.json({ error: 'Ride not found' }, 404);

    const canAccess =
      ctx.profile.role === 'admin' ||
      ride.passengerId === ctx.authUser.id ||
      ride.driverId === ctx.authUser.id;
    if (!canAccess) return c.json({ error: 'Forbidden' }, 403);

    const notifications = [...(ride.notifications || [])];
    if (!notifications.length) {
      return c.json({ notifications: [], unreadCount: 0 });
    }

    if (markAll) {
      for (let i = 0; i < notifications.length; i += 1) {
        notifications[i] = {
          ...notifications[i],
          read: true,
          readAt: notifications[i]?.readAt || new Date().toISOString(),
        };
      }
    } else if (Array.isArray(notificationIndexes)) {
      for (const idx of notificationIndexes) {
        const index = Number(idx);
        if (Number.isInteger(index) && index >= 0 && index < notifications.length) {
          notifications[index] = {
            ...notifications[index],
            read: true,
            readAt: notifications[index]?.readAt || new Date().toISOString(),
          };
        }
      }
    }

    ride.notifications = notifications;
    ride.updatedAt = new Date().toISOString();
    await kv.set(`ride:${rideId}`, ride);

    const unreadCount = notifications.filter((item: any) => !item?.read).length;
    return c.json({ notifications, unreadCount });
  } catch (err: any) {
    console.error('Mark notifications read error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ════════════════════════════════════════
// DRIVER ROUTES
// ════════════════════════════════════════

// Update driver online/offline status + optional location
app.post('/driver/status', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['driver']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);
    const sessionCheck = await assertActiveClientSession(c, ctx.authUser.id);
    if ('error' in sessionCheck) return c.json({ error: sessionCheck.error.message }, sessionCheck.error.status);

    const { driverId, isOnline, location } = await c.req.json();
    if (!driverId) return c.json({ error: "driverId required" }, 400);
    if (driverId !== ctx.authUser.id) return c.json({ error: 'Forbidden driver context' }, 403);

    if (ctx.profile?.driverVerification?.status !== 'approved') {
      return c.json({ error: 'Driver account is not approved by admin yet' }, 403);
    }

    if (isOnline) {
      const lat = Number(location?.latitude);
      const lng = Number(location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return c.json({ error: 'Current location is required to go online' }, 400);
      }
      if (!isWithinPakistan(lat, lng)) {
        return c.json({ error: PAKISTAN_ONLY_MESSAGE }, 400);
      }
    }

    const statusData = {
      driverId,
      isOnline,
      location: location || null,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`driver_status:${driverId}`, statusData);
    return c.json(statusData);
  } catch (err: any) {
    console.error("Driver status error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Driver pushes live GPS for assigned ride tracking
app.post('/rides/:id/driver-location', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['driver']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const rideId = c.req.param('id');
    const { driverId, location, gpsSignalLost } = await c.req.json();

    if (!driverId || driverId !== ctx.authUser.id) {
      return c.json({ error: 'Forbidden driver context' }, 403);
    }

    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) return c.json({ error: 'Ride not found' }, 404);
    if (ride.driverId !== driverId) {
      return c.json({ error: 'Only assigned driver can update ride location' }, 403);
    }
    if (!(await ensurePassengerSessionForRide(ride))) {
      return c.json({ error: 'Ride request expired because passenger session ended' }, 409);
    }

    let lat = Number(location?.latitude);
    let lng = Number(location?.longitude);

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && gpsSignalLost && ride?.driverLocation) {
      lat = Number(ride.driverLocation.latitude);
      lng = Number(ride.driverLocation.longitude);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return c.json({ error: 'Valid driver location is required' }, 400);
    }
    if (!isWithinPakistan(lat, lng)) {
      return c.json({ error: PAKISTAN_ONLY_MESSAGE }, 400);
    }

    const tracking = await buildTrackingUpdate(ride, { latitude: lat, longitude: lng }, { gpsSignalLost: Boolean(gpsSignalLost) });
    if (!tracking) {
      return c.json({ error: 'Ride pickup location is invalid' }, 400);
    }

    Object.assign(ride, tracking);
    ride.updatedAt = new Date().toISOString();
    await kv.set(`ride:${rideId}`, ride);

    await kv.set(`driver_status:${driverId}`, {
      driverId,
      isOnline: true,
      location: { latitude: lat, longitude: lng },
      updatedAt: new Date().toISOString(),
    });

    return c.json({
      ok: true,
      status: ride.status,
      driverEtaMin: ride.driverEtaMin,
      arrivalNotifiedAt: ride.arrivalNotifiedAt || null,
    });
  } catch (err: any) {
    console.error('Driver location tracking error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Update how a driver is interacting with a request
app.post('/rides/:id/driver-activity', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['driver']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);
    const sessionCheck = await assertActiveClientSession(c, ctx.authUser.id);
    if ('error' in sessionCheck) return c.json({ error: sessionCheck.error.message }, sessionCheck.error.status);

    const rideId = c.req.param('id');
    const { driverId, status } = await c.req.json();
    if (!driverId || !status) return c.json({ error: 'driverId and status are required' }, 400);
    if (driverId !== ctx.authUser.id) return c.json({ error: 'Forbidden driver context' }, 403);

    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) return c.json({ error: 'Ride not found' }, 404);

    const allowedStatuses = new Set(['viewed your request', 'considering', 'sent offer', 'accepted']);
    if (!allowedStatuses.has(status)) return c.json({ error: 'Invalid status' }, 400);

    const existing = (ride.driverActivities || []).find((item: any) => item.driverId === driverId);
    if (existing) {
      existing.status = status;
      existing.updatedAt = new Date().toISOString();
    } else {
      ride.driverActivities = [
        ...(ride.driverActivities || []),
        { driverId, status, updatedAt: new Date().toISOString() },
      ];
    }

    await kv.set(`ride:${rideId}`, ride);
    return c.json({ ok: true, driverActivities: ride.driverActivities || [] });
  } catch (err: any) {
    console.error('Driver activity update error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/rides/:id/nearby-drivers', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const ride = await kv.get(`ride:${c.req.param('id')}`);
  if (!ride) return c.json({ error: 'Ride not found' }, 404);

  const canAccess =
    ctx.profile.role === 'admin' ||
    ride.passengerId === ctx.authUser.id ||
    ride.driverId === ctx.authUser.id;
  if (!canAccess) return c.json({ error: 'Forbidden' }, 403);

  return c.json(ride.driverActivities || []);
});

// Get driver online status
app.get('/driver/:driverId/online-status', async (c) => {
  const ctx = await getRequestContext(c);
  if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

  const driverId = c.req.param('driverId');
  if (ctx.authUser.id !== driverId && ctx.profile.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const status = await kv.get(`driver_status:${driverId}`);
  return c.json(status || { driverId, isOnline: true });
});

// Get driver earnings summary
app.get('/driver/:driverId/earnings', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

    const driverId = c.req.param('driverId');
    if (ctx.authUser.id !== driverId && ctx.profile.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const rides = await kv.getByPrefix('ride:');

    const driverRides = rides.filter(
      (r: any) => r.driverId === driverId && r.status === 'completed'
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalEarned = driverRides.reduce((sum: number, r: any) => sum + (r.finalPrice || 0), 0);
    const todayEarned = driverRides
      .filter((r: any) => r.completedAt && new Date(r.completedAt) >= todayStart)
      .reduce((sum: number, r: any) => sum + (r.finalPrice || 0), 0);

    return c.json({
      total: totalEarned,
      today: todayEarned,
      rides: driverRides.length,
    });
  } catch (err: any) {
    console.error("Earnings error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// ════════════════════════════════════════
// MESSAGING ROUTES
// ════════════════════════════════════════

app.post('/uploads/document', async (c) => {
  try {
    const authUser = await getUserFromRequest(c);

    const {
      fileName,
      mimeType,
      fileBase64,
      category,
    } = await c.req.json();

    if (!fileName || !mimeType || !fileBase64 || !category) {
      return c.json({ error: 'fileName, mimeType, fileBase64, and category are required' }, 400);
    }
    if (!ALLOWED_UPLOAD_TYPES.has(mimeType)) {
      return c.json({ error: 'Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed' }, 400);
    }

    const bytes = decodeBase64ToUint8Array(fileBase64);
    if (bytes.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      return c.json({ error: 'File exceeds 5MB limit' }, 400);
    }

    const supabase = getSupabase();
    const bucketName = 'driver-documents';

    await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: `${MAX_UPLOAD_SIZE_BYTES}`,
    });

    const sanitizedCategory = String(category).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ownerSegment = authUser?.id || `anon-${crypto.randomUUID()}`;
    const path = `${ownerSegment}/${sanitizedCategory}/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return c.json({ error: uploadError.message }, 500);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signedUrlError) {
      return c.json({ error: signedUrlError.message }, 500);
    }

    return c.json({
      path,
      category: sanitizedCategory,
      mimeType,
      size: bytes.byteLength,
      signedUrl: signedUrlData?.signedUrl,
    });
  } catch (err: any) {
    console.error('Document upload error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Send a message
app.post('/messages/send', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

    const { rideId, senderId, senderName, text } = await c.req.json();
    if (!rideId || !senderId || !text) {
      return c.json({ error: "rideId, senderId, and text are required" }, 400);
    }
    if (senderId !== ctx.authUser.id) return c.json({ error: 'Forbidden sender context' }, 403);

    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) return c.json({ error: 'Ride not found' }, 404);
    const canAccess =
      ctx.profile.role === 'admin' ||
      ride.passengerId === ctx.authUser.id ||
      ride.driverId === ctx.authUser.id;
    if (!canAccess) return c.json({ error: 'Forbidden' }, 403);

    const msgId = crypto.randomUUID();
    const message = {
      id: msgId,
      rideId,
      senderId,
      senderName,
      text,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`message:${rideId}:${msgId}`, message);
    return c.json(message);
  } catch (err: any) {
    console.error("Send message error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Get messages for a ride
app.get('/messages/:rideId', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);

    const rideId = c.req.param('rideId');
    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) return c.json({ error: 'Ride not found' }, 404);
    const canAccess =
      ctx.profile.role === 'admin' ||
      ride.passengerId === ctx.authUser.id ||
      ride.driverId === ctx.authUser.id;
    if (!canAccess) return c.json({ error: 'Forbidden' }, 403);

    const messages = await kv.getByPrefix(`message:${rideId}:`);
    const sorted = [...messages].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return c.json(sorted);
  } catch (err: any) {
    console.error("Get messages error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// ════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════

// Get all users (admin only)
app.get('/admin/users', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['admin']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const users = await kv.getByPrefix('user:');
    return c.json(users);
  } catch (err: any) {
    console.error("Admin users error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Approve or reject a driver onboarding profile
app.put('/admin/drivers/:id/review', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['admin']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const driverId = c.req.param('id');
    const { status, notes } = await c.req.json();
    if (!['approved', 'rejected'].includes(status)) {
      return c.json({ error: 'status must be approved or rejected' }, 400);
    }

    const user = await kv.get(`user:${driverId}`);
    if (!user) return c.json({ error: 'Driver not found' }, 404);
    if (user.role !== 'driver') return c.json({ error: 'User is not a driver' }, 400);

    user.driverVerification = {
      ...(user.driverVerification || {}),
      status,
      notes: notes || '',
      reviewedAt: new Date().toISOString(),
    };

    await kv.set(`user:${driverId}`, user);
    return c.json(user);
  } catch (err: any) {
    console.error('Driver review error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Get all rides (admin only)
app.get('/admin/rides', async (c) => {
  try {
    const ctx = await getRequestContext(c);
    if ('error' in ctx) return c.json({ error: ctx.error.message }, ctx.error.status);
    const roleError = assertRole(ctx.profile, ['admin']);
    if (roleError) return c.json({ error: roleError.message }, roleError.status);

    const rides = await kv.getByPrefix('ride:');
    const sorted = [...rides].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json(sorted);
  } catch (err: any) {
    console.error("Admin rides error:", err);
    return c.json({ error: err.message }, 500);
  }
});

Deno.serve(app.fetch);
