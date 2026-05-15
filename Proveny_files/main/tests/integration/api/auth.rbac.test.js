const request = require("supertest");
const { createApp } = require("../../../src/app");

test("RBAC: /users requires auth (401)", async () => {
  const app = createApp();
  const res = await request(app).get("/api/v1/users");
  expect(res.status).toBe(401);
});

