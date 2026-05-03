const { z } = require("zod");

const createAssignmentSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(300),
  weekNumber: z.number().int().min(1).max(16),
  expectedScore: z.number().min(0).max(100),
  dueDate: z.string().datetime(),
});

module.exports = { createAssignmentSchema };

