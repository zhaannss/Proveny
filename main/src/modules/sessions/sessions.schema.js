const { z } = require("zod");

const createSessionSchema = z.object({
  courseId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  networkIsolated: z.boolean().optional().default(false),
});

module.exports = { createSessionSchema };

