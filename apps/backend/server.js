import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import auctionRoutes from "./routes/auctionRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import billdeskRoutes from "./routes/billdeskRoutes.js";
import mandiRatesRoutes from "./routes/mandiRatesRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import hsnRoutes from "./routes/hsnRoutes.js";

import Auction from "./models/Auction.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import { seedHsnMaster } from "./models/HsnMaster.js";

import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

let dbConnected = false;
const app = express();
app.set("trust proxy", 1);

// Initialize DB connection
(async () => {
  try {
    dbConnected = await connectDB();
    if (dbConnected) {
      await seedHsnMaster();
    }
    if (!dbConnected) {
      console.warn("⚠️  WARNING: Server running in offline mode without database connection.");
    }
  } catch (err) {
    console.error("Unexpected error during DB initialization:", err);
  }
})();

// ================= TIME LOGIC =================
const AUCTION_DURATION_MS = 5 * 60 * 1000;

const getIstHour = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  return Number(parts.find((part) => part.type === "hour")?.value || 0);
};

const isDealOpen = (date = new Date()) => {
  const istHour = getIstHour(date);
  return istHour >= 9 && istHour < 16;
};

// ================= MIDDLEWARE =================
const isProductionLike = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  // Allow health checks, server-to-server requests, Postman, and Render checks.
  if (!origin) return callback(null, true);

  if (
    allowedOrigins.includes(origin) ||
    origin.includes("vercel.app") ||
    origin.includes("localhost")
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
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auctions", auctionRoutes);
// Compatibility aliases: expose the same auction routes under business-friendly paths
app.use("/api/deals", auctionRoutes);
app.use("/api/quotes", auctionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/billdesk", billdeskRoutes);
app.use("/api/mandi-rates", mandiRatesRoutes);
app.use("/api/verification-requests", verificationRoutes);
app.use("/api/hsn", hsnRoutes);

app.get("/", (req, res) => {
  res.send("API Running...");
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

  socket.on("placeDeal", async ({ auctionId, dealAmount, userId, token }) => {
    try {
      if (!isDealOpen()) {
        socket.emit("dealRejected", {
          msg: "Deal is open from 9:00 AM to 4:00 PM IST.",
        });
        return;
      }

      if (!token) {
        socket.emit("dealRejected", { msg: "Login as a buyer to make a deal." });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const dealBuyer = await User.findById(decoded.id).select("_id role kyc");

      if (!dealBuyer || dealBuyer.role !== "buyer") {
        socket.emit("dealRejected", {
          msg: "Only buyer accounts can make a deal or buy fruit lots.",
        });
        return;
      }

      if (dealBuyer.kyc?.status !== "APPROVED") {
        socket.emit("dealRejected", {
          msg: "Complete KYC authority verification before starting fruit trading.",
        });
        return;
      }

      const auction = await Auction.findById(auctionId);
      if (!auction) return;

      if (auction.status !== "ACTIVE") return;
      if (auction.startTime && new Date() < auction.startTime) return;

      if (new Date() >= auction.endTime) {
        console.log("Deal time finished");
        return;
      }

      const amount = Number(dealAmount);

      if (amount > auction.currentBid) {
        auction.currentBid = amount;
        auction.highestBidder = dealBuyer.id || dealBuyer._id || userId;

        await auction.save();

          io.to(auctionId).emit("dealUpdate", {
            dealAmount: amount,
            userId,
            auctionId,
          });
          // Also emit quote-aliased update for migrating clients
          io.to(auctionId).emit("quoteUpdate", {
            quotedPrice: amount,
            buyerId: userId,
            dealId: auctionId,
          });

        console.log("New highest deal price:", amount);
      } else {
        console.log("Deal price too low");
      }
    } catch (err) {
      console.error("Deal Price Error:", err);
    }
  });

  // Accept new client event names that use business terms
  socket.on("submitQuote", async ({ auctionId, quotedPrice, buyerId, token }) => {
    try {
      // reuse same validation and update logic as placeDeal
      if (!isDealOpen()) {
        socket.emit("dealRejected", {
          msg: "Deal is open from 9:00 AM to 4:00 PM IST.",
        });
        return;
      }

      if (!token) {
        socket.emit("dealRejected", { msg: "Login as a buyer to make a deal." });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const dealBuyer = await User.findById(decoded.id).select("_id role kyc");

      if (!dealBuyer || dealBuyer.role !== "buyer") {
        socket.emit("dealRejected", {
          msg: "Only buyer accounts can make a deal or buy fruit lots.",
        });
        return;
      }

      if (dealBuyer.kyc?.status !== "APPROVED") {
        socket.emit("dealRejected", {
          msg: "Complete KYC authority verification before starting fruit trading.",
        });
        return;
      }

      const auction = await Auction.findById(auctionId);
      if (!auction) return;

      if (auction.status !== "ACTIVE") return;
      if (auction.startTime && new Date() < auction.startTime) return;

      if (new Date() >= auction.endTime) {
        console.log("Deal time finished");
        return;
      }

      const amount = Number(quotedPrice);

      if (amount > auction.currentBid) {
        auction.currentBid = amount;
        auction.highestBidder = dealBuyer.id || dealBuyer._id || buyerId;

        await auction.save();

        io.to(auctionId).emit("dealUpdate", {
          dealAmount: amount,
          userId: buyerId,
          auctionId,
        });
        io.to(auctionId).emit("quoteUpdate", {
          quotedPrice: amount,
          buyerId: buyerId,
          dealId: auctionId,
        });

        console.log("New highest deal price:", amount);
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
        if (!isDealOpen(now)) {
          continue;
        }

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

        console.log("Deal started:", auction._id);
      }

      if ((now >= auction.endTime || !isDealOpen(now)) && auction.status === "ACTIVE") {
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
          continue;
        }

        const existingOrder = await Order.findOne({ auction: auction._id });

        if (!existingOrder) {
          const product = await Product.findById(auction.product).select("createdBy");

          const order = await Order.create({
            auction: auction._id,
            product: auction.product,
            buyer: auction.highestBidder,
            grower: product?.createdBy,
            auctionPrice: auction.currentBid,
            paymentStatus: "PENDING",
          });

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
});

server.on("error", (err) => {
  console.error("Server error:", err);
});
