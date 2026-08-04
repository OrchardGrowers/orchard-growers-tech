import { once } from "node:events";
import express from "express";
import { describe, expect, it } from "vitest";
import ogAgentRoutes from "./ogAgentRoutes.js";

describe("OG Agent routes", () => {
  it("registers the Phase 1 and Phase 2 API surface without duplicate method/path pairs", () => {
    const routes = ogAgentRoutes.stack.filter((layer) => layer.route).map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
    const expectedExistingRoutes = [
      { path: "/email/sources", methods: ["get"] },
      { path: "/email/search", methods: ["post"] },
      { path: "/email/extractions", methods: ["post"] },
      { path: "/email/extractions", methods: ["get"] },
      { path: "/email/extractions/:extractionId", methods: ["get"] },
      { path: "/email/extractions/:extractionId/run", methods: ["post"] },
      { path: "/email/extractions/:extractionId/cancel", methods: ["post"] },
      { path: "/email/extractions/:extractionId/candidates", methods: ["get"] },
      { path: "/email/extractions/:extractionId/check-duplicates", methods: ["post"] },
      { path: "/email/extractions/:extractionId/import-preview", methods: ["post"] },
      { path: "/email/extractions/:extractionId/request-import-approval", methods: ["post"] },
      { path: "/email/extractions/:extractionId/import-approved", methods: ["post"] },
      { path: "/email/candidates/:candidateId", methods: ["get"] },
      { path: "/email/candidates/:candidateId", methods: ["patch"] },
      { path: "/email/candidates/bulk-selection", methods: ["post"] },
      { path: "/business-leads", methods: ["get"] },
      { path: "/business-leads/:leadId", methods: ["get"] },
      { path: "/business-leads/:leadId/status", methods: ["patch"] },
      { path: "/tasks", methods: ["get"] },
      { path: "/tasks", methods: ["post"] },
      { path: "/tasks/:taskId", methods: ["get"] },
      { path: "/tasks/:taskId/plan", methods: ["post"] },
      { path: "/tasks/:taskId/run", methods: ["post"] },
      { path: "/tasks/:taskId/cancel", methods: ["post"] },
      { path: "/approvals", methods: ["get"] },
      { path: "/approvals/:approvalId", methods: ["get"] },
      { path: "/approvals/:approvalId/approve", methods: ["post"] },
      { path: "/approvals/:approvalId/reject", methods: ["post"] },
      { path: "/audit-logs", methods: ["get"] },
      { path: "/settings", methods: ["get"] },
      { path: "/settings", methods: ["patch"] },
      { path: "/tools", methods: ["get"] },
    ];
    expect(routes).toEqual(expect.arrayContaining(expectedExistingRoutes));
    expect(routes).toEqual(expect.arrayContaining([
      { path: "/telecalling/campaigns/preview", methods: ["post"] },
      { path: "/telecalling/campaigns", methods: ["post"] },
      { path: "/telecalling/queue", methods: ["get"] },
      { path: "/telecalling/queue/:queueItemId/claim", methods: ["post"] },
      { path: "/telecalling/queue/:queueItemId/start-manual", methods: ["post"] },
      { path: "/telecalling/queue/:queueItemId/outcome", methods: ["post"] },
      { path: "/telecalling/follow-ups", methods: ["get"] },
      { path: "/telecalling/script/generate", methods: ["post"] },
      { path: "/telecalling/reports/summary", methods: ["get"] },
      { path: "/coding/tasks", methods: ["post"] },
      { path: "/coding/tasks", methods: ["get"] },
      { path: "/coding/tasks/:codingTaskId/analyze", methods: ["post"] },
      { path: "/coding/repository/status", methods: ["get"] },
      { path: "/coding/repository/search", methods: ["post"] },
      { path: "/coding/repository/read", methods: ["post"] },
      { path: "/coding/tasks/:codingTaskId/request-patch", methods: ["post"] },
      { path: "/coding/patches/:patchId/apply", methods: ["post"] },
      { path: "/coding/tasks/:codingTaskId/commands/run", methods: ["post"] },
      { path: "/coding/patches/:patchId/revert", methods: ["post"] },
    ]));
    expect(new Set(routes.map((route) => `${route.methods.join(",")}:${route.path}`)).size).toBe(routes.length);
  });

  it("does not allow public access", async () => {
    const app = express();
    app.use("/api/admin/og-agent", ogAgentRoutes);
    const server = app.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not start");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/og-agent/tasks`);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ msg: "No token provided" });
      const telecalling = await fetch(`http://127.0.0.1:${address.port}/api/admin/og-agent/telecalling/dashboard`);
      expect(telecalling.status).toBe(401);
      expect(await telecalling.json()).toEqual({ msg: "No token provided" });
      const coding = await fetch(`http://127.0.0.1:${address.port}/api/admin/og-agent/coding/repository/status`);
      expect(coding.status).toBe(401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
