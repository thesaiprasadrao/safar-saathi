import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriver } from '../context/DriverContext';
import { authAPI, healthAPI } from '../services/api';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { MapPin } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useDriver();
  const [formData, setFormData] = useState({ driverId: '', busNumber: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    checkBackendHealth();
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    if (navigator.geolocation) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          setError('Location access is denied. Please enable location permissions in your browser settings to use GPS tracking.');
        }
      } catch (err) {
        console.log('Permission API not supported');
      }
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  };

  const checkBackendHealth = async () => {
    try {
      const health = await healthAPI.check();
      setBackendStatus(health.success ? 'connected' : 'disconnected');
    } catch {
      setBackendStatus('disconnected');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (backendStatus !== 'connected') {
        if (formData.driverId.trim() && formData.busNumber.trim()) {
          login(formData.driverId, formData.busNumber);
          navigate('/trip');
          return;
        } else {
          setError('Please enter both Driver ID and Bus ID.');
          return;
        }
      }

      const result = await authAPI.login(formData.driverId, formData.busNumber);
      if (!result.success) {
        setError(result.error || 'Authentication failed');
        return;
      }
      login(formData.driverId, formData.busNumber);
      navigate('/trip');
    } catch (err) {
      setError(err.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-card">
            <CardHeader className="text-center">
              <h2 className="text-2xl font-semibold gradient-title">Driver Log In</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter details to Log In</p>
            </CardHeader>
            <CardContent>
              {backendStatus === 'checking' && (
                <div className="p-3 border border-border rounded-lg text-sm text-muted-foreground">Checking backend connection…</div>
              )}
              {backendStatus === 'disconnected' && (
                <div className="p-3 border border-border rounded-lg text-sm text-muted-foreground">Error Connecting Backend</div>
              )}
              {}

              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="driverId" className="block text-sm font-medium mb-1">Driver ID</label>
                  <Input id="driverId" name="driverId" value={formData.driverId} onChange={handleInputChange} placeholder="Enter your driver ID" required />
                </div>
                <div>
                  <label htmlFor="busNumber" className="block text-sm font-medium mb-1">Bus ID</label>
                  <Input id="busNumber" name="busNumber" value={formData.busNumber} onChange={handleInputChange} placeholder="Enter bus/vehicle ID" required />
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full gradient-cta text-white">
                  <MapPin className="w-4 h-4 mr-2" />
                  {loading ? 'Enabling…' : 'Log In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;