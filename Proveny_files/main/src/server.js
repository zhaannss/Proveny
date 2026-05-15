require("dotenv").config();

const http = require("http");
const { env } = require("./config/env");
const { createApp } = require("./app");
const { disconnectPrisma } = require("./config/prisma");
const { disconnectRedis } = require("./config/redis");

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    console.log(`SylLab API listening on port ${env.PORT}`);
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await disconnectPrisma();
      await disconnectRedis();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

