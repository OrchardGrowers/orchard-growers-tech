import { spawn } from "node:child_process";
import { redactSensitiveOutput } from "./repositoryPolicyService.js";

export const executeBoundedProcess = ({ executable, args, cwd, timeoutMs = 30000, maximumOutputBytes = 100000, signal }) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, {
    cwd,
    shell: false,
    windowsHide: true,
    env: {
      PATH: process.env.PATH,
      Path: process.env.Path,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: "test",
      NO_COLOR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let timedOut = false;
  let outputTruncated = false;
  let capturedBytes = 0;
  const append = (current, chunk) => {
    const remaining = Math.max(0, maximumOutputBytes - capturedBytes);
    if (chunk.length > remaining) outputTruncated = true;
    const accepted = chunk.subarray(0, remaining);
    capturedBytes += accepted.length;
    return Buffer.concat([current, accepted]);
  };
  child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
  child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
  child.on("error", reject);
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 1000).unref();
  }, timeoutMs);
  const cancel = () => child.kill("SIGTERM");
  signal?.addEventListener?.("abort", cancel, { once: true });
  child.on("close", (exitCode, terminationSignal) => {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", cancel);
    resolve({
      exitCode: Number.isInteger(exitCode) ? exitCode : null,
      signal: terminationSignal || null,
      stdout: redactSensitiveOutput(stdout.toString("utf8")),
      stderr: redactSensitiveOutput(stderr.toString("utf8")),
      timedOut,
      outputTruncated,
    });
  });
});
