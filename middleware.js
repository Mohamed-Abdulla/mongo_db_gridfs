// apiKeyMiddleware.js
const API_KEY = process.env.SERVER_API_KEY;

function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== API_KEY) {
    return res.status(403).json({ detail: "Forbidden" });
  }

  next();
}

module.exports = apiKeyMiddleware;
