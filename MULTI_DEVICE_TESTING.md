# Multi-Device Real-Time Testing Guide

This setup keeps the existing UI/design untouched and enables production-like testing across multiple devices.

## 1. What Is Already Implemented

- Frontend: React + Vite app
- Backend: Supabase Edge Function at `/functions/v1/make-server-93f7752e`
- Data store: Supabase PostgreSQL-backed KV table
- Real-time delivery: Supabase Realtime channel listeners (`postgres_changes`)

## 2. Deploy Frontend (Vercel or Netlify)

### Option A: Vercel

1. Push this repository to GitHub.
2. In Vercel, click **New Project** and import the repo.
3. Keep defaults:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy.

### Option B: Netlify

1. Push this repository to GitHub.
2. In Netlify, click **Add new site** > **Import from Git**.
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy.

## 3. Backend Readiness Checklist (Supabase)

1. Supabase project exists and is active.
2. Edge Function `make-server-93f7752e` is deployed.
3. Authentication email confirmation and SMTP are configured (if required).
4. Realtime is enabled on table `public.kv_store_93f7752e`.

## 4. Required Data Model (Already Covered)

- Users: `user:{userId}` (contains role passenger/driver/admin)
- Drivers: `driver_status:{driverId}` (availability + location)
- Rides: `ride:{rideId}` (status pending/negotiating/accepted/in_progress/completed/cancelled)

## 5. Multi-Device Real-Time Test Scenario

Use two devices/browsers at the same public URL.

1. Device A: Login as Passenger.
2. Device B: Login as Driver and set Online.
3. Passenger creates a ride request with pickup + dropoff.
4. Driver should see the ride request appear instantly.
5. Driver sends an offer or accepts.
6. Passenger accepts (or driver directly accepts) and ride becomes `driver_en_route`.

Expected behavior:

- End-to-end update latency should typically be under 1 second on stable internet.
- No polling is required for live ride updates.

## 6. Error Handling Cases to Verify

1. No drivers available:
   - Passenger can still create a ride.
   - Passenger is informed no nearby drivers are currently online.
2. Network delay:
   - API requests fail fast with timeout rather than hanging indefinitely.
3. Ride not accepted:
   - Passenger gets guidance message after waiting window.

## 7. Optional Local Network Testing

Run locally and open from another device on same Wi-Fi:

```bash
npm run dev:host
```

Then open `http://<your-local-ip>:5173` on your second device.

## 8. Validation Commands

```bash
npm run build
npm run dev:host
```

If build succeeds and both roles receive real-time updates across devices, the environment is ready for production-like testing.
