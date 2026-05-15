const { getPrisma } = require("../config/prisma");

function requestLogger() {
  return async (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", async () => {
      try {
        const prisma = getPrisma();
        const userId = req.user?.id || null;
        const ipAddress = (() => {
          const xff = req.headers["x-forwarded-for"];
          if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
          return req.ip || null;
        })();

        await prisma.auditLog.create({
          data: {
            userId,
            action: "HTTP_REQUEST",
            resourceType: "HTTP",
            resourceId: `${req.method} ${req.originalUrl}`,
            oldValue: null,
            newValue: {
              statusCode: res.statusCode,
              durationMs: Date.now() - startedAt,
            },
            ipAddress,
          },
        });
      } catch {
        // never block response
      }
    });
    return next();
  };
}

module.exports = { requestLogger };

