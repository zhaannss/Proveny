const express = require("express");
const { createUserSchema, updateUserSchema } = require("./users.schema");
const usersService = require("./users.service");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { badRequest } = require("../../utils/httpErrors");

function parseIntParam(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function makeUsersRouter() {
  const router = express.Router();

  router.use(authRequired);
  router.use(requireRole("ADMIN"));

  router.get("/", async (req, res, next) => {
    try {
      const page = parseIntParam(req.query.page, 1);
      const limit = Math.min(100, parseIntParam(req.query.limit, 20));
      const role = req.query.role;
      const isActive =
        typeof req.query.isActive === "string" ? req.query.isActive === "true" : undefined;

      const result = await usersService.listUsers({ page, limit, role, isActive });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await usersService.createUser(data);
      return res.status(201).json(user);
    } catch (err) {
      return next(err);
    }
  });

  router.get("/:userId", async (req, res, next) => {
    try {
      const userId = req.params.userId;
      if (!userId) throw badRequest("userId required");
      const user = await usersService.getUserById(userId);
      return res.status(200).json(user);
    } catch (err) {
      return next(err);
    }
  });

  router.patch("/:userId", async (req, res, next) => {
    try {
      const userId = req.params.userId;
      if (!userId) throw badRequest("userId required");
      const patch = updateUserSchema.parse(req.body);
      const user = await usersService.updateUser(userId, patch);
      return res.status(200).json(user);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { makeUsersRouter };

