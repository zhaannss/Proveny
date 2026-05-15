const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ALLOWED_ORIGINS: z.string().default(""),
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),

  SMTP_HOST: z.string().default("smtp.mailtrap.io"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("noreply@syllab.io"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_VERIFY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_HOURS: z.coerce.number().int().positive().default(1),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

function parseAllowedOrigins(raw) {
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Production must never allow wildcard.
  if (process.env.NODE_ENV === "production" && origins.includes("*")) {
    throw new Error("CORS_ALLOWED_ORIGINS must not include '*' in production");
  }

  return origins;
}

const env = envSchema.parse(process.env);
if (env.NODE_ENV === "production") {
  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing production email configuration: ${missing.join(", ")}`);
  }
}
env.CORS_ALLOWED_ORIGINS = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);

module.exports = { env };

