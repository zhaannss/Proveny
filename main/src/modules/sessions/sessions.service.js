const { getPrisma } = require("../../config/prisma");
const { notFound, conflict, forbidden } = require("../../utils/httpErrors");

function genCode() {
  // 6 chars alphanumeric
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function toSessionResponse(s) {
  return {
    id: s.id,
    courseId: s.courseId,
    proctorId: s.proctorId,
    sessionCode: s.sessionCode,
    networkIsolated: s.networkIsolated,
    status: s.status,
    startTime: s.startTime,
    endTime: s.endTime,
    lockedAt: s.lockedAt,
  };
}

async function createSession({ actor, courseId, startTime, endTime, networkIsolated }) {
  const prisma = getPrisma();
  if (!["INSTRUCTOR", "PROCTOR"].includes(actor.role)) throw forbidden("Forbidden");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound(`Course with id '${courseId}' not found`);

  // Ensure instructor is creating sessions for their course (unless admin)
  if (actor.role === "INSTRUCTOR" && course.instructorId !== actor.id) {
    throw forbidden("Cannot create sessions for another instructor's course");
  }

  let sessionCode = genCode();
  // low-collision loop
  while (true) {
    const exists = await prisma.proctoredSession.findUnique({ where: { sessionCode } });
    if (!exists) break;
    sessionCode = genCode();
  }

  const session = await prisma.proctoredSession.create({
    data: {
      courseId,
      proctorId: actor.id,
      sessionCode,
      networkIsolated,
      status: "SCHEDULED",
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  });

  return toSessionResponse(session);
}

async function activateSession({ actor, sessionId }) {
  const prisma = getPrisma();
  const session = await prisma.proctoredSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound(`Session with id '${sessionId}' not found`);

  if (actor.role !== "PROCTOR") throw forbidden("Only PROCTOR role can perform this action");
  if (session.status !== "SCHEDULED") throw conflict("Session is not in SCHEDULED status");

  const updated = await prisma.proctoredSession.update({
    where: { id: sessionId },
    data: { status: "ACTIVE" },
  });
  return toSessionResponse(updated);
}

async function lockSession({ actor, sessionId }) {
  const prisma = getPrisma();
  const session = await prisma.proctoredSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound(`Session with id '${sessionId}' not found`);
  if (actor.role !== "PROCTOR") throw forbidden("Only PROCTOR role can perform this action");
  if (session.status !== "ACTIVE") throw conflict("Session is not in ACTIVE status");

  const lockedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.proctoredSession.update({
      where: { id: sessionId },
      data: { status: "LOCKED", lockedAt },
    });

    await tx.baseline.updateMany({
      where: { sessionId },
      data: { isLocked: true },
    });

    return s;
  });

  return toSessionResponse(updated);
}

async function findActiveSessionByCode(sessionCode) {
  const prisma = getPrisma();
  const session = await prisma.proctoredSession.findUnique({ where: { sessionCode } });
  if (!session) throw notFound("Invalid sessionCode");
  if (session.status !== "ACTIVE") throw forbidden("Session is not active");
  const now = new Date();
  if (now < session.startTime || now > session.endTime) throw forbidden("Outside session window");
  return session;
}

module.exports = { createSession, activateSession, lockSession, findActiveSessionByCode };

