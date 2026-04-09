# Backend (Express + Mongo)

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Default local URL: `http://127.0.0.1:5000`

## Endpoints

- `GET /api/disaster/health`
- `GET /api/disaster/historical-events`
- `POST /api/disaster/simulate`
- `GET /api/disaster/history?limit=12`
- `GET /api/disaster/history/:id`

## Environment

- `PORT`
- `MONGO_URI`
- `PYTHON_API_URL`
- `CORS_ORIGIN`
