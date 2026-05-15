import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    auctionPrice: Number,
    finalPrice: Number,
    buyerProposedPrice: Number,
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        title: String,
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
      },
    ],

    customer: {
      name: String,
      phone: String,
      email: String,
    },

    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pinCode: String,
      country: { type: String, default: "India" },
    },

    subtotal: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    invoiceNumber: String,
    invoiceDate: Date,

    paymentMethod: {
      type: String,
      enum: ["COD", "UPI", "CARD", "NETBANKING", "TEST_PAYMENT"],
      default: "TEST_PAYMENT",
    },

    paymentReference: String,

    courierPartner: {
      type: String,
      default: "India Post",
    },
    courierTestKey: String,
    courierBookingStatus: {
      type: String,
      enum: ["PENDING", "TEST_BOOKED", "FAILED"],
      default: "PENDING",
    },
    trackingNumber: String,

    paymentStatus: {
      type: String,
      enum: ["PENDING", "ESCROW", "RELEASED", "PAID", "FAILED"],
      default: "PENDING",
    },

    deliveryStatus: {
      type: String,
      enum: ["PENDING", "IN_TRANSIT", "DELIVERED", "PLACED"],
      default: "PENDING",
    },

    // 🔐 OTPs
    deliveryOTP: String,
    settlementOTP: String,

    buyerApproved: { type: Boolean, default: false },
    growerApproved: { type: Boolean, default: false },

  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
