const jwt = require("jsonwebtoken");

/* global jest */

jest.mock("../../../src/config/prisma", () => ({
  getPrisma: jest.fn(),
}));

jest.mock("../../../src/config/redis", () => ({
  getRedis: jest.fn(),
}));

jest.mock("../../../src/config/queue", () => ({
  enqueueEmail: jest.fn().mockResolvedValue(undefined),
}));

const { getPrisma } = require("../../../src/config/prisma");
const { getRedis } = require("../../../src/config/redis");
const authService = require("../../../src/modules/auth/auth.service");
const { registerSchema } = require("../../../src/modules/auth/auth.schema");

function makeRedisMock() {
  const calls = [];
  const multi = {
    del: jest.fn((...args) => {
      calls.push(["del", ...args]);
      return multi;
    }),
    srem: jest.fn((...args) => {
      calls.push(["srem", ...args]);
      return multi;
    }),
    set: jest.fn((...args) => {
      calls.push(["set", ...args]);
      return multi;
    }),
    sadd: jest.fn((...args) => {
      calls.push(["sadd", ...args]);
      return multi;
    }),
    expire: jest.fn((...args) => {
      calls.push(["expire", ...args]);
      return multi;
    }),
    exec: jest.fn().mockResolvedValue([]),
  };

  return {
    calls,
    get: jest.fn().mockResolvedValue("user-1"),
    multi: jest.fn(() => multi),
  };
}

describe("auth security requirements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("public registration rejects role escalation fields", () => {
    expect(() =>
      registerSchema.parse({
        email: "student@example.edu",
        password: "SecurePass123!",
        firstName: "Ayan",
        lastName: "Tulegen",
        role: "INSTRUCTOR",
      })
    ).toThrow();
  });

  test("public register always creates a STUDENT account", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "user-1", ...data })),
      },
    };
    getPrisma.mockReturnValue(prisma);

    await authService.register({
      email: "student@example.edu",
      password: "SecurePass123!",
      firstName: "Ayan",
      lastName: "Tulegen",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "STUDENT", isEmailVerified: false }),
      })
    );
  });

  test("refresh rotates refresh token and revokes the previous jti", async () => {
    const redis = makeRedisMock();
    getRedis.mockReturnValue(redis);
    getPrisma.mockReturnValue({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "student@example.edu",
          role: "STUDENT",
          isActive: true,
          isEmailVerified: true,
        }),
      },
    });

    const oldToken = jwt.sign({ role: "STUDENT" }, process.env.JWT_REFRESH_SECRET, {
      subject: "user-1",
      jwtid: "old-jti",
      expiresIn: "7d",
    });

    const result = await authService.refresh({ refreshToken: oldToken });
    const decoded = jwt.verify(result.refreshToken, process.env.JWT_REFRESH_SECRET);

    expect(result.refreshToken).not.toBe(oldToken);
    expect(decoded.jti).not.toBe("old-jti");
    expect(redis.calls).toContainEqual(["del", "refresh:old-jti"]);
    expect(redis.calls).toContainEqual(["srem", "refreshset:user-1", "old-jti"]);
  });
});
