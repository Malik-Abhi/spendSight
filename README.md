# SpendSight

SpendSight is a personal finance app with two frontends and one shared backend:

- `app/` is the Expo React Native mobile app for iOS and Android.
- `web/` is the Vite React web app.
- `server/` is the Express API used by both mobile and web.
- `api/` and `serverless/` adapt the same backend behavior for Vercel.
- `models/` contains shared transaction types, finance types, and palette helpers.
- `scripts/` contains local dev orchestration and encryption maintenance scripts.

The project is intentionally split this way so the mobile app and web app can have separate UI code while still using the same data model and API.

## How It Works

### Local Web Flow

When you run `npm run web`, the root dev script does two things:

1. Loads `.env` from the project root.
2. Starts the backend on `http://localhost:4000` if it is not already running.
3. Starts Vite for the web app on `http://localhost:5173`.

The web app calls `/api/...` in the browser. In local development, `vite.config.ts` proxies `/api` requests to `http://localhost:4000/api`, so the browser and backend work together without hardcoding the production URL.

### Mobile Flow

When you run `npm run app`, `npm run android`, or `npm run ios`, the same dev script starts the backend first and then starts Expo.

The mobile API client reads `EXPO_PUBLIC_API_URL`. For Android emulators, localhost is automatically mapped to `10.0.2.2` so the emulator can reach the API running on your machine.

### Backend Flow

The backend owns the private work:

- Email and Google authentication.
- JWT session creation.
- MongoDB reads and writes.
- Transaction and people APIs.
- Statement upload and Gemini analysis.
- Transaction encryption and decryption.
- Duplicate filtering during statement imports.

The frontend never connects directly to MongoDB or Gemini.

### Vercel Flow

Vercel builds the web app with `npm run build` and serves the generated `dist/` folder.

API requests go through `api/[...path].ts`, which dispatches to the serverless handlers in `serverless/`. This lets the deployed web app use URLs like `/api/auth/login`, `/api/transactions`, `/api/people`, and `/api/statements/analyze`.

The Expo mobile app is not deployed to Vercel. Vercel is only for the web app and serverless API.

## Folder Structure

```text
spendSight/
  app/             Expo mobile app
  api/             Vercel API entrypoints
  models/          Shared types and helpers
  scripts/         Dev and maintenance scripts
  server/          Express backend
  serverless/      Vercel serverless API handlers
  web/             Vite web app
```

Important web files:

- `web/app/page.tsx`: main web app UI.
- `web/app/lib/api.ts`: browser API client.
- `web/app/lib/finance.ts`: finance calculations and formatting helpers.
- `web/styles.css`: web styling.
- `web/public/manifest.webmanifest`: PWA-style app manifest.

Important mobile files:

- `app/App.tsx`: mobile app shell and tab routing.
- `app/src/screens/`: mobile screens.
- `app/src/services/api.ts`: mobile API client.
- `app/src/store/useAppStore.ts`: mobile app state.

Important backend files:

- `server/src/index.ts`: local Express server.
- `server/src/routes/`: local API routes.
- `server/src/models/`: MongoDB models.
- `server/src/utils/transactionEncryption.ts`: local encryption helpers.
- `serverless/transactionEncryption.ts`: Vercel encryption helpers.

## Environment Variables

Create `.env` from `.env.example`.

```env
EXPO_PUBLIC_API_URL=http://localhost:4000/api
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/DB_NAME?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-secret
TRANSACTION_ENCRYPTION_KEY=replace-with-a-different-long-random-secret
GEMINI_API_KEY=replace-with-your-gemini-key
GEMINI_RECEIPT_MODEL=gemini-2.5-flash-lite
GOOGLE_CLIENT_ID=replace-with-your-google-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_ID=replace-with-your-google-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=replace-with-your-google-android-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=replace-with-your-google-ios-client-id
```

Do not commit `.env`. It contains database credentials, JWT secrets, AI keys, and encryption keys.

## Transaction Encryption

Transaction private fields are encrypted before they are stored in MongoDB and decrypted by the API before being sent back to the signed-in user.

Required key:

```env
TRANSACTION_ENCRYPTION_KEY=put-a-long-random-secret-here
```

After adding or changing the key, run:

```sh
npm run encrypt:transactions
npm run check:transactions-encryption
```

For all databases in the MongoDB connection:

```sh
npm run encrypt:transactions:all
npm run check:transactions-encryption:all
```

Important: changing the encryption key after data has already been encrypted will make old encrypted data unreadable unless you migrate it with the old key.

## Commands

Use Node 20.19.4 or Node 22. The `.nvmrc` file pins the expected local version.

### Run Web On Windows CMD

```cmd
nvm use 20.20.0
npm install
npm run web
```

Then open:

```text
http://localhost:5173
```

If you do not use `nvm` on Windows, run:

```cmd
npm install
npm run web
```

### Run Web On macOS Or Linux

```sh
nvm use
npm install
npm run web
```

### Run Mobile

```sh
nvm use
npm install
npm run app
```

Android:

```sh
npm run android
```

iOS:

```sh
npm run ios
```

### Run Backend Only

```sh
npm run server
```

### Check And Build

```sh
npm run typecheck
npm run build
```

## Deploy To Vercel

Use these Vercel settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: project root

Add the production environment variables in Vercel:

- `MONGODB_URI`
- `JWT_SECRET`
- `TRANSACTION_ENCRYPTION_KEY`
- `GEMINI_API_KEY`
- `GEMINI_RECEIPT_MODEL`
- `GOOGLE_CLIENT_ID`

The deployed web app should call its own `/api` routes. Do not point production web traffic at `localhost`.

## PWA Notes

The web app has PWA-style pieces such as a web manifest and app icons. It can be installed by supported browsers when served over HTTPS. Full offline support would require a service worker and caching strategy; this project currently focuses on the installable web app flow and live API-backed data.
