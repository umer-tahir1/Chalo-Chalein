import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import { MapPin, Navigation, Phone, MessageSquare, Star, User, Loader2, Check, Car } from 'lucide-react';
import { toast } from 'sonner';

export default function RideTracking() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [passenger, setPassenger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user || !accessToken) {
      navigate('/login');
      return;
    }

    fetchRide();
    
    // Poll for ride updates
    const interval = setInterval(fetchRide, 3000);
    return () => clearInterval(interval);
  }, [rideId]);

  const fetchRide = async () => {
    try {
      const response = await api.getRide(rideId!);
      setRide(response.ride);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching ride:', error);
      setLoading(false);
    }
  };

  const handleStartRide = async () => {
    setActionLoading(true);
    try {
      await api.startRide(accessToken!, rideId!);
      toast.success('Ride started!');
      fetchRide();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start ride');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    setActionLoading(true);
    try {
      await api.completeRide(accessToken!, rideId!);
      toast.success('Ride completed!');
      setTimeout(() => {
        navigate(user?.role === 'driver' ? '/driver' : '/passenger');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete ride');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRide = async () => {
    setActionLoading(true);
    try {
      await api.cancelRide(accessToken!, rideId!);
      toast.success('Ride cancelled');
      navigate(user?.role === 'driver' ? '/driver' : '/passenger');
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel ride');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusProgress = () => {
    if (!ride) return 0;
    switch (ride.status) {
      case 'accepted': return 33;
      case 'ongoing': return 66;
      case 'completed': return 100;
      default: return 0;
    }
  };

  const getStatusText = () => {
    if (!ride) return '';
    switch (ride.status) {
      case 'accepted': return 'Driver on the way';
      case 'ongoing': return 'Ride in progress';
      case 'completed': return 'Ride completed';
      case 'cancelled': return 'Ride cancelled';
      default: return 'Pending';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Ride not found</p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDriver = user?.role === 'driver' && ride.acceptedDriverId === user?.id;
  const isPassenger = user?.role === 'passenger' && ride.passengerId === user?.id;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Ride Tracking</h1>
            <Badge variant={
              ride.status === 'completed' ? 'default' :
              ride.status === 'cancelled' ? 'destructive' :
              'secondary'
            }>
              {getStatusText()}
            </Badge>
          </div>
        </div>
      </header>

      {/* Map Placeholder */}
      <div className="relative h-64 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Car className="w-16 h-16 text-primary mx-auto mb-2" />
            <p className="text-gray-600">Map View</p>
            <p className="text-sm text-gray-500">Live tracking coming soon</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-semibold">{getStatusProgress()}%</span>
                </div>
                <Progress value={getStatusProgress()} className="h-2" />
              </div>
              <div className="flex justify-between text-xs">
                <span className={ride.status !== 'pending' ? 'text-primary font-semibold' : 'text-gray-400'}>
                  <Check className="w-3 h-3 inline mr-1" />
                  Accepted
                </span>
                <span className={ride.status === 'ongoing' || ride.status === 'completed' ? 'text-primary font-semibold' : 'text-gray-400'}>
                  <Check className="w-3 h-3 inline mr-1" />
                  Started
                </span>
                <span className={ride.status === 'completed' ? 'text-primary font-semibold' : 'text-gray-400'}>
                  <Check className="w-3 h-3 inline mr-1" />
                  Completed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ride Details */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-gray-600">Pickup Location</div>
                <div className="font-medium">{ride.pickupLocation}</div>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-gray-300 ml-2 h-4" />
            <div className="flex items-start gap-2">
              <Navigation className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-gray-600">Drop Location</div>
                <div className="font-medium">{ride.dropLocation}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Card */}
        {isPassenger && ride.acceptedDriverId && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>D</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">Your Driver</div>
                    <div className="text-sm text-gray-600">Driver ID: {ride.acceptedDriverId.slice(-6)}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm">5.0</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => navigate(`/chat/${rideId}`)}>
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="outline">
                    <Phone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isDriver && ride.passengerId && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>P</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">Your Passenger</div>
                    <div className="text-sm text-gray-600">Passenger ID: {ride.passengerId.slice(-6)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => navigate(`/chat/${rideId}`)}>
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="outline">
                    <Phone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fare Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-600">Total Fare</div>
              <div className="text-3xl font-bold text-primary">₨{ride.finalFare || ride.suggestedFare}</div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {ride.status !== 'completed' && ride.status !== 'cancelled' && (
          <div className="space-y-3">
            {isDriver && ride.status === 'accepted' && (
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleStartRide}
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start Ride
              </Button>
            )}

            {isDriver && ride.status === 'ongoing' && (
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleCompleteRide}
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Ride
              </Button>
            )}

            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleCancelRide}
              disabled={actionLoading}
            >
              Cancel Ride
            </Button>
          </div>
        )}

        {ride.status === 'completed' && (
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate(user?.role === 'driver' ? '/driver' : '/passenger')}
          >
            Back to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
