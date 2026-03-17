You are a senior product engineer, mobile app developer, and UX expert.

I already have a basic web app for a ride-hailing platform named "Chalo Chalein", but it is incomplete and lacks important real-world features.

Your task is to UPGRADE and TRANSFORM this into a fully functional MOBILE APPLICATION.

====================================================

⚠️ FIRST: ANALYZE CURRENT APP

- Review the existing web app structure and features
- Identify missing functionality and UX gaps
- Do NOT rebuild from scratch blindly — improve what exists

====================================================

❌ CURRENT PROBLEMS (MUST FIX):

1. Location Search:
- No autocomplete suggestions
- No real-time place recommendations

👉 FIX:
- Integrate Google Places API or OpenStreetMap Nominatim
- Show live suggestions in search dropdown

----------------------------------------------------

2. Map Integration:
- Map is missing or not functional

👉 FIX:
- Add full map support
- Show pickup & drop pins
- Draw route between locations

----------------------------------------------------

3. Fare System:
- No recommended fare based on distance

👉 FIX:
- Calculate distance using map API
- Implement fare estimation formula:
  base fare + (per km rate × distance)
- Show suggested fare to user

----------------------------------------------------

4. Ride Broadcast System:
- No visibility of drivers viewing or responding

👉 FIX:
- Show list of nearby drivers
- Show:
   - who viewed request
   - who is bidding
   - who accepted/rejected
- Real-time updates using sockets

----------------------------------------------------

5. Real-time Features Missing:
- No proper ride status updates
- No driver tracking

👉 FIX:
- Implement Socket.io
- Add:
   - live driver location tracking
   - ride status updates
   - bid updates

====================================================

📱 NOW CONVERT TO MOBILE APP

Transform the SAME project into a mobile app.

🧩 TECH STACK:

- React Native (Expo preferred)
- Tailwind (NativeWind)
- Node.js backend (reuse if possible)
- MongoDB
- Socket.io

====================================================

📱 MOBILE APP FEATURES:

Passenger:
- Location autocomplete
- Map with route
- Fare suggestion
- Request ride
- See driver bids in real-time
- Accept ride
- Live tracking
- Chat

Driver:
- Online/offline toggle
- Receive ride requests
- Accept / counter-offer
- Navigation
- Earnings screen

====================================================

🎨 MOBILE UI/UX:

- Clean, modern, similar to inDrive
- Bottom navigation
- Smooth transitions
- Mobile-first layouts

====================================================

🗺️ MAP FOR MOBILE:

- Use react-native-maps
- Show:
   - current location
   - route
   - driver movement

====================================================

⚡ REAL-TIME:

- Use Socket.io client in React Native
- Live bidding system
- Live driver updates

====================================================

📦 OUTPUT FORMAT:

1. Analysis of current app issues
2. Improved feature plan
3. Updated backend changes
4. Full React Native mobile app code
5. Map integration code
6. Real-time socket implementation
7. How to run on mobile (Expo)
8. Deployment instructions

⚠️ Do NOT skip features
⚠️ Do NOT give placeholder logic
⚠️ Everything must be functional and realistic

====================================================

💡 IMPORTANT:

- Do not simplify the system
- Build like a real-world ride-hailing app
- Focus on real-time experience like inDrive