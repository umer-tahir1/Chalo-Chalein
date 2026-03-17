import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Car, Users, Shield, TrendingUp, MapPin, MessageSquare } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Set Your Price",
      description: "You decide the fare. Drivers bid on your ride request."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Choose Your Driver",
      description: "Review driver ratings and offers before accepting."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Safe & Reliable",
      description: "Verified drivers, real-time tracking, and 24/7 support."
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Direct Communication",
      description: "Chat with your driver before and during the ride."
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Live Tracking",
      description: "Track your driver in real-time from pickup to destination."
    },
    {
      icon: <Car className="w-8 h-8" />,
      title: "Multiple Options",
      description: "Cars, bikes, and autos - choose what fits your need."
    }
  ];

  const steps = [
    {
      step: "1",
      title: "Request a Ride",
      description: "Enter your destination and suggest a fare"
    },
    {
      step: "2",
      title: "Receive Offers",
      description: "Drivers bid with their best prices"
    },
    {
      step: "3",
      title: "Choose & Ride",
      description: "Select your driver and enjoy the journey"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Chalo Chalein
            </h1>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button onClick={() => navigate('/signup')}>
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your Ride,<br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Your Price
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Request a ride, set your fare, and choose from multiple driver offers.
            Experience fair pricing with Chalo Chalein.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => navigate('/signup')}
            >
              Get Started as Passenger
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6"
              onClick={() => navigate('/signup')}
            >
              Drive & Earn
            </Button>
          </div>
        </div>

        {/* Illustration/Stats */}
        <div className="mt-16 grid md:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <div className="text-4xl font-bold text-primary mb-2">100K+</div>
            <div className="text-gray-600">Active Riders</div>
          </div>
          <div className="p-6">
            <div className="text-4xl font-bold text-primary mb-2">50K+</div>
            <div className="text-gray-600">Verified Drivers</div>
          </div>
          <div className="p-6">
            <div className="text-4xl font-bold text-primary mb-2">1M+</div>
            <div className="text-gray-600">Rides Completed</div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h3 className="text-4xl font-bold text-center mb-12">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">{item.step}</span>
                </div>
                <h4 className="text-xl font-semibold mb-2">{item.title}</h4>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h3 className="text-4xl font-bold text-center mb-12">Why Choose Chalo Chalein</h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  {feature.icon}
                </div>
                <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary to-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h3>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of riders and drivers who trust Chalo Chalein for their daily commute.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-6 bg-white text-primary hover:bg-gray-100"
            onClick={() => navigate('/signup')}
          >
            Sign Up Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">Chalo Chalein</span>
              </div>
              <p className="text-gray-400 text-sm">
                Fair pricing for everyone. Ride with confidence.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>About Us</li>
                <li>Careers</li>
                <li>Press</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Help Center</li>
                <li>Safety</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
                <li>Cookie Policy</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            © 2026 Chalo Chalein. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
