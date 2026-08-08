import { afterEach, describe, expect, it, vi } from "vitest";
import UserNotification from "../models/UserNotification.js";
import { markMyNotificationRead } from "./notificationController.js";

afterEach(() => vi.restoreAllMocks());

describe("user notification authorization", () => {
  it("scopes notification reads to the authenticated user", async () => {
    const notification = { _id: "notification-1", user: "user-1", readAt: new Date() };
    const update = vi.spyOn(UserNotification, "findOneAndUpdate").mockResolvedValue(notification);
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await markMyNotificationRead(
      { params: { id: "notification-1" }, user: { id: "user-1" } },
      res
    );

    expect(update).toHaveBeenCalledWith(
      { _id: "notification-1", user: "user-1" },
      { $set: { readAt: expect.any(Date) } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, notification });
  });

  it("does not reveal a notification owned by another user", async () => {
    vi.spyOn(UserNotification, "findOneAndUpdate").mockResolvedValue(null);
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await markMyNotificationRead(
      { params: { id: "notification-2" }, user: { id: "user-1" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ msg: "Notification not found" });
  });
});
