const { z } = require("zod");

const createCourseSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().regex(/^[A-Z]{2,6}[0-9]{3}-[0-9]{4}$/, "Invalid course code format"),
  weeklyTargets: z.record(z.string(), z.number().min(0).max(100)),
});

module.exports = { createCourseSchema };

