import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected");

const buyer = await User.findOne({ email: "testbuyer@efruitmandi.live" });

if (!buyer) {
  throw new Error("Test buyer not found");
}

const totalAmount = 1000;
const platformCommission = 50;
const growerPayout = 950;

const order = await Order.create({
  buyer: buyer._id,
  items: [
    {
      title: "Razorpay Test Apple Lot",
      quantity: 1,
      unitPrice: totalAmount,
      lineTotal: totalAmount,
    },
  ],
  totalAmount,
  finalPrice: totalAmount,
  paymentStatus: "PENDING",
  escrowStatus: "PENDING_BUYER_PAYMENT",
  paymentMethod: "UPI",
  driverPayment: 0,
  platformCommission,
  growerPayout,
  dealBreakdown: {
    grossAmount: totalAmount,
    platformCommission,
    growerPayout,
    driverCharge: 0,
    paymentProvider: "RAZORPAY",
    testOrder: true,
  },
  settlementEligibility: {
    buyerPaymentReceived: false,
    growerOtpVerified: false,
    consignmentDelivered: false,
    logisticsAccepted: false,
    growerKycVerified: false,
    logisticsKycVerified: false,
    platformKycVerified: true,
    settlementReleaseAllowed: false,
  },
});

console.log("Created Razorpay test pending order:");
console.log(JSON.stringify({
  orderId: order._id,
  buyer: buyer.email,
  totalAmount: order.totalAmount,
  paymentStatus: order.paymentStatus,
}, null, 2));

await mongoose.disconnect();