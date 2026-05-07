# Material Library Frontend

A React frontend for the Material Library application, built with Vite, TailwindCSS, and React Query.

## Features

- **Authentication** — Zitadel OIDC (OpenID Connect) via PKCE; no passwords stored locally
- **Materials Management** — CRUD operations for sustainable materials with GWP tracking
- **Projects** — Organize materials into projects with step-by-step instructions
- **Inventory** — Track material stock with transfer and gifting capabilities
- **Actors** — Makerspaces, Repair Cafés, businesses, etc.
- **Contacts** — Network management for material sharing
- **Explore** — Map-based exploration view
- **Web Push Notifications** — Optional push subscription

## Tech Stack

- **React 18** — UI library
- **Vite** — Build tool
- **TailwindCSS** — Styling
- **React Query** — Data fetching and caching
- **Zustand** — State management
- **React Router** — Routing
- **Axios** — HTTP client
- **oidc-client-ts** — Zitadel OIDC integration
- **Lucide React** — Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A configured Zitadel instance (see root README for setup steps)

### Installation

```bash
# Install dependencies
npm install

# Create your environment file
cp .env.example .env.local
# Edit .env.local — fill in VITE_ZITADEL_AUTHORITY and VITE_ZITADEL_CLIENT_ID

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file (git-ignored):

```env
# Leave empty in Docker — nginx proxies /api automatically
VITE_API_URL=

# Full URL of your Zitadel instance
VITE_ZITADEL_AUTHORITY=https://your-instance.eu1.zitadel.cloud

# Client ID of the "User Agent" app in Zitadel
VITE_ZITADEL_CLIENT_ID=your-client-id
```

Private pre-filled values → `frontend/.env.secret` (git-ignored).

## Docker

### Development

```bash
# Run with docker-compose (includes backend)
docker compose -f docker-compose.dev.yml up --build
```

### Production

```bash
# Build and run production
docker compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8081

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Layout.jsx       # Main layout with sidebar
│   ├── materials/       # Material-specific components
│   ├── projects/        # Project-specific components
│   ├── products/        # Product-specific components
│   └── inventory/       # Inventory-specific components
├── pages/               # Page components
│   ├── auth/            # Login, Register
│   ├── dashboard/       # Dashboard
│   ├── materials/       # Materials list
│   ├── projects/        # Projects list
│   ├── products/        # Products list
│   ├── inventory/       # Inventory management
│   └── contacts/        # Contacts management
├── services/            # API service layer
├── store/               # Zustand stores
├── App.jsx              # Main app with routing
├── main.jsx             # Entry point
└── index.css            # Global styles
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## API Endpoints

The frontend connects to the following backend API endpoints:

- `/api/auth/*` - Authentication
- `/api/materials/*` - Materials management
- `/api/projects/*` - Projects management
- `/api/products/*` - Products management
- `/api/components/*` - Components management
- `/api/inventory/*` - Inventory management
- `/api/relationships/*` - Contacts/relationships
