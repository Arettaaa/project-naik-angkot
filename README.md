# NAIK ANGKOT
### WebGIS Trayek Angkutan Kota Bogor

NAIK ANGKOT is a WebGIS application designed to visualize and explore angkot routes in Bogor through an interactive map.

## Technologies

- **Frontend:** React, Vite, Tailwind CSS, Leaflet
- **Backend:** Laravel REST API
- **Database:** PostgreSQL, PostGIS
- **GIS Processing:** QGIS
- **Basemap:** OpenStreetMap

## Project Structure

```text
project_naik_angkot/
├── data/
├── frontend/
├── backend/
└── README.md
```

## Features

- Interactive map visualization
- Angkot route information
- Spatial data integration
- Route density visualization
- Route search (planned)

## Development Status

Currently in development, with a target of 30 angkot routes. Route data validation, API integration, and frontend implementation are ongoing.

## Getting Started

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Backend**
```bash
cd backend
composer install
php artisan serve
```

## Git Branches

This project uses three branches to organize development:

- **`main`** — Main branch for the integrated project.
- **`fe`** — Frontend development using React, Vite, Tailwind CSS, and Leaflet.
- **`be`** — Backend development using Laravel REST API and PostgreSQL/PostGIS integration.

Frontend and backend development are maintained separately and can be integrated into `main` when ready.
```

Configure the `.env` file and PostgreSQL/PostGIS connection before running the backend.

---

**NAIK ANGKOT** — Mapping Urban Mobility in Bogor.
