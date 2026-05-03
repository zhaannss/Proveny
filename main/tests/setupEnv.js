process.env.NODE_ENV = "test";
process.env.PORT = "3000";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test_db";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_jwt_secret_min_32_chars__________";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret_min_32_chars_______";

process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || "http://localhost:5173";
process.env.AUTH_RATE_LIMIT_PER_MIN = process.env.AUTH_RATE_LIMIT_PER_MIN || "1000";

