# Material Library Backend

Backend API for Material Library - managing materials, projects, products, components, and inventories with environmental impact tracking (GWP).

## Features

- **Material Database**: Create and manage materials with metadata, environmental data (GWP), and inventory quantities
- **Project Management**: Projects containing products, which consist of components made of materials
- **Inventory Management**: Configure inventories with geolocation, transfer/gift materials between users
- **User Relationships**: Material sharing and transfer between users
- **Image Uploads**: Projects support image uploads

## Tech Stack

- **Node.js** with Express.js
- **SQLite** (via better-sqlite3) - Free, serverless SQL database
- **JWT** for authentication
- **Swagger/OpenAPI** for API documentation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   
   - Copy `.env.example` to **`.env`** (recommended)
   - or keep using **`change.env`** (also supported)

   ```bash
   cp .env.example .env
   ```

   **Important:** `JWT_SECRET` is required. The server will fail fast if it's missing.

4. Initialize the database (optional):

   The server will auto-create the DB schema on first run.
   If you want to explicitly initialize it:

   ```bash
   npm run db:init
   ```

   For local development you can enable non-destructive demo seeding:

   - set `SEED_ON_START=true` in `.env` / `change.env`
   - demo login defaults to `demo@local` / `demo` (configurable via `DEMO_EMAIL` / `DEMO_PASSWORD`)

5. Start the development server:
   ```bash
   npm run dev
   ```

### Generate Swagger Documentation

```bash
npm run swagger
```

## API Documentation

Once the server is running, access Swagger UI at:
- Local: http://localhost:8081/api/docs

## Docker

### Development
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## Database

The project uses SQLite, a serverless SQL database. The database file is automatically created at `./data/material_library.db`.

To reset/reinitialize the database:
```bash
npm run db:init
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Materials
- `GET /api/materials` - List all materials
- `POST /api/materials` - Create material
- `GET /api/materials/:id` - Get material by ID
- `PUT /api/materials/:id` - Update material
- `DELETE /api/materials/:id` - Delete material

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project with products/components
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/images` - Upload project images

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product with components
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Components
- `GET /api/components` - List components
- `POST /api/components` - Create component
- `GET /api/components/:id` - Get component with materials
- `PUT /api/components/:id` - Update component
- `DELETE /api/components/:id` - Delete component
- `POST /api/components/:id/materials` - Add material to component
- `DELETE /api/components/:id/materials/:materialId` - Remove material from component

### Inventory
- `GET /api/inventory` - List user's inventories
- `POST /api/inventory` - Create inventory entry
- `PUT /api/inventory/:id` - Update inventory
- `DELETE /api/inventory/:id` - Delete inventory
- `POST /api/inventory/:id/transfer` - Transfer materials to another user
- `POST /api/inventory/:id/gift` - Gift materials to another user

### User Relationships
- `GET /api/relationships` - List user relationships
- `POST /api/relationships` - Create relationship request
- `PUT /api/relationships/:id` - Accept/reject relationship
- `DELETE /api/relationships/:id` - Remove relationship

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 8081 |
| NODE_ENV | Environment | development |
| JWT_SECRET | JWT signing secret | - |
| DB_PATH | SQLite database path | ./data/material_library.db |
| UPLOAD_PATH | File upload directory | ./uploads |

## License

ISC
