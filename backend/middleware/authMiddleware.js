const axios = require("axios");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://gvermgjeqpbeoaacsupq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_W0uqAFU7OhF9XClNTwTLCA_ht54N1_t";

const requireAuth = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const response = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      timeout: 12000,
    });

    req.user = response.data;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
};

module.exports = {
  requireAuth,
};
