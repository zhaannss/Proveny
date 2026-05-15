const { z } = require("zod");

const createSessionSchema = z.object({
  courseId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  networkIsolated: z.boolean().optional().default(false),
});

const listSessionsQuerySchema = z.object({
  courseId: z.string().uuid().optional(),
  status: z.enum(["SCHEDULED", "ACTIVE", "LOCKED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { createSessionSchema, listSessionsQuerySchema };

