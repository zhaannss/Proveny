require("dotenv").config();

const bcrypt = require("bcrypt");
const { getPrisma, disconnectPrisma } = require("../src/config/prisma");

async function main() {
  const prisma = getPrisma();

  const email = process.env.SEED_ADMIN_EMAIL || "admin@syllab.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "AdminPass123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed admin already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Seeded admin:", email, "password:", password);
}

main()
  .then(async () => {
    await disconnectPrisma();
  })
  .catch(async (e) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });

