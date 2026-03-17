import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { supabase, startClientSession, heartbeatClientSession, endClientSession } from "../../utils/supabase";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!user.email_confirmed_at) return;

    let active = true;
    startClientSession().catch(() => {});

    const heartbeatTimer = setInterval(() => {
      if (active) heartbeatClientSession().catch(() => {});
    }, 20000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        heartbeatClientSession().catch(() => {});
      }
    };

    const onPageHide = () => {
      endClientSession(true).catch(() => {});
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      active = false;
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [user?.id, user?.email_confirmed_at]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.email_confirmed_at) {
    supabase.auth.signOut().catch(() => {});
    return <Navigate to="/login" replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    // Redirect to correct dashboard based on role
    return <Navigate to={`/${role}/dashboard`} replace />;
  }

  return <>{children}</>;
}
