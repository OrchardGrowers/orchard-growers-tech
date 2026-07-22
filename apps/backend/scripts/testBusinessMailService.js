#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ quiet: true });

const maskEmail = (value = "") => {
  const [name = "", domain = ""] = String(value || "").trim().toLowerCase().split("@");
  if (!domain) return "invalid";
  return `${name.slice(0, 2)}***@${domain}`;
};

const parseArguments = (args) => {
  const options = { inspect: false, send: false, to: "", senderProfileKey: "" };
  for (const argument of args) {
    if (argument === "--inspect") options.inspect = true;
    else if (argument === "--send") options.send = true;
    else if (argument.startsWith("--to=")) options.to = argument.slice("--to=".length).trim();
    else if (argument.startsWith("--sender-profile=")) {
      options.senderProfileKey = argument.slice("--sender-profile=".length).trim().toUpperCase();
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!options.send) options.inspect = true;
  return options;
};

const printUsage = () => {
  console.log("Business Mail service test (no email is sent by default)");
  console.log("  node scripts/testBusinessMailService.js --inspect");
  console.log("  node scripts/testBusinessMailService.js --send --to=<email> --sender-profile=<key>");
};

const main = async () => {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[business-mail-test] ${error.message}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printUsage();
    return;
  }

  const {
    getBusinessMailProviderStatus,
    listEnabledSenderProfiles,
    sendBusinessMail,
  } = await import("../services/businessMail/BusinessMailService.js");

  if (options.inspect) {
    try {
      const status = getBusinessMailProviderStatus();
      console.log("[business-mail-test] inspect-only status", status);
      console.log(
        "[business-mail-test] enabled sender profiles",
        listEnabledSenderProfiles().map((profile) => profile.key)
      );
      console.log("[business-mail-test] No email sent.");
    } catch (error) {
      console.error("[business-mail-test] Inspection failed", {
        code: error?.code || "BUSINESS_MAIL_INSPECTION_FAILED",
        message: error?.message || "Business Mail inspection failed.",
      });
      process.exitCode = 1;
      return;
    }
  }

  if (!options.send) return;
  if (!options.to || !options.senderProfileKey) {
    console.error("[business-mail-test] --send requires --to and --sender-profile.");
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log("[business-mail-test] Explicit send requested", {
    to: maskEmail(options.to),
    senderProfileKey: options.senderProfileKey,
  });

  try {
    const result = await sendBusinessMail({
      senderProfileKey: options.senderProfileKey,
      to: options.to,
      subject: "Controlled Business Mail service test",
      text: "This is a controlled Phase 4A Business Mail service test.",
      metadata: { source: "testBusinessMailService" },
    });
    console.log("[business-mail-test] Send completed", {
      success: result.success,
      provider: result.provider,
      status: result.status,
      to: maskEmail(options.to),
      providerMessageIdPresent: Boolean(result.providerMessageId),
    });
  } catch (error) {
    console.error("[business-mail-test] Send failed", {
      code: error?.code || "BUSINESS_MAIL_SEND_FAILED",
      message: error?.message || "Business Mail send failed.",
      to: maskEmail(options.to),
    });
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("[business-mail-test] Unexpected failure", {
    message: error?.message || "Unexpected Business Mail test failure.",
  });
  process.exitCode = 1;
});
