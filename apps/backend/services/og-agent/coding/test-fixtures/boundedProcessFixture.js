process.stdout.write(`token=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n${"x".repeat(1000)}`);
if (process.argv[2] === "fast") process.exit(0);
else setTimeout(() => process.exit(0), 2000);
