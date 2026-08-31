export const isRoleOgPubliclyVerified = ({ isKycVerified = false, roleOg = {} } = {}) =>
  Boolean(
    isKycVerified &&
      roleOg?.requestId &&
      roleOg?.decidedAt &&
      String(roleOg?.status || "").trim().toUpperCase() === "APPROVED"
  );
