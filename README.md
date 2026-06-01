# SpendSight

Expo React Native app for monthly expense analytics with manual entry, statement image upload, AI-assisted categorization, login/logout flow, Zustand state, dark/light themes, and chart-based insights.

## Run the mobile app

```sh
nvm use
npm install
npm run start
```

## Run the API server

```sh
cd server
npm install
cp ../.env.example ../.env
npm run dev
```

MongoDB and Gemini should live in the API server, not inside the mobile app. The app calls the API, while the server owns authentication, database writes, image parsing, and AI categorization.

## Deploy to Vercel

This repo deploys the Vite web app and the Express API together on Vercel. The frontend uses `/api` automatically in production.

1. Import the GitHub repo in Vercel.
2. Use the default project root.
3. Set these environment variables in Vercel: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_RECEIPT_MODEL`, and `GOOGLE_CLIENT_ID`.
4. Keep the build command as `npm run build` and output directory as `dist`.

For local development, copy `.env.example` to `.env` and keep `VITE_API_URL` / `EXPO_PUBLIC_API_URL` pointed at `http://localhost:4000/api`.

This scaffold targets Expo SDK 54. Use Node 20.19.4 or Node 22; Node 24 can break Expo CLI startup in this project.
