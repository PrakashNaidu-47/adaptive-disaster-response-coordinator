require("dotenv").config();
const cors = require("cors");
const express = require("express");

const { connectDB } = require("./config/db");
const disasterRoutes = require("./routes/disasterRoutes");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Adaptive Disaster Response Backend",
    status: "ok",
    docs: "/api/disaster/health",
  });
});

app.use("/api/disaster", disasterRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error." });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Backend gateway listening on port ${PORT}`);
  });
};

startServer();
