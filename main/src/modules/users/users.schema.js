const { z } = require("zod");

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(["STUDENT", "INSTRUCTOR", "PROCTOR", "ADMIN"]),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["STUDENT", "INSTRUCTOR", "PROCTOR", "ADMIN"]).optional(),
});

module.exports = { createUserSchema, updateUserSchema };

