const { RateLimiterRedis } = require("rate-limiter-flexible");

function createRateLimiter({ redis, keyPrefix, points, durationSeconds }) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: durationSeconds,
    inmemoryBlockOnConsumed: points + 1,
    inmemoryBlockDuration: durationSeconds,
  });
}

function rateLimit(limiter, keyFn) {
  return async (req, res, next) => {
    try {
      const key = keyFn(req);
      await limiter.consume(key);
      return next();
    } catch (rejRes) {
      // Minimal standardized error; openapi has generic 400/401/403/422/500, but 429 is required by assignment.
      const retryAfter = Math.max(1, Math.ceil((rejRes?.msBeforeNext || 1000) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        statusCode: 429,
        error: "Too Many Requests",
        message: "Rate limit exceeded",
      });
    }
  };
}

function ipKey(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.ip || "unknown";
}

module.exports = { createRateLimiter, rateLimit, ipKey };

