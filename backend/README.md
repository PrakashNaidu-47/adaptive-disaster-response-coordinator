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
- `POST /api/disaster/alerts/send`
- `GET /api/disaster/history?limit=12`
- `GET /api/disaster/history/:id`

## Environment

- `PORT`
- `MONGO_URI`
- `PYTHON_API_URL`
- `CORS_ORIGIN`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BREVO_REPLY_TO`
