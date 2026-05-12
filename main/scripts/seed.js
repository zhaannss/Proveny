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
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log("Seeded admin:", email, "password:", password);
  }

  const rules = [
    {
      technique: "circuit_breaker",
      prerequisites: ["async_await", "custom_error_hierarchy"],
      severityWeight: 0.8,
      description: "Circuit breaker requires async/await and custom error handling foundation",
    },
    {
      technique: "dependency_injection",
      prerequisites: ["class_based_architecture"],
      severityWeight: 0.7,
      description: "Dependency injection requires class-based architecture",
    },
    {
      technique: "service_repository_pattern",
      prerequisites: ["class_based_architecture", "custom_error_hierarchy"],
      severityWeight: 0.9,
      description: "Service repository pattern requires classes and structured errors",
    },
  ];

  for (const rule of rules) {
    await prisma.techniquePrerequisite.upsert({
      where: { technique: rule.technique },
      update: rule,
      create: rule,
    });
  }
  console.log("Seeded technique prerequisite rules.");
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

