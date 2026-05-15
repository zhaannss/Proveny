/* global jest */

jest.mock("../../../src/config/prisma", () => ({
  getPrisma: jest.fn(),
}));

jest.mock("../../../src/config/queue", () => ({
  enqueueAnalysis: jest.fn().mockResolvedValue(undefined),
}));

const { getPrisma } = require("../../../src/config/prisma");
const submissionsService = require("../../../src/modules/submissions/submissions.service");

describe("submissions business rules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects assignment submission until proctored baseline is locked", async () => {
    getPrisma.mockReturnValue({
      assignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "assignment-1",
          courseId: "course-1",
          dueDate: new Date(Date.now() + 60_000),
          course: { id: "course-1" },
        }),
      },
      courseEnrollment: {
        findUnique: jest.fn().mockResolvedValue({ id: "enrollment-1" }),
      },
      baseline: {
        findUnique: jest.fn().mockResolvedValue({ id: "baseline-1", isLocked: false }),
      },
    });

    await expect(
      submissionsService.submitAssignment({
        actor: { id: "student-1", role: "STUDENT" },
        assignmentId: "assignment-1",
        source: "function add(a, b) { return a + b; }",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Your proctored baseline must be locked before assignment submissions open",
    });
  });
});
