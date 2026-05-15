import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  password: String,
  role: {
    type: String,
    enum: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"],
    default: "EMPLOYEE",
  },
  status: {
    type: String,
    enum: ["ACTIVE", "TERMINATED"],
    default: "ACTIVE",
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  terminatedAt: Date,
}, { timestamps: true });

export default mongoose.model("Admin", adminSchema);
