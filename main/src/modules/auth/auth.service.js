const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { env } = require("../../config/env");
const { getPrisma } = require("../../config/prisma");
const { getRedis } = require("../../config/redis");
const { enqueueEmail } = require("../../config/queue");
const { conflict, unauthorized, badRequest } = require("../../utils/httpErrors");
const { verificationEmailHtml, passwordResetEmailHtml } = require("../../utils/emailTemplates");

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
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationExpires = new Date(Date.now() + env.EMAIL_VERIFY_TTL_HOURS * 3600 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: "STUDENT",
      isEmailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
    },
  });

  const verifyUrl = `${env.APP_BASE_URL}/api/v1/auth/verify-email?token=${emailVerificationToken}`;
  await enqueueEmail({
    to: email,
    subject: "Verify your SylLab account",
    html: verificationEmailHtml({ firstName, verifyUrl }),
  });

  return user;
}

async function verifyEmail({ token }) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });
  if (!user) throw badRequest("Invalid or expired verification token");
  if (user.isEmailVerified) throw badRequest("Email already verified");
  if (user.emailVerificationExpires < new Date()) {
    throw badRequest("Verification token has expired. Please request a new one.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { message: "Email verified successfully. You can now log in." };
}

async function resendVerification({ email }) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isEmailVerified) {
    return { message: "If that email exists and is unverified, a new link has been sent." };
  }

  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationExpires = new Date(Date.now() + env.EMAIL_VERIFY_TTL_HOURS * 3600 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken, emailVerificationExpires },
  });

  const verifyUrl = `${env.APP_BASE_URL}/api/v1/auth/verify-email?token=${emailVerificationToken}`;
  await enqueueEmail({
    to: email,
    subject: "Verify your SylLab account - new link",
    html: verificationEmailHtml({ firstName: user.firstName, verifyUrl }),
  });

  return { message: "If that email exists and is unverified, a new link has been sent." };
}

async function login({ email, password }) {
  const prisma = getPrisma();
  const redis = getRedis(env.REDIS_URL);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw unauthorized("Invalid email or password");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid email or password");
  if (!user.isEmailVerified) throw unauthorized("Please verify your email address before logging in.");

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
  if (!user.isEmailVerified) throw unauthorized("Please verify your email address before refreshing tokens.");

  const accessToken = signAccessToken({ userId, role });
  const newJti = crypto.randomUUID();
  const newRefreshToken = signRefreshToken({ userId, role, jti: newJti });
  const refreshTtl = parseExpiresInSeconds(env.JWT_REFRESH_EXPIRES_IN);

  const multi = redis.multi();
  multi.del(refreshKey(jti));
  multi.srem(userRefreshSetKey(userId), jti);
  multi.set(refreshKey(newJti), userId, "EX", refreshTtl);
  multi.sadd(userRefreshSetKey(userId), newJti);
  multi.expire(userRefreshSetKey(userId), refreshTtl);
  await multi.exec();

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_EXPIRES_SECONDS,
    user: { id: userId, email: user.email, role },
  };
}

async function logout({ userId }) {
  const redis = getRedis(env.REDIS_URL);
  await revokeAllRefreshTokensForUser({ redis, userId });
}

async function forgotPassword({ email }) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !user.isEmailVerified) {
    return { message: "If that email is registered, a reset link has been sent." };
  }

  const passwordResetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetExpires = new Date(Date.now() + env.PASSWORD_RESET_TTL_HOURS * 3600 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken, passwordResetExpires },
  });

  const resetUrl = `${env.APP_BASE_URL}/api/v1/auth/reset-password?token=${passwordResetToken}`;
  await enqueueEmail({
    to: email,
    subject: "Reset your SylLab password",
    html: passwordResetEmailHtml({ firstName: user.firstName, resetUrl }),
  });

  return { message: "If that email is registered, a reset link has been sent." };
}

async function resetPassword({ token, newPassword }) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
  if (!user) throw badRequest("Invalid or expired password reset token");
  if (user.passwordResetExpires < new Date()) {
    throw badRequest("Password reset token has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  const redis = getRedis(env.REDIS_URL);
  await revokeAllRefreshTokensForUser({ redis, userId: user.id });
  return { message: "Password reset successfully. Please log in with your new password." };
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  revokeAllRefreshTokensForUser,
};
