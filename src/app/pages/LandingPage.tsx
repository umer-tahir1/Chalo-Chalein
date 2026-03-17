import { Link } from "react-router";
import { motion } from "motion/react";
import { AnimatedBackground } from "../components/ui/AnimatedBackground";
import {
  CarFront, MapPin, Banknote, ShieldCheck,
  MessageSquare, Navigation, Star, Zap,
} from "lucide-react";

const features = [
  {
    icon: Banknote,
    color: "green",
    title: "Reverse Bidding",
    desc: "Passengers set their price. Drivers bid or counter-offer. You both agree before the ride begins.",
  },
  {
    icon: MapPin,
    color: "blue",
    title: "Live Route & Map",
    desc: "See your exact route on a live map with pickup and drop-off pins. Distance-based fare estimates included.",
  },
  {
    icon: Navigation,
    color: "purple",
    title: "Real-time Tracking",
    desc: "Track your driver's location in real time. Know exactly when they arrive.",
  },
  {
    icon: MessageSquare,
    color: "amber",
    title: "In-App Chat",
    desc: "Communicate directly with your driver or passenger through the built-in chat during your ride.",
  },
  {
    icon: Star,
    color: "orange",
    title: "Choose Your Driver",
    desc: "Compare bids, ratings, and ETA. Pick the driver that suits you best.",
  },
  {
    icon: ShieldCheck,
    color: "teal",
    title: "Safe & Verified",
    desc: "All drivers are verified. Ride with peace of mind knowing your safety is our priority.",
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  green:  { bg: "bg-green-100",  icon: "text-green-600"  },
  blue:   { bg: "bg-blue-100",   icon: "text-blue-600"   },
  purple: { bg: "bg-purple-100", icon: "text-purple-600" },
  amber:  { bg: "bg-amber-100",  icon: "text-amber-600"  },
  orange: { bg: "bg-orange-100", icon: "text-orange-600" },
  teal:   { bg: "bg-teal-100",   icon: "text-teal-600"   },
};

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-full">
      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-white py-16 sm:py-24">
          <AnimatedBackground />
          {/* Ramadan Decorations */}
          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-20px); }
            }
            .ramadan-moon {
              animation: float 4s ease-in-out infinite;
            }
            @keyframes swing {
              0%, 100% { transform: rotate(-3deg); }
              50% { transform: rotate(3deg); }
            }
            .ramadan-lantern {
              animation: swing 3s ease-in-out infinite;
              filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.6));
            }
            @keyframes glow {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
            .ramadan-star {
              animation: glow 2s ease-in-out infinite;
            }
          `}</style>
          
          {/* Moon and Stars */}
          <div className="absolute top-10 right-10 text-5xl ramadan-moon">🌙</div>
          <div className="absolute top-20 right-40 text-2xl ramadan-star">⭐</div>
          <div className="absolute top-32 right-64 text-xl ramadan-star">✨</div>
          
          {/* Lanterns */}
          <div className="absolute top-20 left-10 text-4xl ramadan-lantern">🏮</div>
          <div className="absolute bottom-40 right-20 text-4xl ramadan-lantern">🏮</div>
          <div className="absolute top-1/3 left-1/4 text-3xl ramadan-lantern">🏮</div>
          
          {/* Soft gradient blobs */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-green-100 rounded-full opacity-50 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-100 rounded-full opacity-40 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="sm:text-center lg:text-left"
              >
                <span className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-green-100 mb-6">
                  <Zap className="w-3.5 h-3.5" /> Pakistan's Reverse Bidding Ride App
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-neutral-900 leading-tight tracking-tight">
                  Your ride,{" "}
                  <span className="text-green-600">your price.</span>
                </h1>
                <p className="mt-5 text-lg text-neutral-500 sm:max-w-xl sm:mx-auto lg:mx-0 leading-relaxed">
                  Chalo Chalein puts you in control. Negotiate fares directly with drivers,
                  compare live offers, and enjoy a fair ride every time.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start">
                  <Link
                    to="/signup?role=passenger"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-sm transition-colors"
                  >
                    <CarFront className="w-5 h-5" /> Book a Ride
                  </Link>
                  <Link
                    to="/signup?role=driver"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 font-semibold rounded-xl transition-colors"
                  >
                    Become a Driver →
                  </Link>
                </div>
                <p className="mt-4 text-sm text-neutral-400">
                  Already have an account?{" "}
                  <Link to="/login" className="text-green-600 hover:underline font-medium">
                    Log in
                  </Link>
                </p>
              </motion.div>

              {/* Mock phone UI */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-12 lg:mt-0 flex justify-center"
              >
                <div className="relative w-full max-w-sm">
                  {/* Phone frame */}
                  <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
                    {/* Status bar */}
                    <div className="bg-neutral-900 h-8 flex items-center justify-between px-4">
                      <span className="text-white text-xs">9:41</span>
                      <div className="flex gap-1">
                        {[3, 2.5, 2].map((h, i) => (
                          <div key={i} className="w-0.5 bg-white rounded-full" style={{ height: `${h * 4}px` }} />
                        ))}
                      </div>
                    </div>
                    {/* App header */}
                    <div className="bg-green-600 px-4 py-3 flex items-center gap-2">
                      <CarFront className="w-5 h-5 text-white" />
                      <span className="text-white font-bold text-sm">Chalo Chalein</span>
                    </div>
                    {/* Content */}
                    <div className="p-4 space-y-3">
                      {/* Location inputs */}
                      <div className="bg-neutral-50 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-xs text-neutral-600 font-medium">Liberty Market, Lahore</span>
                        </div>
                        <div className="ml-1 w-0.5 h-3 bg-neutral-200" />
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                          <span className="text-xs text-neutral-600 font-medium">Gulshan-e-Iqbal, Karachi</span>
                        </div>
                      </div>
                      {/* Route info */}
                      <div className="flex gap-3 text-xs text-neutral-500 bg-green-50 rounded-lg px-3 py-2">
                        <span className="text-green-700 font-semibold">22 km</span>
                        <span>·</span>
                        <span>~35 min</span>
                        <span>·</span>
                        <span className="text-green-700 font-semibold">Suggested ₨358</span>
                      </div>
                      {/* Bids */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">3 Driver Offers</p>
                        {[
                          { name: "Rahul K.", rating: "4.9", price: 340, badge: "Fastest" },
                          { name: "Amit S.", rating: "4.7", price: 360 },
                          { name: "Priya M.", rating: "4.8", price: 350 },
                        ].map((d) => (
                          <div key={d.name} className="bg-white border border-neutral-100 rounded-xl px-3 py-2.5 flex items-center justify-between shadow-sm">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-neutral-800">{d.name}</span>
                                {d.badge && (
                                  <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">{d.badge}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {d.rating} · 2 min away
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-neutral-900">₨{d.price}</span>
                              <button className="text-[10px] bg-green-600 text-white font-semibold px-2.5 py-1 rounded-lg">Accept</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Decorative blur ring */}
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-green-200 rounded-full opacity-30 blur-2xl -z-10" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-16 bg-neutral-50 border-t border-neutral-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-neutral-900">
                Everything you need for a fair ride
              </h2>
              <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
                Built with real-world ride-hailing features — from live maps to reverse bidding.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map(({ icon: Icon, color, title, desc }, i) => {
                const { bg, icon } = COLOR_MAP[color];
                return (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex flex-col p-6 bg-white rounded-2xl shadow-sm border border-neutral-100 hover:shadow-md transition-shadow"
                  >
                    <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${icon}`} />
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 mb-2">{title}</h3>
                    <p className="text-neutral-500 text-sm leading-relaxed">{desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-16 bg-green-600">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">
              Ready to ride on your terms?
            </h2>
            <p className="text-green-100 mb-8">
              Join thousands of passengers and drivers already using Chalo Chalein.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/signup?role=passenger"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors shadow-sm"
              >
                Get Started — Passenger
              </Link>
              <Link
                to="/signup?role=driver"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-green-700 text-white border border-green-500 font-semibold rounded-xl hover:bg-green-800 transition-colors"
              >
                Start Driving →
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-400 py-8 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 bg-green-600 rounded-md flex items-center justify-center">
            <CarFront className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white">Chalo Chalein</span>
        </div>
        <p>© 2026 Chalo Chalein. All rights reserved.</p>
      </footer>
    </div>
  );
}
