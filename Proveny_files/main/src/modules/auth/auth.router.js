const express = require("express");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} = require("./auth.schema");
const authService = require("./auth.service");
const { authRequired } = require("../../middleware/auth");
const { badRequest } = require("../../utils/httpErrors");

function makeAuthRouter({ loginRateLimit, registerRateLimit, authGeneralRateLimit }) {
  const router = express.Router();

  router.post("/register", registerRateLimit, async (req, res, next) => {
    try {
      const data = registerSchema.parse(req.body);
      await authService.register(data);
      return res.status(201).json({
        message: "Registration successful. Please check your email to verify your account before logging in.",
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get("/verify-email", authGeneralRateLimit, async (req, res, next) => {
    try {
      const token = req.query.token;
      if (!token || typeof token !== "string") throw badRequest("Missing verification token");
      const result = await authService.verifyEmail({ token });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.post("/resend-verification", registerRateLimit, async (req, res, next) => {
    try {
      const data = resendVerificationSchema.parse(req.body);
      const result = await authService.resendVerification(data);
      return res.status(200).json(result);
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

  router.post("/forgot-password", loginRateLimit, async (req, res, next) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(data);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.post("/reset-password", loginRateLimit, async (req, res, next) => {
    try {
      const data = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(data);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { makeAuthRouter };
