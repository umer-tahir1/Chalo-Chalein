import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Mail, Phone, Star, Car, MapPin, Calendar } from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Profile</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarFallback className="text-3xl">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold mb-1">{user.name}</h2>
              <Badge variant="outline" className="mb-4 capitalize">
                {user.role}
              </Badge>
              {user.role === 'driver' && user.rating && (
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">{user.rating.toFixed(1)}</span>
                  <span className="text-gray-600">/ 5.0</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Phone</div>
                <div className="font-medium">{user.phone}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Member Since</div>
                <div className="font-medium">
                  {user.createdAt 
                    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'N/A'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Details (Driver Only) */}
        {user.role === 'driver' && user.vehicleDetails && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Car className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Vehicle Type</div>
                  <div className="font-medium capitalize">{user.vehicleDetails.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Car className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Model</div>
                  <div className="font-medium">{user.vehicleDetails.model}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">License Plate</div>
                  <div className="font-medium">{user.vehicleDetails.licensePlate}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">
                  {user.totalRides || 0}
                </div>
                <div className="text-sm text-gray-600">
                  Total {user.role === 'driver' ? 'Rides' : 'Trips'}
                </div>
              </div>
              {user.role === 'driver' && (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {user.rating?.toFixed(1) || '5.0'}
                  </div>
                  <div className="text-sm text-gray-600">Average Rating</div>
                </div>
              )}
              {user.role === 'passenger' && (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-primary mb-1">
                    ₨0
                  </div>
                  <div className="text-sm text-gray-600">Total Spent</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
