const express = require("express");
const { registerSchema, loginSchema, refreshSchema } = require("./auth.schema");
const authService = require("./auth.service");
const { authRequired } = require("../../middleware/auth");
const { badRequest } = require("../../utils/httpErrors");

function makeAuthRouter({ loginRateLimit, registerRateLimit }) {
  const router = express.Router();

  router.post("/register", registerRateLimit, async (req, res, next) => {
    try {
      const data = registerSchema.parse(req.body);
      await authService.register(data);
      // Auto-login after registration to satisfy baseline flow.
      const tokens = await authService.login({ email: data.email, password: data.password });
      return res.status(201).json(tokens);
    } catch (err) {
      return next(err);
    }
  });

  router.post("/login", loginRateLimit, async (req, res, next) => {
    try {
      const data = loginSchema.parse(req.body);
      const tokens = await authService.login(data);
      return res.status(200).json(tokens);
    } catch (err) {
      return next(err);
    }
  });

  router.post("/refresh", loginRateLimit, async (req, res, next) => {
    try {
      const data = refreshSchema.parse(req.body);
      const tokens = await authService.refresh(data);
      return res.status(200).json(tokens);
    } catch (err) {
      return next(err);
    }
  });

  router.post("/logout", authRequired, async (req, res, next) => {
    try {
      if (!req.user?.id) throw badRequest("Missing user");
      await authService.logout({ userId: req.user.id });
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { makeAuthRouter };

