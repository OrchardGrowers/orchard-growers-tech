import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const users = await User.find({
  $or: [
    { phone: "1234567890" },
    { contact: "1234567890" },
    { email: "testbuyer@efruitmandi.live" }
  ]
})
.select("name email phone contact role activeRole profileTypes buyerVerified buyerOgVerified isVerified accountStatus kyc kycByRole")
.lean();

console.log(JSON.stringify(users, null, 2));

await mongoose.disconnect();
