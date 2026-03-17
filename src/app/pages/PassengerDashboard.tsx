import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchServer, supabase } from '../utils/supabase';
import {
  Bike,
  Car,
  CarFront,
  Package,
  Crown,
  MapPin,
  Loader2,
  Navigation,
  Clock,
  Star,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Route,
  MoonStar,
  AlertCircle,
  LocateFixed,
  MapPinned,
  X,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { LocationSearch, type SelectedLocation } from '../components/LocationSearch';
import { RideMap } from '../components/RideMap';
import {
  CANCELLATION_REASONS,
  calculateFare,
  getRideType,
  isWithinPakistan,
  PAKISTAN_CENTER,
  PAKISTAN_ERROR_MESSAGE,
  RIDE_TYPES,
  type RideTypeId,
} from '../utils/market';
import 'leaflet/dist/leaflet.css';

const TRACKING_STALE_MS = 15 * 1000;

const RIDE_TYPE_ICONS: Record<RideTypeId, any> = {
  bike: Bike,
  mini: Car,
  ac_car: CarFront,
  premium: Crown,
  courier: Package,
};

export function PassengerDashboard() {
  const [user, setUser] = useState<any>(null);

  // Location state
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff'>('pickup');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapTarget, setMapTarget] = useState<'pickup' | 'dropoff'>('pickup');
  const [mapCoords, setMapCoords] = useState(PAKISTAN_CENTER);
  const [mapAddress, setMapAddress] = useState('');
  const [mapResolving, setMapResolving] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // Route / fare
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [selectedRideType, setSelectedRideType] = useState<RideTypeId | null>(null);

  // Ride state
  const [activeRide, setActiveRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [countdownRemainingSec, setCountdownRemainingSec] = useState<number | null>(null);
  const lastArrivalToastAtRef = useRef<string | null>(null);

  // Cancellation
  const [cancelReason, setCancelReason] = useState('');

  // UI
  const [bidsExpanded, setBidsExpanded] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const noAcceptToastShownRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) fetchMyActiveRide(user.id);
    });
  }, []);

  // Realtime websocket stream for ride updates
  useEffect(() => {
    if (!activeRide?.id) return;

    const channel = supabase
      .channel(`ride-stream-passenger-${activeRide.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kv_store_93f7752e',
          filter: `key=eq.ride:${activeRide.id}`,
        },
        (payload: any) => {
          const rideValue = payload?.new?.value;
          if (rideValue) {
            setActiveRide(rideValue);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRide?.id]);

  useEffect(() => {
    if (!activeRide?.arrivalNotifiedAt) return;
    if (lastArrivalToastAtRef.current === activeRide.arrivalNotifiedAt) return;

    lastArrivalToastAtRef.current = activeRide.arrivalNotifiedAt;
    toast.success('Your rider has arrived. Please be ready outside.');

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Driver Arrived', {
          body: 'Your rider has arrived. Please be ready outside.',
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [activeRide?.arrivalNotifiedAt]);

  useEffect(() => {
    if (!activeRide?.id) return;
    if (!['pending', 'negotiating'].includes(activeRide?.status)) return;
    if ((activeRide?.bids || []).length > 0) return;
    if (noAcceptToastShownRef.current === activeRide.id) return;

    const timer = setTimeout(() => {
      noAcceptToastShownRef.current = activeRide.id;
      toast.info('No driver has accepted yet. You can wait, adjust fare, or cancel and retry.');
    }, 45000);

    return () => clearTimeout(timer);
  }, [activeRide?.id, activeRide?.status, activeRide?.bids]);

  useEffect(() => {
    if (!activeRide?.approachCountdownStartedAt) {
      setCountdownRemainingSec(null);
      return;
    }

    const total = Number(activeRide?.approachCountdownSeconds || 300);
    const startedAt = new Date(activeRide.approachCountdownStartedAt).getTime();
    if (!Number.isFinite(startedAt)) {
      setCountdownRemainingSec(null);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      setCountdownRemainingSec(remaining);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeRide?.approachCountdownStartedAt, activeRide?.approachCountdownSeconds]);

  const fetchMyActiveRide = async (userId: string) => {
    try {
      const rides = await fetchServer(`/rides/user/${userId}?role=passenger`);
      const active = rides.find((r: any) => !['completed', 'cancelled'].includes(r.status));
      if (active) setActiveRide(active);
    } catch {}
  };

  const selectedRideTypeConfig = useMemo(() => getRideType(selectedRideType), [selectedRideType]);

  const fareBreakdown = useMemo(() => {
    if (!selectedRideTypeConfig || !distanceKm) return null;
    return calculateFare(selectedRideTypeConfig, distanceKm);
  }, [selectedRideTypeConfig, distanceKm]);

  const handleRouteData = useCallback((km: number, min: number) => {
    setDistanceKm(km);
    setDurationMin(min);

    if (selectedRideTypeConfig) {
      const fare = calculateFare(selectedRideTypeConfig, km);
      if (!offerPrice) setOfferPrice(String(fare.discountedSuggestedFare));
    }
  }, [offerPrice, selectedRideTypeConfig]);

  const handlePickupSelect = (loc: SelectedLocation) => {
    setPickupCoords({ lat: loc.lat, lng: loc.lng });
    setPickupText(loc.shortName);
  };

  const handleDropoffSelect = (loc: SelectedLocation) => {
    setDropoffCoords({ lat: loc.lat, lng: loc.lng });
    setDropoffText(loc.shortName);
  };

  const applyLocationForTarget = (target: 'pickup' | 'dropoff', loc: SelectedLocation) => {
    if (!isWithinPakistan(loc.lat, loc.lng)) {
      toast.error(PAKISTAN_ERROR_MESSAGE);
      return;
    }
    if (target === 'pickup') handlePickupSelect(loc);
    else handleDropoffSelect(loc);
  };

  const handleUseCurrentLocation = (target: 'pickup' | 'dropoff' = 'pickup') => {
    if (!navigator.geolocation) {
      toast.error('GPS is not supported on this device');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!isWithinPakistan(lat, lng)) {
          toast.error(PAKISTAN_ERROR_MESSAGE);
          setGpsLoading(false);
          return;
        }

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'ChaloChalein-App/1.0' },
          });
          const data = await res.json();
          const displayName = data?.display_name || `Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
          const shortName = String(displayName).split(',').slice(0, 2).join(',').trim();
          applyLocationForTarget(target, { lat, lng, displayName, shortName, countryCode: 'pk' });
          if (showMapPicker) {
            setShowMapPicker(false);
          }
        } catch {
          applyLocationForTarget(target, {
            lat,
            lng,
            displayName: `Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            shortName: `Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            countryCode: 'pk',
          });
          if (showMapPicker) {
            setShowMapPicker(false);
          }
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) toast.error('Location permission denied. Use search or map.');
        else if (error.code === error.TIMEOUT) toast.error('Location request timed out.');
        else toast.error('Unable to detect your location.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const openMapPicker = (target: 'pickup' | 'dropoff') => {
    setMapTarget(target);
    const base = target === 'pickup' ? pickupCoords : dropoffCoords;
    setMapCoords(base || PAKISTAN_CENTER);
    setMapAddress('');
    setShowMapPicker(true);
  };

  const reverseGeocodeMapCenter = async (lat: number, lng: number) => {
    setMapResolving(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'ChaloChalein-App/1.0' },
      });
      const data = await res.json();
      const cc = String(data?.address?.country_code || '').toLowerCase();
      if (cc && cc !== 'pk') {
        setMapAddress(PAKISTAN_ERROR_MESSAGE);
      } else {
        setMapAddress(data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setMapAddress('Unable to resolve address. Check internet and try again.');
    } finally {
      setMapResolving(false);
    }
  };

  useEffect(() => {
    if (!showMapPicker || !mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        maxBounds: [[23.5, 60.8], [37.3, 77.9]],
        maxBoundsViscosity: 1.0,
      }).setView([mapCoords.lat, mapCoords.lng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on('moveend', () => {
        const center = map.getCenter();
        setMapCoords({ lat: center.lat, lng: center.lng });
        reverseGeocodeMapCenter(center.lat, center.lng);
      });

      mapRef.current = map;
      reverseGeocodeMapCenter(mapCoords.lat, mapCoords.lng);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [showMapPicker]);

  const confirmMapLocation = () => {
    if (!isWithinPakistan(mapCoords.lat, mapCoords.lng)) {
      toast.error(PAKISTAN_ERROR_MESSAGE);
      return;
    }
    const displayName = mapAddress || `${mapCoords.lat.toFixed(5)}, ${mapCoords.lng.toFixed(5)}`;
    const shortName = displayName.split(',').slice(0, 2).join(',').trim();
    applyLocationForTarget(mapTarget, {
      lat: mapCoords.lat,
      lng: mapCoords.lng,
      displayName,
      shortName,
      countryCode: 'pk',
    });
    setShowMapPicker(false);
  };

  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pickupText || !dropoffText || !offerPrice || !pickupCoords || !dropoffCoords || !selectedRideType) {
      toast.error('Pickup, drop-off, ride type, and fare are required');
      return;
    }

    if (!fareBreakdown) {
      toast.error('Please wait for route and fare estimation');
      return;
    }

    if (Number(offerPrice) < fareBreakdown.minimumFare) {
      toast.error(`Minimum fare for selected ride type is PKR ${fareBreakdown.minimumFare}`);
      return;
    }

    setLoading(true);
    try {
      const newRide = await fetchServer('/rides', {
        method: 'POST',
        body: JSON.stringify({
          passengerId: user?.id,
          passengerName: user?.user_metadata?.name || 'Passenger',
          pickup: pickupText,
          dropoff: dropoffText,
          pickupCoords,
          dropoffCoords,
          distanceKm,
          durationMin,
          rideType: selectedRideType,
          minimumFare: fareBreakdown.minimumFare,
          suggestedFare: fareBreakdown.suggestedFare,
          ramadanDiscountPercent: fareBreakdown.ramadanDiscountPercent,
          discountedSuggestedFare: fareBreakdown.discountedSuggestedFare,
          offerPrice: Number(offerPrice),
        }),
      });

      setActiveRide(newRide);
      if ((newRide?.nearbyDrivers || []).length === 0) {
        toast.warning('Ride requested, but no nearby drivers are online right now. We will notify you as soon as one appears.');
      } else {
        toast.success('Ride requested! Nearby drivers are now viewing your request.');
      }
      setPickupText('');
      setDropoffText('');
      setOfferPrice('');
      setPickupCoords(null);
      setDropoffCoords(null);
      setDistanceKm(null);
      setDurationMin(null);
      setSelectedRideType(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ride');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bid: any) => {
    try {
      const ride = await fetchServer(`/rides/${activeRide.id}/accept-bid`, {
        method: 'POST',
        body: JSON.stringify({ bidId: bid.id, driverId: bid.driverId, finalPrice: bid.price }),
      });
      setActiveRide(ride);
      toast.success('Driver accepted! On the way.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept bid');
    }
  };

  const handleCancelRide = async () => {
    if (!cancelReason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    try {
      await fetchServer(`/rides/${activeRide.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'cancelled',
          cancelledBy: 'passenger',
          cancellationReason: cancelReason,
          actorUserId: user?.id,
        }),
      });
      setActiveRide(null);
      setCancelReason('');
      toast.success('Ride cancelled with reason recorded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const markNotificationRead = async (index: number) => {
    if (!activeRide?.id) return;

    const nextNotifications = [...(activeRide.notifications || [])];
    if (!nextNotifications[index] || nextNotifications[index].read) return;

    nextNotifications[index] = {
      ...nextNotifications[index],
      read: true,
      readAt: new Date().toISOString(),
    };
    setActiveRide({ ...activeRide, notifications: nextNotifications });

    try {
      await fetchServer(`/rides/${activeRide.id}/notifications/read`, {
        method: 'PATCH',
        body: JSON.stringify({ notificationIndexes: [index] }),
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark notification as read');
    }
  };

  const markAllNotificationsRead = async () => {
    if (!activeRide?.id) return;

    const nextNotifications = (activeRide.notifications || []).map((item: any) => ({
      ...item,
      read: true,
      readAt: item?.readAt || new Date().toISOString(),
    }));
    setActiveRide({ ...activeRide, notifications: nextNotifications });

    try {
      await fetchServer(`/rides/${activeRide.id}/notifications/read`, {
        method: 'PATCH',
        body: JSON.stringify({ markAll: true }),
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark all notifications as read');
    }
  };

  const isSearching = !activeRide;
  const hasRoute = !!pickupCoords && !!dropoffCoords;
  const bids = activeRide?.bids || [];
  const activities = activeRide?.driverActivities || [];
  const isNegotiating = activeRide?.status === 'pending' || activeRide?.status === 'negotiating';
  const isAccepted = ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(activeRide?.status);
  const isCompleted = activeRide?.status === 'completed';
  const isDriverArrived = activeRide?.status === 'driver_arrived';
  const trackingStage =
    activeRide?.status === 'in_progress'
      ? 'in_progress'
      : activeRide?.status === 'driver_arrived'
        ? 'arrived'
        : activeRide?.status === 'driver_en_route' || activeRide?.status === 'accepted'
          ? 'en_route'
          : null;
  const trackingStageLabel =
    trackingStage === 'in_progress'
      ? 'In Progress'
      : trackingStage === 'arrived'
        ? 'Arrived'
        : trackingStage === 'en_route'
          ? 'En Route'
          : null;
  const trackingStageClasses =
    trackingStage === 'in_progress'
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : trackingStage === 'arrived'
        ? 'bg-sky-100 text-sky-700 border-sky-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';
  const indexedNotifications = (activeRide?.notifications || []).map((item: any, idx: number) => ({
    ...item,
    _idx: idx,
  }));
  const rideNotifications = [...indexedNotifications].sort(
    (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const unreadNotifications = rideNotifications.filter((item: any) => !item?.read);

  const etaMin = Number(activeRide?.driverEtaMin || 0) || null;
  const driverLoc = activeRide?.driverLocation
    ? { lat: Number(activeRide.driverLocation.latitude), lng: Number(activeRide.driverLocation.longitude) }
    : null;
  const trackingAgeMs = activeRide?.driverLocationUpdatedAt
    ? Date.now() - new Date(activeRide.driverLocationUpdatedAt).getTime()
    : null;
  const trackingStale = typeof trackingAgeMs === 'number' && Number.isFinite(trackingAgeMs) && trackingAgeMs > TRACKING_STALE_MS;
  const countdownLabel = typeof countdownRemainingSec === 'number'
    ? `${Math.floor(countdownRemainingSec / 60)}:${String(countdownRemainingSec % 60).padStart(2, '0')}`
    : null;

  const hour = new Date().getHours();
  const isEvening = hour >= 17 || hour <= 4;

  return (
    <div className={`flex-1 flex flex-col lg:flex-row h-full overflow-hidden ${isEvening ? 'bg-slate-50' : ''}`}>
      <div className="w-full lg:w-[430px] xl:w-[470px] flex-shrink-0 bg-white border-r border-neutral-100 flex flex-col shadow-sm z-10">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-neutral-900">
              {isSearching ? 'Where to in Pakistan?' : isNegotiating ? 'Waiting for drivers' : isAccepted ? 'Ride confirmed' : 'Ride complete'}
            </h1>
            {activeRide && (
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Bell className="w-3.5 h-3.5" /> Alerts
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>
            )}
          </div>
          {user && (
            <p className="text-sm text-neutral-500 mt-0.5">
              Hi, {user.user_metadata?.name?.split(' ')[0] || 'there'}
            </p>
          )}

          <div className={`mt-3 rounded-xl border px-3 py-2.5 ${isEvening ? 'bg-emerald-950 text-emerald-50 border-emerald-900' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MoonStar className="w-4 h-4" /> Ramadan Kareem - Ride with Blessings
            </div>
            <p className={`text-xs mt-1 ${isEvening ? 'text-emerald-100' : 'text-emerald-700'}`}>
              Automatic 10% discount on rides over 10 km.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <form onSubmit={handleRequestRide} className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="space-y-1.5">
                  <div className="relative">
                    <LocationSearch
                      placeholder="Enter pickup location"
                      value={pickupText}
                      onChange={(text) => {
                        setPickupText(text);
                        setActiveField('pickup');
                        if (!text) {
                          setPickupCoords(null);
                          setDistanceKm(null);
                        }
                      }}
                      onSelect={(loc) => {
                        setActiveField('pickup');
                        applyLocationForTarget('pickup', loc);
                      }}
                      onError={(message) => toast.error(message || PAKISTAN_ERROR_MESSAGE)}
                      variant="pickup"
                      density="compact"
                    />
                    <button
                      type="button"
                      onClick={() => handleUseCurrentLocation('pickup')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-[11px] font-semibold rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center gap-1"
                      title="Use My Current Location"
                    >
                      {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 text-green-600" />}
                    </button>
                  </div>

                  <LocationSearch
                    placeholder="Where to?"
                    value={dropoffText}
                    onChange={(text) => {
                      setDropoffText(text);
                      setActiveField('dropoff');
                      if (!text) {
                        setDropoffCoords(null);
                        setDistanceKm(null);
                      }
                    }}
                    onSelect={(loc) => {
                      setActiveField('dropoff');
                      applyLocationForTarget('dropoff', loc);
                    }}
                    onError={(message) => toast.error(message || PAKISTAN_ERROR_MESSAGE)}
                    variant="dropoff"
                    density="compact"
                  />

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openMapPicker(activeField)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50"
                    >
                      <MapPinned className="w-4 h-4 text-blue-600" /> Choose on Map
                    </button>
                    <p className="text-[10px] text-neutral-500 tracking-wide uppercase">Pakistan only</p>
                  </div>
                </div>
              </div>

              {hasRoute && distanceKm && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-1.5 text-green-700 font-medium">
                    <Route className="w-3.5 h-3.5" />
                    {distanceKm} km
                  </div>
                  <div className="flex items-center gap-1.5 text-green-600">
                    <Clock className="w-3.5 h-3.5" />
                    ~{durationMin} min
                  </div>
                </motion.div>
              )}

              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-2">Select Ride Type</p>
                <div className="grid grid-cols-1 gap-2.5">
                  {RIDE_TYPES.map((rideType) => {
                    const Icon = RIDE_TYPE_ICONS[rideType.id];
                    const selected = selectedRideType === rideType.id;
                    const estimate = distanceKm ? calculateFare(rideType, distanceKm) : null;
                    return (
                      <button
                        key={rideType.id}
                        type="button"
                        onClick={() => {
                          setSelectedRideType(rideType.id);
                          if (distanceKm) {
                            const fare = calculateFare(rideType, distanceKm);
                            setOfferPrice(String(fare.discountedSuggestedFare));
                          }
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-all ${selected ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-neutral-200 hover:border-neutral-300'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selected ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">{rideType.label}</p>
                              <p className="text-xs text-neutral-500 mt-0.5">{rideType.description}</p>
                              <p className="text-xs text-neutral-500 mt-1">ETA: {rideType.etaRange}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-neutral-500">Min</p>
                            <p className="text-sm font-bold text-neutral-900">PKR {rideType.minFare}</p>
                            {estimate && (
                              <p className="text-xs text-green-700 mt-1">~PKR {estimate.discountedSuggestedFare}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Your Offer (PKR)</label>
                  {fareBreakdown && (
                    <button
                      type="button"
                      onClick={() => setOfferPrice(String(fareBreakdown.discountedSuggestedFare))}
                      className="text-xs text-green-600 font-medium flex items-center gap-1 hover:underline"
                    >
                      <Zap className="w-3 h-3" />
                      Use suggested PKR {fareBreakdown.discountedSuggestedFare}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-neutral-500 font-medium text-sm">PKR</span>
                  <input
                    type="number"
                    required
                    min={fareBreakdown?.minimumFare || 1}
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-xl text-xl font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g. 450"
                  />
                </div>
                {fareBreakdown && (
                  <div className="text-xs text-neutral-500 mt-1.5 space-y-1">
                    <p>Minimum fare: PKR {fareBreakdown.minimumFare}</p>
                    <p>Suggested fare: PKR {fareBreakdown.suggestedFare}</p>
                    {fareBreakdown.ramadanDiscountPercent > 0 && (
                      <p className="text-green-700 font-medium">
                        Ramadan discount ({fareBreakdown.ramadanDiscountPercent}%): PKR {fareBreakdown.discountedSuggestedFare}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !pickupText || !dropoffText || !offerPrice || !selectedRideType}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><Navigation className="w-5 h-5" /> Request Ride</>
                )}
              </button>
            </form>
          )}

          {activeRide && (
            <div className="p-5 space-y-4">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                isNegotiating ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : isAccepted ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}>
                {isNegotiating && <><Loader2 className="w-4 h-4 animate-spin" /> Broadcasting to nearby drivers...</>}
                {isAccepted && <><Navigation className="w-4 h-4" /> {isDriverArrived ? 'Driver has arrived' : 'Driver en route to pickup'}</>}
                {isCompleted && <><span>OK</span> Ride completed</>}
              </div>

              {trackingStageLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Trip status</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-500 ${trackingStageClasses}`}
                  >
                    {trackingStageLabel}
                  </span>
                </div>
              )}

              {isAccepted && (
                <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Live ETA</span>
                    <span className="font-semibold text-neutral-900">{etaMin ? `${etaMin} min` : 'Calculating...'}</span>
                  </div>
                  {countdownLabel && (
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-xs">
                      <span className="text-amber-700 font-medium">Approach timer</span>
                      <span className="font-bold text-amber-800">{countdownLabel}</span>
                    </div>
                  )}
                  {trackingStale && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      Live GPS signal is temporarily weak. Last driver update was a few moments ago; route and ETA will refresh automatically.
                    </div>
                  )}
                  {activeRide?.delayMinutes > 0 && (
                    <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">
                      Driver is delayed by ~{activeRide.delayMinutes} min. ETA and route are adjusted in real time.
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-xs text-neutral-600">
                    <Bell className="w-3.5 h-3.5 mt-0.5" />
                    <span>{activeRide?.userGuidance || 'Please stay near pickup and be ready when your driver arrives.'}</span>
                  </div>
                </div>
              )}

              {activeRide && notificationsOpen && (
                <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-neutral-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-neutral-800">Ride Notifications</p>
                    <button
                      type="button"
                      disabled={unreadNotifications.length === 0}
                      onClick={markAllNotificationsRead}
                      className="text-xs font-medium text-green-700 disabled:text-neutral-400"
                    >
                      Mark all read
                    </button>
                  </div>

                  {rideNotifications.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-neutral-500">No notifications yet.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto divide-y divide-neutral-100">
                      {rideNotifications.map((item: any) => (
                        <button
                          key={`${item.createdAt}-${item.message}-${item._idx}`}
                          type="button"
                          onClick={() => markNotificationRead(item._idx)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-neutral-50 transition-colors ${item.read ? 'bg-white' : 'bg-blue-50/60'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs ${item.read ? 'text-neutral-600' : 'text-neutral-800 font-medium'}`}>{item.message}</p>
                            {!item.read && <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-1">
                            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-white shrink-0" />
                  <div>
                    <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Pickup</p>
                    <p className="text-sm font-semibold text-neutral-800">{activeRide.pickup}</p>
                  </div>
                </div>
                <div className="ml-1.5 w-0.5 h-4 bg-neutral-200" />
                <div className="flex items-start gap-3">
                  <span className="mt-1 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white shrink-0" />
                  <div>
                    <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Drop-off</p>
                    <p className="text-sm font-semibold text-neutral-800">{activeRide.dropoff}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-neutral-200 flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Your offer</span>
                  <span className="text-lg font-bold text-neutral-900">PKR {activeRide.offerPrice}</span>
                </div>
                {activeRide.finalPrice && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-500">Agreed fare</span>
                    <span className="text-lg font-bold text-green-600">PKR {activeRide.finalPrice}</span>
                  </div>
                )}
              </div>

              {isNegotiating && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Cancellation reason (required)</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select reason</option>
                    {CANCELLATION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleCancelRide}
                    className="w-full py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors"
                  >
                    Cancel Ride
                  </button>
                </div>
              )}

              {isCompleted && (
                <button
                  onClick={() => setActiveRide(null)}
                  className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
                >
                  Book Another Ride
                </button>
              )}
            </div>
          )}

          {activeRide && isNegotiating && (
            <div className="border-t border-neutral-100">
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Nearby driver activity</p>
                {activities.length === 0 ? (
                  <p className="text-xs text-neutral-500 mt-1">No activity yet</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {activities.slice(0, 6).map((activity: any) => (
                      <div key={activity.driverId} className="flex items-center justify-between text-xs text-neutral-600 bg-white border border-neutral-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium">Driver {activity.driverId.slice(0, 6)}</span>
                        <span className="capitalize">{activity.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setBidsExpanded(!bidsExpanded)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${bids.length ? 'bg-green-500' : 'bg-amber-400'}`} />
                  {bids.length ? `${bids.length} Offer${bids.length > 1 ? 's' : ''} from Drivers` : 'Waiting for driver offers...'}
                </div>
                {bidsExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </button>

              <AnimatePresence>
                {bidsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {bids.length === 0 ? (
                      <div className="px-5 pb-5 flex flex-col items-center gap-3 text-center text-neutral-400">
                        <Loader2 className="w-7 h-7 animate-spin text-green-400" />
                        <p className="text-sm">Broadcasting your request to nearby drivers...</p>
                      </div>
                    ) : (
                      <div className="px-5 pb-5 space-y-3">
                        <AnimatePresence>
                          {bids.map((bid: any) => (
                            <motion.div
                              key={bid.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                                  <UserCircle className="w-6 h-6 text-neutral-400" />
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-900 text-sm">{bid.driverName || 'Driver'}</p>
                                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>4.8</span>
                                    <span>·</span>
                                    <span>2 min away</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xl font-bold text-neutral-900">PKR {bid.price}</span>
                                <button
                                  onClick={() => handleAcceptBid(bid)}
                                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                                >
                                  Accept
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {!showMapPicker && (
        <div className="flex-1 relative min-h-[300px] lg:min-h-0">
          <RideMap
            pickup={pickupCoords || activeRide?.pickupCoords}
            dropoff={dropoffCoords || activeRide?.dropoffCoords}
            driverLocation={driverLoc}
            driverRouteGeoJSON={activeRide?.driverRouteGeoJSON}
            onRouteData={handleRouteData}
            onValidationError={(message) => toast.error(message || PAKISTAN_ERROR_MESSAGE)}
            className="absolute inset-0 h-full w-full"
          />

          {!pickupCoords && !dropoffCoords && !activeRide && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-5 shadow-lg text-center max-w-xs">
                <MapPin className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-neutral-700">
                  Enter pickup and drop-off to see your route
                </p>
                <div className="mt-2 flex items-center justify-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5" /> Pakistan-only service area
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showMapPicker && (
        <div className="fixed inset-0 z-[120] bg-white flex flex-col">
          <div
            className="bg-white px-4 border-b border-neutral-200 flex items-center justify-between"
            style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
          >
            <div>
              <p className="text-sm font-semibold text-neutral-900">Select Location</p>
              <p className="text-xs text-neutral-500">Drag map under the pin</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMapPicker(false)}
              className="h-9 px-3 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>
          </div>

          <div className="relative flex-1">
            <div ref={mapContainerRef} className="absolute inset-0" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="-translate-y-4">
                <MapPin className="w-10 h-10 text-green-600 drop-shadow" fill="currentColor" />
              </div>
            </div>
          </div>

          <div
            className="bg-white border-t border-neutral-200 px-4 pt-3 space-y-2"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <div className="text-xs text-neutral-600 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 min-h-10 flex items-start gap-2">
              {mapResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5" /> : <MapPin className="w-3.5 h-3.5 mt-0.5 text-neutral-400" />}
              <span>{mapResolving ? 'Resolving address...' : (mapAddress || 'Move map to fetch address')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUseCurrentLocation(mapTarget)}
                className="py-2.5 rounded-xl border border-neutral-200 text-sm font-medium bg-white hover:bg-neutral-50 inline-flex items-center justify-center gap-1.5"
              >
                {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4 text-green-600" />}
                Use My Current Location
              </button>
              <button
                type="button"
                onClick={confirmMapLocation}
                className="py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
