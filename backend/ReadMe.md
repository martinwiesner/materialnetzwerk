# Material Library Backend

Backend API for Material Library – managing materials, projects, actors, and inventories with environmental impact tracking (GWP).

## Features

- **Material Database**: Create and manage materials with metadata, environmental data (GWP), and inventory quantities
- **Project Management**: Projects containing products, which consist of components made of materials
- **Inventory Management**: Configure inventories with geolocation, transfer/gift materials between users
- **User Relationships**: Material sharing and transfer between users
- **Image Uploads**: Projects and actors support image uploads
- **Zitadel OIDC Authentication**: All user identity is managed by Zitadel; no passwords stored locally

## Tech Stack

- **Node.js** with Express.js
- **SQLite** (via better-sqlite3) — serverless SQL database
- **Zitadel OIDC** — JWT verification via JWKS (no local JWT signing)
- **Swagger/OpenAPI** — API documentation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Zitadel instance (Cloud: [zitadel.com](https://zitadel.com) or self-hosted)

### Zitadel Setup

1. Create a Zitadel project
2. Add a **User Agent** application (PKCE flow, no client secret)
3. Set redirect URIs: `http://localhost:5173/callback` (dev) and your production URL
4. Copy the **instance domain** (e.g. `your-org.eu1.zitadel.cloud`) into `ZITADEL_DOMAIN`

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:

   ```bash
   cp CHANGE.env .env
   # or copy from .env.secret if you have the pre-filled backup
   ```

   Set at minimum:
   ```
   ZITADEL_DOMAIN=your-instance.eu1.zitadel.cloud
   ```

   The server performs a fail-fast check on startup and will exit if `ZITADEL_DOMAIN` is missing.

4. Initialize the database (optional — auto-created on first run):

   ```bash
   npm run db:init
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Promote a user to Admin

After a user has logged in at least once via Zitadel:

```bash
node scripts/create-admin.js <email-or-zitadel-sub>
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

SQLite database is automatically created at `./data/material_library.db`.

To reset/reinitialize:
```bash
npm run db:init
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|---------|
| `ZITADEL_DOMAIN` | Zitadel instance domain (without `https://`) | ✅ |
| `PORT` | Server port | no (default: 8081) |
| `NODE_ENV` | Environment | no (default: development) |
| `DB_PATH` | SQLite database path | no |
| `UPLOAD_PATH` | File upload directory | no |
| `FRONTEND_URL` | Frontend origin for CORS allow-list | no |
| `APP_URL` | Public app URL used in outbound links | no |
| `VAPID_PUBLIC_KEY` | Web Push public key | no |
| `VAPID_PRIVATE_KEY` | Web Push private key | no |
| `VAPID_SUBJECT` | Contact e-mail for VAPID | no |
| `BREVO_API_KEY` | Brevo transactional email API key | no |
| `BREVO_FROM_EMAIL` | Sender address (must be verified in Brevo) | no |
| `BREVO_FROM_NAME` | Sender display name | no |
| `SEED_ON_START` | Auto-seed empty DB on start (dev only) | no |

See `CHANGE.env` / `.env.example` for a full annotated template.  
Private pre-filled values → `backend/.env.secret` (git-ignored).

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

## License

ISC
