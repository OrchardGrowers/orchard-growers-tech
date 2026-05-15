import Order from "../models/Order.js";

// 🚛 Driver starts delivery
export const startDelivery = async (req, res) => {
  try {
    const { orderId, driverId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    // Assign driver automatically
    order.driver = driverId;

    // Generate Delivery OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    order.deliveryOTP = otp;
    order.deliveryStatus = "IN_TRANSIT";

    await order.save();

    res.json({
      message: "Delivery started",
      deliveryOTP: otp, // hide later
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// 📦 Buyer confirms delivery
export const confirmDelivery = async (req, res) => {
  try {
    const { orderId, otp } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.deliveryOTP !== otp) {
      return res.status(400).json({ msg: "Invalid delivery OTP" });
    }

    order.deliveryStatus = "DELIVERED";
    order.deliveryOTP = null;

    await order.save();

    res.json({
      message: "Delivery confirmed",
      order,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// 💰 Buyer generates settlement OTP
export const generateSettlementOTP = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    order.settlementOTP = otp;

    await order.save();

    res.json({
      message: "Settlement OTP generated",
      settlementOTP: otp, // hide later
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// 🌾 Grower confirms → payment release
export const confirmSettlement = async (req, res) => {
  try {
    const { orderId, otp } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.settlementOTP !== otp) {
      return res.status(400).json({ msg: "Invalid settlement OTP" });
    }

    order.paymentStatus = "RELEASED";
    order.settlementOTP = null;

    await order.save();

    res.json({
      message: "Payment released successfully",
      order,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};