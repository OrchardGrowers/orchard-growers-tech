import User from "../models/User.js";
import { getGrowerLotListingAuthorization } from "../services/kycEligibilityService.js";

export const requireGrowerLotListingAuthorization = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select(
      "role activeRole profileTypes kyc kycByRole growerVerified"
    );
    if (!user) {
      return res.status(401).json({ code: "USER_NOT_FOUND", msg: "User not found" });
    }

    const authorization = getGrowerLotListingAuthorization(user);
    if (!authorization.allowed) {
      return res.status(403).json({
        code: authorization.code,
        msg: authorization.message,
      });
    }

    req.lotListingAuthorization = authorization;
    return next();
  } catch (error) {
    return res.status(500).json({ msg: error?.message || "Unable to verify lot listing access" });
  }
};

export default requireGrowerLotListingAuthorization;
