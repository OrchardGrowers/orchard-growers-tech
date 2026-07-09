import Razorpay from "razorpay";

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay keys are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in apps/backend/.env"
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

export default getRazorpayClient;
