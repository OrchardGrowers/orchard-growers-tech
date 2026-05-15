import Order from "../models/Order.js";

// Buyer proposes price
export const proposePrice = async (req, res) => {
  try {
    const { orderId, price } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (price > order.auctionPrice) {
      return res.status(400).json({
        msg: "Price cannot exceed deal price",
      });
    }

    order.buyerProposedPrice = price;
    order.buyerApproved = true;

    await order.save();

    res.json({ message: "Price proposed", order });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Grower approves
export const approveByGrower = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    order.growerApproved = true;
    order.finalPrice = order.buyerProposedPrice;

    order.paymentStatus = "RELEASED";

    await order.save();

    res.json({
      message: "Payment released",
      order,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
