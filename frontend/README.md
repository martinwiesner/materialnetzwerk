# Material Library Frontend

A React frontend for the Material Library application, built with Vite, TailwindCSS, and React Query.

## Features

- 🔐 **Authentication** - Login and registration with JWT tokens
- 📦 **Materials Management** - CRUD operations for sustainable materials with GWP tracking
- 📁 **Projects** - Organize materials into projects
- 📦 **Products** - Manage product catalog
- 🏭 **Inventory** - Track material stock with transfer and gifting capabilities
- 👥 **Contacts** - Network management for material sharing

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Query** - Data fetching and caching
- **Zustand** - State management
- **React Router** - Routing
- **Axios** - HTTP client
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8081
```

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
