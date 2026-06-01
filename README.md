# SpendSight

Expo React Native app for monthly expense analytics with manual entry, statement image upload, AI-assisted categorization, login/logout flow, Zustand state, dark/light themes, and chart-based insights.

## Run the mobile app

```sh
npm install
npm run start
```

## Run the API server

```sh
cd server
npm install
cp .env.example .env
npm run dev
```

MongoDB and Gemini should live in the API server, not inside the mobile app. The app calls the API, while the server owns authentication, database writes, image parsing, and AI categorization.

This scaffold targets Expo SDK 52, matching the Expo dependency set installed in this workspace.
