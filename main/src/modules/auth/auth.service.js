const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { env } = require("../../config/env");
const { getPrisma } = require("../../config/prisma");
const { getRedis } = require("../../config/redis");
const { conflict, unauthorized } = require("../../utils/httpErrors");

const ACCESS_EXPIRES_SECONDS = 15 * 60;

function signAccessToken({ userId, role }) {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function signRefreshToken({ userId, role, jti }) {
  return jwt.sign({ role }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    jwtid: jti,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

function refreshKey(jti) {
  return `refresh:${jti}`;
}

function userRefreshSetKey(userId) {
  return `refreshset:${userId}`;
}

async function storeRefreshToken({ redis, userId, jti, ttlSeconds }) {
  const multi = redis.multi();
  multi.set(refreshKey(jti), userId, "EX", ttlSeconds);
  multi.sadd(userRefreshSetKey(userId), jti);
  multi.expire(userRefreshSetKey(userId), ttlSeconds);
  await multi.exec();
}

async function revokeAllRefreshTokensForUser({ redis, userId }) {
  const setKey = userRefreshSetKey(userId);
  const jtis = await redis.smembers(setKey);
  if (jtis.length > 0) {
    const multi = redis.multi();
    for (const jti of jtis) multi.del(refreshKey(jti));
    multi.del(setKey);
    await multi.exec();
  } else {
    await redis.del(setKey);
  }
}

function parseExpiresInSeconds(expiresIn) {
  // minimal parser for "7d" / "15m" / "3600"
  if (/^\d+$/.test(expiresIn)) return Number(expiresIn);
  const m = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!m) return 7 * 24 * 3600;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === "s") return n;
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 3600;
  return n * 24 * 3600;
}

async function register({ email, password, firstName, lastName }) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict("Email already in use");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role: "STUDENT" },
  });
  return user;
}

async function login({ email, password }) {
  const prisma = getPrisma();
  const redis = getRedis(env.REDIS_URL);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw unauthorized("Invalid email or password");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid email or password");

  const accessToken = signAccessToken({ userId: user.id, role: user.role });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, jti });
  const refreshTtl = parseExpiresInSeconds(env.JWT_REFRESH_EXPIRES_IN);
  await storeRefreshToken({ redis, userId: user.id, jti, ttlSeconds: refreshTtl });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES_SECONDS,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

async function refresh({ refreshToken }) {
  const prisma = getPrisma();
  const redis = getRedis(env.REDIS_URL);

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw unauthorized("Invalid or expired refresh token");
  }

  const userId = payload.sub;
  const role = payload.role;
  const jti = payload.jti;
  if (!userId || !role || !jti) throw unauthorized("Invalid refresh token");

  const exists = await redis.get(refreshKey(jti));
  if (!exists || exists !== userId) throw unauthorized("Refresh token revoked");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw unauthorized("Invalid or expired refresh token");

  const accessToken = signAccessToken({ userId, role });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES_SECONDS,
    user: { id: userId, email: user.email, role },
  };
}

async function logout({ userId }) {
  const redis = getRedis(env.REDIS_URL);
  await revokeAllRefreshTokensForUser({ redis, userId });
}

module.exports = { register, login, refresh, logout, revokeAllRefreshTokensForUser };

