import express from "express";
import dotenv from "dotenv";
import dns from "dns";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import cron from "node-cron";
import connectDB from "./config/db.js";
import sitemapRoutes from "./routes/sitemapRoutes.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import orchardAiLeadRoutes from "./routes/orchardAiLeadRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import auctionRoutes from "./routes/auctionRoutes.js";
import quotationRoutes from "./routes/quotationRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import billdeskRoutes from "./routes/billdeskRoutes.js";
import cashfreeRoutes from "./routes/cashfreeRoutes.js";
import mandiRatesRoutes from "./routes/mandiRates.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import cloudinaryRoutes from "./routes/cloudinaryRoutes.js";
import hsnRoutes from "./routes/hsnRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import logisticsRoutes from "./routes/logisticsRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import captureSessionRoutes from "./routes/captureSessionRoutes.js";

import Auction from "./models/Auction.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import DealSettings from "./models/DealSettings.js";
import { seedHsnMaster } from "./models/HsnMaster.js";
import { seedAdminFromEnv } from "./services/adminSeedService.js";
import { startOrchardAiCollectorWorker } from "./services/orchardAiCollectorWorker.js";
import { syncMandiRates } from "./services/mandiRateService.js";
import {
  buildGradeQuantitiesFromProduct,
  calculateDealBreakdown,
  getHighestAvailableGrade,
  mergeDealSettings,
} from "./services/dealCalculationService.js";
import {
  isPaymentPartnerEnabled,
  PAYMENT_UNAVAILABLE_MESSAGE,
} from "./utils/paymentFeatureFlag.js";

import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

// Prefer IPv4 DNS resolution first to avoid environments with broken IPv6 routing
try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
    console.log("Networking: set DNS result order to ipv4first");
  }
} catch (e) {
  console.warn("Could not set DNS result order:", e?.message || e);
}

let dbConnected = false;
const app = express();
app.set("trust proxy", 1);

// Initialize DB connection
const databaseInitialization = (async () => {
  try {
    dbConnected = await connectDB();
    if (dbConnected) {
      await seedHsnMaster();
      // Seed an initial admin from env vars if configured (safe: creates only if missing)
      try {
        await seedAdminFromEnv();
      } catch (err) {
        console.error("Error during admin seed:", err?.message || err);
      }
    }
    if (!dbConnected) {
      console.warn("⚠️  WARNING: Server running in offline mode without database connection.");
    }
  } catch (err) {
    console.error("Unexpected error during DB initialization:", err);
  }
})().then(() => dbConnected);

cron.schedule("0 6 * * *", async () => {
  if (!dbConnected) {
    console.warn("Mandi rates cron skipped: database is offline.");
    return;
  }

  try {
    const summary = await syncMandiRates();
    console.log(
      `Mandi rates cron synced ${summary.imported} records from ${summary.pages} page(s).`
    );
  } catch (err) {
    console.error("Mandi rates cron failed:", err?.message || err);
  }
});

// ================= TIME LOGIC =================
const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000;

// ================= MIDDLEWARE =================
const isProductionLike = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};
const allowedOrigins = [
  process.env.ALLOWED_ORIGINS || "",
  process.env.CORS_ORIGINS || "",
  process.env.CORS_ORIGIN || "",
  process.env.CLIENT_URL || "",
  process.env.ORCHARD_FRONTEND_URL || "",
  process.env.ORCHARDGROWERS_CLIENT_URL || "",
  process.env.EFRUITMANDI_FRONTEND_URL || "",
  process.env.EFRUITMANDI_CLIENT_URL || "",
  process.env.ADMIN_FRONTEND_URL || "",
  "https://orchardgrowers.in",
  "https://www.orchardgrowers.in",
  "https://efruitmandi.live",
  "https://www.efruitmandi.live",
  "https://admins.orchardgrowers.in",
  "https://orchard-growers-tech-admin-panel.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
]
  .join(",")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .filter((origin, index, list) => list.indexOf(origin) === index);

const corsOrigin = (origin, callback) => {
  // Allow health checks, server-to-server requests, Postman, and Render checks.
  if (!origin) return callback(null, true);

  const isLoopbackOrigin = (value) => {
    try {
      const { hostname } = new URL(value);
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    } catch {
      return false;
    }
  };

  if (
    allowedOrigins.includes(origin) ||
    origin.includes("vercel.app") ||
    isLoopbackOrigin(origin)
  ) {
    return callback(null, true);
  }

  console.error("Blocked by CORS:", origin);

  return callback(new Error("Not allowed by CORS"));
};

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

if (!isProductionLike()) {
  console.log("CORS allowed origins:", allowedOrigins.join(", "));
}

app.use(cors(corsOptions));
app.options(["/api/admin/send-otp", "/api/auth/*"], cors(corsOptions));

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use("/uploads", express.static("uploads"));

// ================= ROUTES =================
app.use("/", sitemapRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/me", userRoutes);
app.use("/api/admin/orchard-ai/leads", orchardAiLeadRoutes);
app.use("/api/admin/orchard-ai-leads", orchardAiLeadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auctions", auctionRoutes);
// Compatibility aliases: expose the same auction routes under business-friendly paths
app.use("/api/deals", auctionRoutes);
app.use("/api/quotes", quotationRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/billdesk", billdeskRoutes);
app.use("/api/payments/cashfree", cashfreeRoutes);
app.use("/api/mandi-rates", mandiRatesRoutes);
app.use("/api/verification-requests", verificationRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/hsn", hsnRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/logistics", logisticsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/capture-sessions", captureSessionRoutes);

app.get("/", (req, res) => {
  res.send("API Running...");
});

const healthPayload = () => ({
  ok: true,
  service: "orchard-growers-api",
  database: dbConnected ? "connected" : "offline",
  uptimeSeconds: Math.round(process.uptime()),
  timestamp: new Date().toISOString(),
});

app.get("/health", (req, res) => {
  res.json(healthPayload());
});

app.get("/api/health", (req, res) => {
  res.json(healthPayload());
});

// ================= ERROR HANDLING =================
app.use((req, res) => {
  res.status(404).json({ message: "Route Not Found", msg: "Route Not Found" });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const codeMessageMap = {
      LIMIT_FILE_SIZE: "Uploaded file is too large",
      LIMIT_FILE_COUNT: "Too many files uploaded",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field in upload request",
    };
    const multerMsg = codeMessageMap[err.code] || err.message || "Invalid upload request";

    return res.status(400).json({
      message: multerMsg,
      msg: multerMsg,
      code: err.code,
    });
  }

  console.error("Server Error:", err.stack || err.message || err);

  const status = err.statusCode || 500;
  const message = err.message || "Server Error";

  res.status(status).json({
    message,
    msg: message,
  });
});

// ================= SOCKET =================
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});
app.set("io", io);

const emitEfruitMandiMarketUpdate = (action, payload = {}) => {
  io.emit("efruitmandiMarketUpdated", {
    platform: "efruitmandi",
    action,
    updatedAt: new Date().toISOString(),
    ...payload,
  });
};

const userHasProfile = (user, profileType) =>
  user?.role === profileType ||
  (Array.isArray(user?.profileTypes) && user.profileTypes.includes(profileType));

const hasApprovedRoleKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").toLowerCase();
  const verifiedFlag =
    role === "buyer"
      ? user.buyerVerified
      : role === "grower"
        ? user.growerVerified
        : role === "driver"
          ? user.driverVerified
          : false;
  const roleKyc = user.kycByRole?.[role] || {};
  const legacyKyc = String(user.kyc?.roleType || "").toLowerCase() === role ? user.kyc : {};
  return Boolean(verifiedFlag) || String(roleKyc.status || legacyKyc.status || "").toUpperCase() === "APPROVED";
};

const loadDealSettings = async () =>
  mergeDealSettings((await DealSettings.findOne({ key: "default" }).lean()) || {});

const calculateAuctionDeal = async (auction, baseRate, distanceKm = 0) => {
  const product = auction.product?.gradeLots
    ? auction.product
    : await Product.findById(auction.product);
  const gradeQuantities = buildGradeQuantitiesFromProduct(product);
  const highestGrade = getHighestAvailableGrade(gradeQuantities);
  const gradePrices = Object.keys(gradeQuantities).reduce((prices, grade) => {
    if (Number(gradeQuantities[grade] || 0) > 0) prices[grade] = Number(baseRate || 0);
    return prices;
  }, {});
  const settings = await loadDealSettings();

  return calculateDealBreakdown({
    highestGrade,
    gradeQuantities,
    gradePrices,
    distanceKm,
    ...settings,
  });
};

const buildOrderFromAuction = (auction, product) => ({
  auction: auction._id,
  product: auction.product?._id || auction.product,
  buyer: auction.highestBidder,
  grower: product?.createdBy,
  auctionPrice: auction.dealBreakdown?.dealAmount ?? auction.currentBid,
  finalPrice: auction.dealBreakdown?.buyerPayable ?? auction.currentBid,
  highestGrade: auction.highestGrade,
  highestGradeRate: auction.highestGradeRate,
  dealBreakdown: auction.dealBreakdown,
  driverPayment: auction.dealBreakdown?.driverCharge || 0,
  platformCommission: auction.dealBreakdown?.commissionAmount || 0,
  growerPayout: auction.dealBreakdown?.sellerReceivable || 0,
  paymentStatus: "PENDING",
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinAuction", (auctionId) => {
    socket.join(auctionId);
    console.log("Joined deal:", auctionId);
  });

  // Alias for newer clients using business naming
  socket.on("joinDeal", (auctionId) => {
    socket.join(auctionId);
    console.log("Joined deal (alias):", auctionId);
  });

  socket.on("placeDeal", async ({ auctionId, dealAmount, userId, token, distanceKm = 0 }) => {
    try {
      if (!isPaymentPartnerEnabled()) {
        socket.emit("dealRejected", { msg: PAYMENT_UNAVAILABLE_MESSAGE });
        return;
      }

      if (!token) {
        socket.emit("dealRejected", { msg: "Login as a buyer to make a deal." });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const dealBuyer = await User.findById(decoded.id).select("_id role profileTypes kyc kycByRole buyerVerified");

      if (!dealBuyer || !userHasProfile(dealBuyer, "buyer")) {
        socket.emit("dealRejected", {
          msg: "Only buyer accounts can make a deal or buy fruit lots.",
        });
        return;
      }

      if (!hasApprovedRoleKyc(dealBuyer, "buyer")) {
        socket.emit("dealRejected", {
          success: false,
          code: "KYC_REQUIRED",
          message: "KYC approval is required before placing a quote.",
          msg: "KYC approval is required before placing a quote.",
        });
        return;
      }

      const auction = await Auction.findById(auctionId).populate("product");
      if (!auction) return;

      if (auction.status !== "ACTIVE") return;
      if (auction.startTime && new Date() < auction.startTime) return;

      if (new Date() >= auction.endTime) {
        console.log("Deal time finished");
        return;
      }

      const amount = Number(dealAmount);
      const breakdown = await calculateAuctionDeal(auction, amount, distanceKm);

      if (amount > Number(auction.highestGradeRate || auction.startingPrice || 0)) {
        auction.currentBid = breakdown.dealAmount;
        auction.highestGrade = breakdown.highestGrade;
        auction.highestGradeRate = amount;
        auction.distanceKm = Number(distanceKm || 0);
        auction.dealBreakdown = breakdown;
        auction.highestBidder = dealBuyer.id || dealBuyer._id || userId;

        await auction.save();

          io.to(auctionId).emit("dealUpdate", {
            dealAmount: breakdown.dealAmount,
            highestGradeRate: amount,
            dealBreakdown: breakdown,
            userId,
            auctionId,
          });
          // Also emit quote-aliased update for migrating clients
          io.to(auctionId).emit("quoteUpdate", {
            quotedPrice: breakdown.dealAmount,
            buyerId: userId,
            dealId: auctionId,
          });

        console.log("New highest deal price:", breakdown.dealAmount);
      } else {
        console.log("Deal price too low");
      }
    } catch (err) {
      console.error("Deal Price Error:", err);
    }
  });

  // Accept new client event names that use business terms
  socket.on("submitQuote", async ({ auctionId, quotedPrice, buyerId, token, distanceKm = 0 }) => {
    try {
      // reuse same validation and update logic as placeDeal
      if (!isPaymentPartnerEnabled()) {
        socket.emit("dealRejected", { msg: PAYMENT_UNAVAILABLE_MESSAGE });
        return;
      }

      if (!token) {
        socket.emit("dealRejected", { msg: "Login as a buyer to make a deal." });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const dealBuyer = await User.findById(decoded.id).select("_id role profileTypes kyc kycByRole buyerVerified");

      if (!dealBuyer || !userHasProfile(dealBuyer, "buyer")) {
        socket.emit("dealRejected", {
          msg: "Only buyer accounts can make a deal or buy fruit lots.",
        });
        return;
      }

      if (!hasApprovedRoleKyc(dealBuyer, "buyer")) {
        socket.emit("dealRejected", {
          success: false,
          code: "KYC_REQUIRED",
          message: "KYC approval is required before placing a quote.",
          msg: "KYC approval is required before placing a quote.",
        });
        return;
      }

      const auction = await Auction.findById(auctionId).populate("product");
      if (!auction) return;

      if (auction.status !== "ACTIVE") return;
      if (auction.startTime && new Date() < auction.startTime) return;

      if (new Date() >= auction.endTime) {
        console.log("Deal time finished");
        return;
      }

      const amount = Number(quotedPrice);
      const breakdown = await calculateAuctionDeal(auction, amount, distanceKm);

      if (amount > Number(auction.highestGradeRate || auction.startingPrice || 0)) {
        auction.currentBid = breakdown.dealAmount;
        auction.highestGrade = breakdown.highestGrade;
        auction.highestGradeRate = amount;
        auction.distanceKm = Number(distanceKm || 0);
        auction.dealBreakdown = breakdown;
        auction.highestBidder = dealBuyer.id || dealBuyer._id || buyerId;

        await auction.save();

        io.to(auctionId).emit("dealUpdate", {
          dealAmount: breakdown.dealAmount,
          highestGradeRate: amount,
          dealBreakdown: breakdown,
          userId: buyerId,
          auctionId,
        });
        io.to(auctionId).emit("quoteUpdate", {
          quotedPrice: breakdown.dealAmount,
          buyerId: buyerId,
          dealId: auctionId,
        });

        console.log("New highest deal price:", breakdown.dealAmount);
      } else {
        console.log("Deal price too low");
      }
    } catch (err) {
      console.error("Deal Price Error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ================= DEAL TIMER =================
setInterval(async () => {
  try {
    const auctions = await Auction.find({
      status: { $in: ["SCHEDULED", "ACTIVE"] },
    });
    const now = new Date();

    for (let auction of auctions) {
      if (auction.status === "SCHEDULED" && now >= auction.startTime) {
        auction.status = "ACTIVE";

        if (!auction.endTime || now >= auction.endTime) {
          auction.startTime = now;
          auction.endTime = new Date(now.getTime() + AUCTION_DURATION_MS);
        }

        await auction.save();

        io.to(auction._id.toString()).emit("auctionStarted", {
          auctionId: auction._id,
          startTime: auction.startTime,
        });
        // Emit business-friendly alias for newer clients
        io.to(auction._id.toString()).emit("dealStarted", {
          auctionId: auction._id,
          startTime: auction.startTime,
        });
        emitEfruitMandiMarketUpdate("deal-started", {
          auctionId: auction._id,
        });

        console.log("Deal started:", auction._id);
      }

      if (now >= auction.endTime && auction.status === "ACTIVE") {
        auction.status = "ENDED";
        await auction.save();

        if (!auction.highestBidder) {
          io.to(auction._id.toString()).emit("auctionEnded", {
            winner: null,
            finalPrice: auction.currentBid,
            orderId: null,
          });
          // Alias for business naming
          io.to(auction._id.toString()).emit("dealEnded", {
            winner: null,
            finalPrice: auction.currentBid,
            orderId: null,
          });
          emitEfruitMandiMarketUpdate("deal-ended", {
            auctionId: auction._id,
            orderId: null,
          });
          continue;
        }

        if (!isPaymentPartnerEnabled()) {
          io.to(auction._id.toString()).emit("dealRejected", {
            msg: PAYMENT_UNAVAILABLE_MESSAGE,
          });
          emitEfruitMandiMarketUpdate("deal-ended", {
            auctionId: auction._id,
            orderId: null,
            paymentDisabled: true,
          });
          continue;
        }

        const existingOrder = await Order.findOne({ auction: auction._id });

        if (!existingOrder) {
          const product = await Product.findById(auction.product).select("createdBy");

          const order = await Order.create(buildOrderFromAuction(auction, product));

          io.to(auction._id.toString()).emit("auctionEnded", {
            winner: auction.highestBidder,
            finalPrice: auction.currentBid,
            orderId: order._id,
          });
          // Alias for business naming
          io.to(auction._id.toString()).emit("dealEnded", {
            winner: auction.highestBidder,
            finalPrice: auction.currentBid,
            orderId: order._id,
          });
          emitEfruitMandiMarketUpdate("deal-ended", {
            auctionId: auction._id,
            orderId: order._id,
          });

          console.log("Deal ended:", order._id);
        }
      }
    }
  } catch (err) {
    console.error("Timer error:", err);
  }
}, 5000);

// ================= PROCESS ERROR HANDLERS =================
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Attempt graceful shutdown
  server.close(() => {
    console.error("Server shut down due to uncaught exception.");
    process.exit(1);
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  const dbStatus = dbConnected ? "✅ DB Connected" : "⚠️  DB Offline";
  console.log(`Server running on port ${PORT} | ${dbStatus}`);
  void databaseInitialization.then((connected) => {
    if (connected) startOrchardAiCollectorWorker();
  });
});

server.on("error", (err) => {
  console.error("Server error:", err);
});


