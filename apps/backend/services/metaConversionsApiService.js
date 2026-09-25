import axios from "axios";
import crypto from "crypto";

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

export const sendMetaLeadEvent = async ({ user, roleType, req }) => {
  const enabled =
    String(process.env.META_CAPI_ENABLED || "false").toLowerCase() === "true";
  const pixelId = String(process.env.META_CAPI_PIXEL_ID || "").trim();
  const accessToken = String(process.env.META_CAPI_ACCESS_TOKEN || "").trim();

  if (!enabled || !pixelId || !accessToken) {
    return { sent: false, skipped: true };
  }

  const origin = String(req?.get?.("origin") || "").trim().toLowerCase();
  const allowedOrigins = new Set([
    "https://www.efruitmandi.live",
    "https://efruitmandi.live",
  ]);
  if (!allowedOrigins.has(origin)) {
    return { sent: false, skipped: true };
  }

  const userId = String(user?._id || "");
  const role = String(roleType || "").trim().toLowerCase();
  if (!userId || !["buyer", "grower", "driver"].includes(role)) {
    return { sent: false, skipped: true };
  }

  const email = String(user?.email || "").trim().toLowerCase();
  const eventId = `kyc_lead_${userId}_${role}`;
  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: "https://www.efruitmandi.live/kyc",
        user_data: {
          ...(email ? { em: [sha256(email)] } : {}),
          ...(req?.get?.("user-agent")
            ? { client_user_agent: req.get("user-agent") }
            : {}),
        },
        custom_data: {
          lead_type: "kyc_submitted",
          user_role: role,
        },
      },
    ],
  };

  try {
    const graphVersion =
      String(process.env.FACEBOOK_GRAPH_VERSION || "v25.0").trim();

    await axios.post(
      `https://graph.facebook.com/${graphVersion}/${pixelId}/events`,
      payload,
      {
        params: { access_token: accessToken },
        timeout: 8000,
      }
    );

    return { sent: true, eventId };
  } catch (error) {
    console.error("[Meta CAPI] Lead event failed:", {
      status: error.response?.status || null,
      message: error.response?.data?.error?.message || error.message,
    });
    return { sent: false, error: true };
  }
};
