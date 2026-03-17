import { useState, useEffect } from 'react';
import { fetchServer } from '../utils/supabase';
import { Users, CarFront, Clock, TrendingUp, CheckCircle, XCircle, Loader2, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

type TabKey = 'overview' | 'rides' | 'users' | 'onboarding';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  negotiating: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  driver_en_route: 'bg-emerald-100 text-emerald-700',
  driver_arrived: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-red-100 text-red-600',
};

export function AdminDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        fetchServer('/admin/users'),
        fetchServer('/admin/rides'),
      ]);
      setUsers(u || []);
      setRides(r || []);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const completed = rides.filter((r) => r.status === 'completed');
  const cancelled = rides.filter((r) => r.status === 'cancelled');
  const active = rides.filter((r) => ['pending', 'negotiating', 'accepted', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(r.status));
  const totalRevenue = completed.reduce((sum, r) => sum + (r.finalPrice || 0), 0);
  const passengers = users.filter((u) => u.role === 'passenger');
  const drivers = users.filter((u) => u.role === 'driver');
  const pendingDrivers = drivers.filter((u) => (u?.driverVerification?.status || 'pending') === 'pending');

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'rides', label: `All Rides (${rides.length})` },
    { key: 'users', label: `Users (${users.length})` },
    { key: 'onboarding', label: `Driver Reviews (${pendingDrivers.length})` },
  ];

  const reviewDriver = async (driverId: string, status: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      await fetchServer(`/admin/drivers/${driverId}/review`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes: status === 'approved' ? 'Approved by admin' : 'Rejected by admin' }),
      });
      await load();
    } catch (err) {
      console.error('Driver review failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Admin Dashboard</h1>
          <p className="text-neutral-500 text-sm mt-0.5">Chalo Chalein Platform Overview</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: users.length, icon: Users, color: 'blue' },
                  { label: 'Total Rides', value: rides.length, icon: CarFront, color: 'green' },
                  { label: 'Active Rides', value: active.length, icon: Clock, color: 'amber' },
                  { label: 'Revenue', value: `₨${totalRevenue}`, icon: TrendingUp, color: 'purple' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      color === 'blue' ? 'bg-blue-50' : color === 'green' ? 'bg-green-50' : color === 'amber' ? 'bg-amber-50' : 'bg-purple-50'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <p className="text-2xl font-bold text-neutral-900">{value}</p>
                    <p className="text-sm text-neutral-500 mt-0.5">{label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User breakdown */}
                <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
                  <h3 className="font-semibold text-neutral-800 mb-4">User Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Passengers', count: passengers.length, color: 'bg-blue-500' },
                      { label: 'Drivers', count: drivers.length, color: 'bg-green-500' },
                    ].map(({ label, count, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-600 font-medium">{label}</span>
                          <span className="text-neutral-900 font-bold">{count}</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${color}`}
                            style={{ width: users.length ? `${(count / users.length) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ride breakdown */}
                <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
                  <h3 className="font-semibold text-neutral-800 mb-4">Ride Status</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Active', count: active.length, icon: Clock, cls: 'text-amber-600' },
                      { label: 'Completed', count: completed.length, icon: CheckCircle, cls: 'text-green-600' },
                      { label: 'Cancelled', count: cancelled.length, icon: XCircle, cls: 'text-red-500' },
                    ].map(({ label, count, icon: Icon, cls }) => (
                      <div key={label} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${cls}`} />
                          <span className="text-sm text-neutral-600">{label}</span>
                        </div>
                        <span className="text-sm font-bold text-neutral-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rides Tab */}
          {tab === 'rides' && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {['Passenger', 'Pickup', 'Drop-off', 'Offer (₨)', 'Final (₨)', 'Status', 'Created'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {rides.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-12 text-neutral-400">No rides yet</td></tr>
                    )}
                    {rides.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-neutral-800 whitespace-nowrap">{r.passengerName || '—'}</td>
                        <td className="px-4 py-3 text-neutral-600 max-w-[160px] truncate">{r.pickup}</td>
                        <td className="px-4 py-3 text-neutral-600 max-w-[160px] truncate">{r.dropoff}</td>
                        <td className="px-4 py-3 font-semibold text-neutral-900">₨{r.offerPrice}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{r.finalPrice ? `₨${r.finalPrice}` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[r.status] || 'bg-neutral-100 text-neutral-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {tab === 'users' && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {['Name', 'Email', 'Role', 'Joined'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {users.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-12 text-neutral-400">No users yet</td></tr>
                    )}
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-neutral-800">{u.name || '—'}</td>
                        <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            u.role === 'driver' ? 'bg-green-100 text-green-700'
                              : u.role === 'admin' ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>{u.role || 'passenger'}</span>
                        </td>
                        <td className="px-4 py-3 text-neutral-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'onboarding' && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {['Driver', 'Phone', 'Vehicle', 'Verification', 'Action'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {drivers.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-12 text-neutral-400">No drivers found</td></tr>
                    )}
                    {drivers.map((driver) => {
                      const status = driver?.driverVerification?.status || 'pending';
                      return (
                        <tr key={driver.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-neutral-800">{driver.name || '—'}</td>
                          <td className="px-4 py-3 text-neutral-600">{driver.phone || '—'}</td>
                          <td className="px-4 py-3 text-neutral-600 capitalize">{driver?.vehicleDetails?.type || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              status === 'approved' ? 'bg-green-100 text-green-700' : status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>{status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => reviewDriver(driver.id, 'approved')}
                                disabled={status === 'approved'}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white disabled:bg-neutral-200"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => reviewDriver(driver.id, 'rejected')}
                                disabled={status === 'rejected'}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white disabled:bg-neutral-200"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
