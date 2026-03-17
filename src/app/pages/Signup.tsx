import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Car, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  
  const [passengerData, setPassengerData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const [driverData, setDriverData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    vehicleType: '',
    vehicleModel: '',
    vehicleNumber: '',
    licensePlate: '',
  });

  const handlePassengerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signup({
        ...passengerData,
        role: 'passenger',
      });
      toast.success('Account created successfully!');
      navigate('/passenger');
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signup({
        name: driverData.name,
        email: driverData.email,
        phone: driverData.phone,
        password: driverData.password,
        role: 'driver',
        vehicleDetails: {
          type: driverData.vehicleType,
          model: driverData.vehicleModel,
          number: driverData.vehicleNumber,
          licensePlate: driverData.licensePlate,
        }
      });
      toast.success('Driver account created successfully!');
      navigate('/driver');
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-3">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Chalo Chalein
          </h1>
          <p className="text-gray-600 mt-2">Create your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Choose your role and fill in the details</CardDescription>
          </CardHeader>
          
          <Tabs value={role} onValueChange={(v) => setRole(v as 'passenger' | 'driver')}>
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="passenger" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Passenger
                </TabsTrigger>
                <TabsTrigger value="driver" className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Driver
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="passenger">
              <form onSubmit={handlePassengerSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="p-name">Full Name</Label>
                    <Input
                      id="p-name"
                      placeholder="John Doe"
                      value={passengerData.name}
                      onChange={(e) => setPassengerData({ ...passengerData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-email">Email</Label>
                    <Input
                      id="p-email"
                      type="email"
                      placeholder="you@example.com"
                      value={passengerData.email}
                      onChange={(e) => setPassengerData({ ...passengerData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-phone">Phone Number</Label>
                    <Input
                      id="p-phone"
                      type="tel"
                      placeholder="+92 3XX XXXXXXX"
                      value={passengerData.phone}
                      onChange={(e) => setPassengerData({ ...passengerData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-password">Password</Label>
                    <Input
                      id="p-password"
                      type="password"
                      placeholder="••••••••"
                      value={passengerData.password}
                      onChange={(e) => setPassengerData({ ...passengerData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Passenger Account
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="driver">
              <form onSubmit={handleDriverSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="d-name">Full Name</Label>
                    <Input
                      id="d-name"
                      placeholder="John Doe"
                      value={driverData.name}
                      onChange={(e) => setDriverData({ ...driverData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-email">Email</Label>
                    <Input
                      id="d-email"
                      type="email"
                      placeholder="you@example.com"
                      value={driverData.email}
                      onChange={(e) => setDriverData({ ...driverData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-phone">Phone Number</Label>
                    <Input
                      id="d-phone"
                      type="tel"
                      placeholder="+92 3XX XXXXXXX"
                      value={driverData.phone}
                      onChange={(e) => setDriverData({ ...driverData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-password">Password</Label>
                    <Input
                      id="d-password"
                      type="password"
                      placeholder="••••••••"
                      value={driverData.password}
                      onChange={(e) => setDriverData({ ...driverData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3 text-sm">Vehicle Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="vehicle-type">Type</Label>
                        <Input
                          id="vehicle-type"
                          placeholder="Car / Bike / Auto"
                          value={driverData.vehicleType}
                          onChange={(e) => setDriverData({ ...driverData, vehicleType: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle-model">Model</Label>
                        <Input
                          id="vehicle-model"
                          placeholder="Honda City"
                          value={driverData.vehicleModel}
                          onChange={(e) => setDriverData({ ...driverData, vehicleModel: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="license-plate">License Plate</Label>
                      <Input
                        id="license-plate"
                        placeholder="KA-01-AB-1234"
                        value={driverData.licensePlate}
                        onChange={(e) => setDriverData({ ...driverData, licensePlate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Driver Account
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-sm text-center text-gray-600 pb-6 px-6">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline font-medium"
            >
              Login
            </button>
          </div>
        </Card>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-primary"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
