const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { unauthorized } = require("../utils/httpErrors");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("Missing access token"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    return next();
  } catch {
    return next(unauthorized("Invalid or expired access token"));
  }
}

module.exports = { authRequired };

