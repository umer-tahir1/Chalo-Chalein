import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93f7752e`;

const _fetch = globalThis.fetch;
const fetch = async (url: string | URL | Request, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set('apikey', publicAnonKey);
  
  // Replace user tokens in Authorization with Anon Key to prevent Supabase API gateway from rejecting ES256 tokens.
  const authHeader = headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ') && authHeader !== `Bearer ${publicAnonKey}`) {
    headers.set('x-user-token', authHeader.split(' ')[1]);
    headers.set('Authorization', `Bearer ${publicAnonKey}`);
  } else if (!authHeader) {
    headers.set('Authorization', `Bearer ${publicAnonKey}`);
  }
  
  return _fetch(url, { ...options, headers });
};

export const api = {
  // Rides
  createRideRequest: async (token: string, data: any) => {
    const response = await fetch(`${API_BASE}/rides/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create ride request');
    }
    
    return response.json();
  },

  getActiveRides: async (token: string) => {
    const response = await fetch(`${API_BASE}/rides/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch active rides');
    }
    
    return response.json();
  },

  getRide: async (rideId: string) => {
    const response = await fetch(`${API_BASE}/rides/${rideId}`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch ride');
    }
    
    return response.json();
  },

  startRide: async (token: string, rideId: string) => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start ride');
    }
    
    return response.json();
  },

  completeRide: async (token: string, rideId: string) => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to complete ride');
    }
    
    return response.json();
  },

  cancelRide: async (token: string, rideId: string) => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel ride');
    }
    
    return response.json();
  },

  getRideHistory: async (token: string) => {
    const response = await fetch(`${API_BASE}/rides/history`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch ride history');
    }
    
    return response.json();
  },

  // Bids
  createBid: async (token: string, data: any) => {
    const response = await fetch(`${API_BASE}/bids/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create bid');
    }
    
    return response.json();
  },

  acceptBid: async (token: string, data: any) => {
    const response = await fetch(`${API_BASE}/bids/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept bid');
    }
    
    return response.json();
  },

  // Driver
  updateDriverStatus: async (token: string, data: any) => {
    const response = await fetch(`${API_BASE}/driver/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update status');
    }
    
    return response.json();
  },

  getDriverEarnings: async (token: string) => {
    const response = await fetch(`${API_BASE}/driver/earnings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch earnings');
    }
    
    return response.json();
  },

  // Messages
  sendMessage: async (token: string, data: any) => {
    const response = await fetch(`${API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }
    
    return response.json();
  },

  getMessages: async (rideId: string) => {
    const response = await fetch(`${API_BASE}/messages/${rideId}`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch messages');
    }
    
    return response.json();
  },

  // Admin
  getAllUsers: async (token: string) => {
    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch users');
    }
    
    return response.json();
  },

  getAllRides: async (token: string) => {
    const response = await fetch(`${API_BASE}/admin/rides`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch rides');
    }
    
    return response.json();
  },
};
