import { Link, useNavigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { supabase, endClientSession } from "../../utils/supabase";
import type { User } from "@supabase/supabase-js";
import { CarFront, LogOut, History, MessageSquare, LayoutDashboard, ChevronDown } from "lucide-react";

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await endClientSession();
    await supabase.auth.signOut();
    navigate("/");
  };

  const role = user?.user_metadata?.role;
  const dashboardPath = role === 'driver' ? '/driver/dashboard'
    : role === 'admin' ? '/admin/dashboard'
    : '/passenger/dashboard';

  const isAuthPage = location.pathname.includes('/login') || location.pathname.includes('/signup');

  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => navigate(user ? dashboardPath : "/")}
          >
            <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
              <CarFront className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-neutral-900">
              Chalo <span className="text-green-600">Chalein</span>
            </span>
          </div>

          {/* Right side */}
          {user ? (
            <div className="flex items-center gap-1">
              {/* Desktop nav links */}
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  to={dashboardPath}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname.includes('dashboard')
                      ? 'text-green-700 bg-green-50'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                {role !== 'admin' && (
                  <>
                    <Link
                      to="/history"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        location.pathname === '/history'
                          ? 'text-green-700 bg-green-50'
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                      }`}
                    >
                      <History className="w-4 h-4" /> History
                    </Link>
                    <Link
                      to="/chat"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        location.pathname === '/chat'
                          ? 'text-green-700 bg-green-50'
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" /> Chat
                    </Link>
                  </>
                )}
              </div>

              {/* User menu */}
              <div className="relative ml-2">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-green-700">
                      {(user.user_metadata?.name || user.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-neutral-700 hidden sm:block max-w-[100px] truncate">
                    {user.user_metadata?.name?.split(' ')[0] || 'User'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 hidden sm:block" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-neutral-100 py-1 z-50">
                    <div className="px-3 py-2 border-b border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                        {role || 'passenger'}
                      </p>
                      <p className="text-sm font-medium text-neutral-800 truncate mt-0.5">
                        {user.user_metadata?.name || user.email}
                      </p>
                    </div>

                    {/* Mobile-only links */}
                    <div className="sm:hidden border-b border-neutral-100 py-1">
                      <Link to={dashboardPath} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                        <LayoutDashboard className="w-4 h-4 text-neutral-400" /> Dashboard
                      </Link>
                      {role !== 'admin' && (
                        <>
                          <Link to="/history" className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                            <History className="w-4 h-4 text-neutral-400" /> Ride History
                          </Link>
                          <Link to="/chat" className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                            <MessageSquare className="w-4 h-4 text-neutral-400" /> Chat
                          </Link>
                        </>
                      )}
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            !isAuthPage && (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-900 px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  Sign up
                </Link>
              </div>
            )
          )}
        </div>
      </div>

      {/* Click-away overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}
    </nav>
  );
}
