const bcrypt = require("bcrypt");
const { getPrisma } = require("../../config/prisma");
const { conflict, notFound } = require("../../utils/httpErrors");

function toUserResponse(u) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

async function createUser(data) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw conflict("Email already in use");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isEmailVerified: true,
    },
  });
  return toUserResponse(user);
}

async function listUsers({ page, limit, role, isActive }) {
  const prisma = getPrisma();
  const skip = (page - 1) * limit;

  const where = {};
  if (role) where.role = role;
  if (typeof isActive === "boolean") where.isActive = isActive;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    data: users.map(toUserResponse),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getUserById(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound(`User with id '${userId}' not found`);
  return toUserResponse(user);
}

async function updateUser(userId, patch) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw notFound(`User with id '${userId}' not found`);

  const user = await prisma.user.update({ where: { id: userId }, data: patch });
  return toUserResponse(user);
}

module.exports = { createUser, listUsers, getUserById, updateUser };

