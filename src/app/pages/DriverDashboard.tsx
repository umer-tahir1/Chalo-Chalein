import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchServer, supabase } from '../utils/supabase';
import {
  MapPin, Navigation, Clock, Loader2, CheckCircle, RefreshCcw,
  Banknote, UserCircle, Star, Wifi, WifiOff, TrendingUp, Bell,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { RideMap } from '../components/RideMap';
import { Link } from 'react-router';

export function DriverDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [myRides, setMyRides] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ today: 0, total: 0, rides: 0 });
  const [loading, setLoading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [iftarReminder, setIftarReminder] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationPushAtRef = useRef<number>(0);
  const activeRideRef = useRef<any>(null);

  // Bidding
  const [biddingRideId, setBiddingRideId] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchProfile(user.id);
        fetchRides(user.id);
        fetchEarnings(user.id);
        fetchDriverStatus(user.id);
      }
    });
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const profile = await fetchServer(`/users/${userId}`);
      const status = profile?.driverVerification?.status || 'pending';
      setVerificationStatus(status);
    } catch {}
  };

  // Realtime websocket stream for ride updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`ride-stream-driver-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kv_store_93f7752e',
        },
        (payload: any) => {
          const key = payload?.new?.key || payload?.old?.key;
          if (!key || !String(key).startsWith('ride:')) return;
          fetchRides(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchDriverStatus = async (userId: string) => {
    try {
      const status = await fetchServer(`/driver/${userId}/online-status`);
      if (status?.isOnline !== undefined) setIsOnline(status.isOnline);
    } catch {}
  };

  const fetchRides = useCallback(async (userId: string) => {
    try {
      const [allActive, mine] = await Promise.all([
        fetchServer(`/rides?driverId=${userId}`),
        fetchServer(`/rides/user/${userId}?role=driver`),
      ]);
      setAvailableRides(allActive);
      setMyRides(mine);
    } catch (err) {
      console.error('fetchRides error:', err);
    }
  }, []);

  const fetchEarnings = async (userId: string) => {
    try {
      const data = await fetchServer(`/driver/${userId}/earnings`);
      if (data) setEarnings(data);
    } catch {}
  };

  const pushDriverLocation = useCallback(async (coords: { latitude: number; longitude: number }) => {
    if (!user || !isOnline) return;
    const now = Date.now();
    if (now - lastLocationPushAtRef.current < 5000) return;
    lastLocationPushAtRef.current = now;

    try {
      await fetchServer('/driver/status', {
        method: 'POST',
        body: JSON.stringify({
          driverId: user.id,
          isOnline: true,
          location: coords,
        }),
      });

      const liveRide = activeRideRef.current;
      if (liveRide?.id && liveRide?.driverId === user.id) {
        await fetchServer(`/rides/${liveRide.id}/driver-location`, {
          method: 'POST',
          body: JSON.stringify({
            driverId: user.id,
            location: coords,
          }),
        });
      }
    } catch (err) {
      console.error('pushDriverLocation error:', err);
    }
  }, [user?.id, isOnline]);

  useEffect(() => {
    activeRideRef.current = myRides.find((r) =>
      ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(r.status)
    ) || null;
  }, [myRides]);

  useEffect(() => {
    if (!user || !isOnline || verificationStatus !== 'approved') return;
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setDriverLocation(next);
        pushDriverLocation(next);
      },
      (err) => {
        console.error('driver geolocation watch error:', err);
        const liveRide = activeRideRef.current;
        if (liveRide?.id && user?.id && driverLocation) {
          fetchServer(`/rides/${liveRide.id}/driver-location`, {
            method: 'POST',
            body: JSON.stringify({
              driverId: user.id,
              location: driverLocation,
              gpsSignalLost: true,
            }),
          }).catch(() => {});
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [user?.id, isOnline, verificationStatus, pushDriverLocation]);

  const toggleOnlineStatus = async () => {
    if (!user) return;
    if (verificationStatus !== 'approved') {
      toast.error('Your driver profile is not approved by admin yet');
      return;
    }

    setTogglingStatus(true);
    const newStatus = !isOnline;
    try {
      let locationPayload: any = null;
      if (newStatus && navigator.geolocation) {
        locationPayload = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
          );
        });
        if (locationPayload) setDriverLocation(locationPayload);
      }

      await fetchServer('/driver/status', {
        method: 'POST',
        body: JSON.stringify({ driverId: user.id, isOnline: newStatus, location: locationPayload }),
      });
      setIsOnline(newStatus);
      toast.success(newStatus ? "You're now online 🟢" : "You're now offline 🔴");
      if (newStatus) fetchRides(user.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setTogglingStatus(false);
    }
  };

  const submitBid = async (rideId: string, price: number) => {
    if (!price) return;
    if (verificationStatus !== 'approved') {
      toast.error('Only approved drivers can send offers');
      return;
    }

    setLoading(true);
    try {
      await fetchServer(`/rides/${rideId}/driver-activity`, {
        method: 'POST',
        body: JSON.stringify({ driverId: user?.id, status: 'sent offer' }),
      });

      await fetchServer(`/rides/${rideId}/bids`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: user?.id,
          driverName: user?.user_metadata?.name || 'Driver',
          price,
        }),
      });
      toast.success('Offer sent to passenger!');
      setBiddingRideId(null);
      setBidPrice('');
      if (user) fetchRides(user.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit bid');
    } finally {
      setLoading(false);
    }
  };

  const acceptOffer = async (ride: any) => {
    if (!user) return;
    if (verificationStatus !== 'approved') {
      toast.error('Only approved drivers can accept ride offers');
      return;
    }

    setLoading(true);
    try {
      await fetchServer(`/rides/${ride.id}/driver-accept`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: user.id,
          finalPrice: ride.offerPrice,
        }),
      });
      toast.success('Offer accepted. You are now en route to pickup.');
      await fetchRides(user.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept offer');
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId: string) => {
    try {
      await fetchServer(`/rides/${rideId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'completed' }),
      });
      toast.success('Ride completed! 🎉');
      if (user) {
        fetchRides(user.id);
        fetchEarnings(user.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete ride');
    }
  };

  const startTrip = async (rideId: string) => {
    try {
      await fetchServer(`/rides/${rideId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      toast.success('Trip started. Status is now In Progress.');
      if (user) fetchRides(user.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start trip');
    }
  };

  const activeMyRide = myRides.find((r) =>
    ['accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(r.status)
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row lg:h-full lg:overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="w-full lg:w-[420px] flex-shrink-0 bg-white border-r border-neutral-100 flex flex-col shadow-sm z-10">

        {/* Header + Status Toggle */}
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Driver Dashboard</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                {user?.user_metadata?.name || 'Welcome back'}
              </p>
            </div>
            {/* Online / Offline toggle */}
            <button
              onClick={toggleOnlineStatus}
              disabled={togglingStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm border ${
                isOnline
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {togglingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isOnline ? (
                <><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" /></span>Online</>
              ) : (
                <><WifiOff className="w-3.5 h-3.5" />Offline</>
              )}
            </button>
          </div>

          {verificationStatus !== 'approved' && (
            <div className={`text-xs rounded-xl border px-3 py-2 ${verificationStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              Driver onboarding status: <span className="font-semibold capitalize">{verificationStatus}</span>. You can go online after admin approval.
            </div>
          )}

          {/* Earnings strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Today's Earnings", value: `₨${earnings.today}`, icon: Banknote },
              { label: 'Total Earned', value: `₨${earnings.total}`, icon: TrendingUp },
              { label: 'Rides Done', value: String(earnings.rides), icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-neutral-50 rounded-xl p-3 text-center border border-neutral-100">
                <p className="text-xs text-neutral-500 font-medium truncate">{label}</p>
                <p className="text-base font-bold text-neutral-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {driverLocation && (
            <p className="text-[11px] text-neutral-500">
              Live location: {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ─ Active ride card ─ */}
          {activeMyRide && (
            <div className="p-5">
              <div className="bg-green-50 border border-green-200 rounded-2xl overflow-hidden">
                <div className="px-5 pt-4 pb-3 bg-green-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4" />
                      <span className="font-semibold text-sm">Active Ride</span>
                    </div>
                    <span className="text-xl font-bold">₨{activeMyRide.finalPrice}</span>
                  </div>
                  <p className="text-green-100 text-xs mt-1">{activeMyRide.passengerName || 'Passenger'}</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white shrink-0" />
                    <div>
                      <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Pickup</p>
                      <p className="text-sm font-medium text-neutral-800">{activeMyRide.pickup}</p>
                    </div>
                  </div>
                  <div className="ml-1 w-0.5 h-3 bg-neutral-200" />
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white shrink-0" />
                    <div>
                      <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Drop-off</p>
                      <p className="text-sm font-medium text-neutral-800">{activeMyRide.dropoff}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <a
                      href={activeMyRide.dropoffCoords
                        ? `https://www.google.com/maps/dir/?api=1&destination=${activeMyRide.dropoffCoords.lat},${activeMyRide.dropoffCoords.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeMyRide.dropoff)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 bg-white border border-neutral-200 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-50 transition-colors"
                    >
                      <Navigation className="w-4 h-4" /> Navigate
                    </a>

                    {activeMyRide.status === 'driver_arrived' ? (
                      <button
                        onClick={() => startTrip(activeMyRide.id)}
                        className="flex items-center justify-center gap-2 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 shadow-sm transition-colors"
                      >
                        <Navigation className="w-4 h-4" /> Start Trip
                      </button>
                    ) : (
                      <button
                        onClick={() => completeRide(activeMyRide.id)}
                        className="flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 shadow-sm transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ Available rides ─ */}
          {!activeMyRide && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-700 uppercase tracking-wide">
                  {isOnline ? 'Nearby Requests' : 'Go Online to Receive Rides'}
                </h2>
                {isOnline && (
                  <button
                    onClick={() => user && fetchRides(user.id)}
                    className="text-green-600 hover:text-green-700"
                    title="Refresh"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!isOnline ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
                    <WifiOff className="w-8 h-8 text-neutral-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-700">You're offline</p>
                    <p className="text-sm text-neutral-500 mt-1">Toggle online to see ride requests</p>
                  </div>
                  <button
                    onClick={toggleOnlineStatus}
                    className="mt-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-sm"
                  >
                    Go Online
                  </button>
                </div>
              ) : availableRides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
                    <RefreshCcw className="w-8 h-8 text-neutral-300 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-700">No requests nearby</p>
                    <p className="text-sm text-neutral-500 mt-1">Stay online — new requests auto-refresh</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence>
                  {availableRides.map((ride) => {
                    const myBid = ride.bids?.find((b: any) => b.driverId === user?.id);
                    return (
                      <motion.div
                        key={ride.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm"
                      >
                        {/* Ride header */}
                        <div className="px-4 pt-4 pb-3 border-b border-neutral-100">
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              ride.status === 'negotiating'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {ride.status === 'negotiating' ? '⚡ Negotiating' : '🆕 New Request'}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-neutral-400">
                              <Clock className="w-3.5 h-3.5" /> Just now
                            </span>
                          </div>
                          {/* Route */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white shrink-0" />
                              <p className="text-sm font-medium text-neutral-800 truncate">{ride.pickup}</p>
                            </div>
                            <div className="ml-1 w-0.5 h-3 bg-neutral-200" />
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white shrink-0" />
                              <p className="text-sm font-medium text-neutral-800 truncate">{ride.dropoff}</p>
                            </div>
                          </div>
                        </div>

                        {/* Fare + actions */}
                        <div className="px-4 pb-4 pt-3 bg-neutral-50">
                          {ride.rideType && (
                            <p className="text-xs text-neutral-500 mb-2 capitalize">Ride type: {ride.rideType.replace('_', ' ')}</p>
                          )}
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-neutral-500 font-medium">Passenger offer</span>
                            <span className="text-2xl font-bold text-neutral-900">₨{ride.offerPrice}</span>
                          </div>
                          {ride.distanceKm && (
                            <p className="text-xs text-neutral-400 mb-3 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {ride.distanceKm} km route
                            </p>
                          )}

                          {myBid ? (
                            <div className="text-center py-2.5 px-4 bg-green-50 border border-green-100 rounded-xl text-sm font-medium text-green-700">
                              ✓ Your offer: ₨{myBid.price} — Waiting for passenger…
                            </div>
                          ) : biddingRideId === ride.id ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); submitBid(ride.id, Number(bidPrice)); }}
                              className="space-y-2"
                            >
                              <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-neutral-500 font-semibold text-sm">₨</span>
                                <input
                                  type="number"
                                  autoFocus
                                  required
                                  value={bidPrice}
                                  onChange={(e) => setBidPrice(e.target.value)}
                                  placeholder={String(ride.offerPrice)}
                                  className="w-full pl-8 pr-4 py-2.5 border border-neutral-300 rounded-xl text-xl font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setBiddingRideId(null)}
                                  className="py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={loading}
                                  className="py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 shadow-sm transition-colors flex justify-center items-center gap-1"
                                >
                                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Offer'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={async () => {
                                  setBiddingRideId(ride.id);
                                  setBidPrice(String(Math.round(ride.offerPrice * 1.1)));
                                  await fetchServer(`/rides/${ride.id}/driver-activity`, {
                                    method: 'POST',
                                    body: JSON.stringify({ driverId: user?.id, status: 'considering' }),
                                  });
                                }}
                                className="py-2.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
                              >
                                Counter Offer
                              </button>
                              <button
                                onClick={() => acceptOffer(ride)}
                                disabled={loading}
                                className="py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 shadow-sm transition-colors"
                              >
                                Accept Offer ₨{ride.offerPrice}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MAP ── */}
      <div className="flex-1 relative min-h-[280px] lg:min-h-0">
        <RideMap
          pickup={activeMyRide?.pickupCoords}
          dropoff={activeMyRide?.dropoffCoords}
          driverLocation={driverLocation ? { lat: driverLocation.latitude, lng: driverLocation.longitude } : null}
          driverRouteGeoJSON={activeMyRide?.driverRouteGeoJSON}
          className="absolute inset-0 h-full w-full"
        />
        {!activeMyRide && (
          <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow text-center">
              <p className="text-sm text-neutral-600 font-medium">
                {isOnline ? '🟢 Online — scanning for rides' : '🔴 Offline'}
              </p>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 bg-white/95 border border-neutral-100 rounded-xl px-3 py-2 shadow-sm">
          <button
            onClick={() => setIftarReminder((v) => !v)}
            className={`text-xs font-medium flex items-center gap-1.5 ${iftarReminder ? 'text-green-700' : 'text-neutral-600'}`}
          >
            <Bell className="w-3.5 h-3.5" /> Iftar reminder {iftarReminder ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
