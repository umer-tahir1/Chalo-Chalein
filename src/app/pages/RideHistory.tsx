import { useState, useEffect } from 'react';
import { fetchServer, supabase } from '../utils/supabase';
import { MapPin, Banknote, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; cls: string }> = {
  completed: { label: 'Completed', icon: CheckCircle, cls: 'text-green-600 bg-green-50 border-green-100' },
  cancelled: { label: 'Cancelled', icon: XCircle, cls: 'text-red-500 bg-red-50 border-red-100' },
  accepted: { label: 'In Progress', icon: Clock, cls: 'text-blue-600 bg-blue-50 border-blue-100' },
};

export function RideHistory() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUser(user);
      const r = user.user_metadata?.role || 'passenger';
      setRole(r);
      loadHistory(user.id, r);
    });
  }, []);

  const loadHistory = async (userId: string, role: string) => {
    setLoading(true);
    try {
      const rides = await fetchServer(`/rides/user/${userId}?role=${role}`);
      // Show all rides sorted newest first
      const sorted = [...(rides || [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRides(sorted);
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = rides
    .filter((r) => r.status === 'completed')
    .reduce((s, r) => s + (r.finalPrice || r.offerPrice || 0), 0);

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Ride History</h1>
        <p className="text-neutral-500 text-sm mt-0.5">
          Your past rides &amp; trips
        </p>
      </div>

      {/* Summary strip */}
      {!loading && rides.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Rides', value: String(rides.length) },
            { label: 'Completed', value: String(rides.filter((r) => r.status === 'completed').length) },
            { label: role === 'passenger' ? 'Total Spent' : 'Total Earned', value: `₨${totalSpent}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-neutral-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-xl font-bold text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : rides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-neutral-300" />
          </div>
          <p className="text-neutral-600 font-medium">No ride history yet</p>
          <p className="text-sm text-neutral-400">Your past trips will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.map((ride, i) => {
            const statusCfg = STATUS_CONFIG[ride.status] || {
              label: ride.status,
              icon: Clock,
              cls: 'text-neutral-500 bg-neutral-50 border-neutral-100',
            };
            const StatusIcon = statusCfg.icon;

            return (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Route */}
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-sm font-medium text-neutral-800 truncate">{ride.pickup}</p>
                    </div>
                    <div className="ml-1 w-0.5 h-2.5 bg-neutral-200" />
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      <p className="text-sm font-medium text-neutral-800 truncate">{ride.dropoff}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${statusCfg.cls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                    {(ride.finalPrice || ride.offerPrice) && (
                      <p className="text-base font-bold text-neutral-900">
                        ₨{ride.finalPrice || ride.offerPrice}
                      </p>
                    )}
                    {ride.distanceKm && (
                      <p className="text-xs text-neutral-400">{ride.distanceKm} km</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-neutral-400 border-t border-neutral-50 pt-2">
                  {new Date(ride.createdAt).toLocaleDateString('en-IN', {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
