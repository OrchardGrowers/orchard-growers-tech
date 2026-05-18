import jwt from "jsonwebtoken";
import User from "../models/User.js";

const ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "UNIT_MANAGER",
  "INVENTORY_MANAGER",
  "SALES_EXECUTIVE",
  "PURCHASE_MANAGER",
  "FINANCE_MANAGER",
  "VERIFICATION_OFFICER",
  "SUPPORT_EXECUTIVE",
  "VIEWER",
  "EMPLOYEE",
]);

const getTokenFromHeader = (authHeader = "") =>
  authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

const loadUserContext = async (decodedId) => {
  const user = await User.findById(decodedId).select("_id role accountStatus");

  if (!user) return null;

  if (user.accountStatus && user.accountStatus !== "ACTIVE") {
    return { blocked: true, status: user.accountStatus };
  }

  return { id: user._id, role: user.role };
};

// Protect route
const protect = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ msg: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.id && ADMIN_ROLES.has(decoded.role)) {
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };
      return next();
    }

    const userContext = await loadUserContext(decoded.id);

    if (!userContext) {
      return res.status(401).json({ msg: "User not found" });
    }

    if (userContext.blocked) {
      return res.status(403).json({ msg: `Account ${String(userContext.status || "blocked").toLowerCase()}. Contact support.` });
    }

    req.user = userContext;
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Token expired" });
    }

    return res.status(401).json({ msg: "Invalid token" });
  }
};

// Optional auth for public routes
export const optionalProtect = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.id && ADMIN_ROLES.has(decoded.role)) {
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };
      return next();
    }

    const userContext = await loadUserContext(decoded.id);

    if (userContext && !userContext.blocked) {
      req.user = userContext;
    }

    next();
  } catch {
    next();
  }
};

// Role-based access
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        msg: `Access denied. Required role: ${roles.join(", ")}`,
      });
    }

    next();
  };
};

export default protect;
