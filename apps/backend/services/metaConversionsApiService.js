import axios from "axios";
import crypto from "crypto";

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const normalizeEmail = (value) =>
  String(value || "").trim().toLowerCase();

export const sendMetaLeadEvent = async ({
  quotation,
  buyer,
  product,
  req,
}) => {
  const enabled =
    String(process.env.META_CAPI_ENABLED || "false").toLowerCase() === "true";
  const pixelId = String(process.env.META_CAPI_PIXEL_ID || "").trim();
  const accessToken = String(process.env.META_CAPI_ACCESS_TOKEN || "").trim();

  if (!enabled || !pixelId || !accessToken) {
    return { sent: false, skipped: true };
  }

  const email = normalizeEmail(buyer?.email);
  const eventId = `quotation_lead_${String(quotation?._id || Date.now())}`;

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url:
          req?.get("referer") ||
          process.env.META_CAPI_EVENT_SOURCE_URL ||
          "https://www.efruitmandi.live/",
        user_data: {
          ...(email ? { em: [sha256(email)] } : {}),
          ...(req?.get("user-agent")
            ? { client_user_agent: req.get("user-agent") }
            : {}),
        },
        custom_data: {
          content_name:
            product?.fruitName || product?.title || "Fruit quotation",
          lead_type: "buyer_quotation",
          quotation_id: String(quotation?._id || ""),
          lot_id: String(product?._id || ""),
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
