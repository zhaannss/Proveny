const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { createSessionSchema } = require("./sessions.schema");
const sessionsService = require("./sessions.service");

function makeSessionsRouter() {
  const router = express.Router();
  router.use(authRequired);

  router.post("/", requireRole("INSTRUCTOR", "PROCTOR"), async (req, res, next) => {
    try {
      const data = createSessionSchema.parse(req.body);
      const session = await sessionsService.createSession({ actor: req.user, ...data });
      return res.status(201).json(session);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/:sessionId/activate", requireRole("PROCTOR"), async (req, res, next) => {
    try {
      const session = await sessionsService.activateSession({ actor: req.user, sessionId: req.params.sessionId });
      return res.status(200).json(session);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/:sessionId/lock", requireRole("PROCTOR"), async (req, res, next) => {
    try {
      const session = await sessionsService.lockSession({ actor: req.user, sessionId: req.params.sessionId });
      return res.status(200).json(session);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeSessionsRouter };

