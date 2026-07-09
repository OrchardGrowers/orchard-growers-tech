export const isLocalTestAccount = (user = {}) => {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_TEST_OTP !== "true") return false;

  const phone = String(user.phone || user.contact || "");
  const email = String(user.email || "").toLowerCase();

  return (
    email === "testbuyer@efruitmandi.live" ||
    email === "testgrower@efruitmandi.live" ||
    email === "testdriver@efruitmandi.live" ||
    phone === "1234567890" ||
    phone === "1234567891" ||
    phone === "1234567892"
  );
};