import { once } from "node:events";
import express from "express";
import { describe, expect, it } from "vitest";
import orchardAiLeadRoutes from "./orchardAiLeadRoutes.js";

describe("Orchard Growers AI Lead routes", () => {
  it("registers the required CRUD endpoints", () => {
    const registeredRoutes = orchardAiLeadRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(registeredRoutes).toEqual([
      { path: "/", methods: ["get"] },
      { path: "/", methods: ["post"] },
      { path: "/collect", methods: ["post"] },
      { path: "/extract-url", methods: ["post"] },
      { path: "/:id", methods: ["get"] },
      { path: "/:id", methods: ["patch"] },
      { path: "/:id", methods: ["delete"] },
    ]);
  });

  it("does not allow public access", async () => {
    const app = express();
    app.use("/api/admin/orchard-ai/leads", orchardAiLeadRoutes);
    const server = app.listen(0, "127.0.0.1");

    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not start");

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/admin/orchard-ai/leads`
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ msg: "No token provided" });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
