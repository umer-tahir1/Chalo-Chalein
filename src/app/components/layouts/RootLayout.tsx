import { Outlet, useLocation } from "react-router";
import { Navbar } from "./Navbar";
import { useEffect } from "react";
import { toast } from "sonner";

export function RootLayout() {
  const location = useLocation();
  // Dashboard routes should fill the full viewport height for the map
  const isDashboard = location.pathname.includes('/dashboard');

  useEffect(() => {
    // Show Ramadan greeting only once per session
    const hasSeenGreeting = sessionStorage.getItem('ramadan_greeting_shown');
    if (!hasSeenGreeting) {
      setTimeout(() => {
        toast.custom((t) => (
          <div className="relative overflow-hidden w-[350px] p-6 bg-neutral-900 border border-neutral-700/50 rounded-2xl shadow-[0_0_40px_rgba(255,215,0,0.15)] flex flex-col items-center justify-center text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />
            
            {/* Decorative items */}
            <div className="flex gap-4 mb-3 animate-pulse">
              <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]">🏮</span>
              <span className="text-4xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] transform -translate-y-2">🌙</span>
              <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]">🏮</span>
            </div>
            
            <h2 className="text-xl font-bold bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-2">
              <span>💖</span> Ramadan Mubarak <span>💖</span>
            </h2>
            
            <p className="text-neutral-300 text-sm font-medium leading-relaxed">
              May this holy month bring you peace, joy, and blessings. 💖 ✨
            </p>
            
            <button 
              onClick={() => toast.dismiss(t)} 
              className="mt-4 px-4 py-1.5 text-xs font-semibold text-yellow-900 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg"
            >
              Thank you
            </button>
          </div>
        ), { duration: 8000, position: 'top-center' });
        
        sessionStorage.setItem('ramadan_greeting_shown', 'true');
      }, 1000);
    }
  }, []);

  return (
    <div className={`${isDashboard ? 'min-h-screen lg:h-screen' : 'min-h-screen'} bg-neutral-50 flex flex-col font-sans text-neutral-900`}>
      <Navbar />
      <main className={`flex-1 flex flex-col ${isDashboard ? 'lg:overflow-hidden' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
