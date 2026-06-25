const fs = require("fs");

const file = "src/pages/Home.js";
let code = fs.readFileSync(file, "utf8");

code = code.replace(/`r`n\s*/g, "\n");

const lines = code.split(/\r?\n/);
let eagerCount = 0;
const fixed = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('loading="eager"')) {
    eagerCount += 1;

    if (eagerCount === 1) {
      fixed.push(line);
      continue;
    }

    fixed.push(line.replace('loading="eager"', 'loading="lazy"'));

    if (lines[i + 1] && lines[i + 1].includes('fetchPriority="high"')) {
      i += 1;
    }

    continue;
  }

  if (eagerCount > 1 && line.includes('fetchPriority="high"')) {
    continue;
  }

  fixed.push(line);
}

fs.writeFileSync(file, fixed.join("\n"));
console.log("Cleaned literal backtick newlines and fixed image priorities.");
