const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("fs");
const path = require("path");

const { env } = require("./config/env");
const { getRedis } = require("./config/redis");
const { createRateLimiter, rateLimit, ipKey } = require("./middleware/rateLimiter");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/requestLogger");
const { makeAuthRouter } = require("./modules/auth/auth.router");
const { makeUsersRouter } = require("./modules/users/users.router");
const { makeCoursesRouter } = require("./modules/courses/courses.router");
const { makeSessionsRouter } = require("./modules/sessions/sessions.router");
const { makeBaselinesRouter } = require("./modules/baselines/baselines.router");
const { makeAssignmentsRouter } = require("./modules/assignments/assignments.router");
const { makeSubmissionsRouter } = require("./modules/submissions/submissions.router");
const { makeAnalysisRouter } = require("./modules/analysis/analysis.router");
const { notFound } = require("./utils/httpErrors");

function loadOpenApiSpec() {
  const p = path.resolve(__dirname, "..", "openapi.yaml");
  const raw = fs.readFileSync(p, "utf-8");
  return YAML.parse(raw);
}

function createApp() {
  const app = express();

  app.set("trust proxy", true);
  app.use(helmet());

  app.use(
    cors({
      origin: (origin, cb) => {
        // allow non-browser clients (no Origin header)
        if (!origin) return cb(null, true);
        if (env.CORS_ALLOWED_ORIGINS.length === 0) return cb(null, false);
        return cb(null, env.CORS_ALLOWED_ORIGINS.includes(origin));
      },
      credentials: false,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  if (env.NODE_ENV !== "test") {
    app.use(morgan("combined"));
    app.use(requestLogger());
  }

  const redis = getRedis(env.REDIS_URL);
  const authLimiter = createRateLimiter({
    redis,
    keyPrefix: "ratelimit:auth",
    points: env.AUTH_RATE_LIMIT_PER_MIN,
    durationSeconds: 60,
  });

  const loginRateLimit = rateLimit(authLimiter, (req) => `login:${ipKey(req)}`);
  const registerRateLimit = rateLimit(authLimiter, (req) => `register:${ipKey(req)}`);

  const api = express.Router();
  api.use("/auth", makeAuthRouter({ loginRateLimit, registerRateLimit }));
  api.use("/users", makeUsersRouter());
  api.use("/courses", makeCoursesRouter());
  api.use("/sessions", makeSessionsRouter());
  api.use("/baselines", makeBaselinesRouter({ maxFileSizeMb: 5 }));
  api.use("/assignments", makeAssignmentsRouter());
  api.use("/submissions", makeSubmissionsRouter({ maxFileSizeMb: 5 }));
  api.use("/analysis", makeAnalysisRouter());

  app.use("/api/v1", api);

  const spec = loadOpenApiSpec();
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use((req, res, next) => next(notFound("Route not found")));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

