const cache = new Map();
const ttlMs = 6 * 60 * 60 * 1000;
export const parseRobotsPolicy = (text = "", userAgent = "OrchardGrowersResearchAgent") => {
  const groups = []; let group = null;
  String(text).split(/\r?\n/).forEach((raw) => { const line = raw.replace(/#.*/, "").trim(); if (!line) return; const [key, ...rest] = line.split(":"); const value = rest.join(":").trim(); if (key.toLowerCase() === "user-agent") { group = { agents: [value.toLowerCase()], allow: [], disallow: [], crawlDelay: 0 }; groups.push(group); } else if (group && key.toLowerCase() === "allow") group.allow.push(value); else if (group && key.toLowerCase() === "disallow" && value) group.disallow.push(value); else if (group && key.toLowerCase() === "crawl-delay") group.crawlDelay = Math.max(0, Number(value) || 0); });
  const name = userAgent.toLowerCase(); return groups.find((item) => item.agents.some((agent) => name.includes(agent))) || groups.find((item) => item.agents.includes("*")) || { allow: [], disallow: [], crawlDelay: 0 };
};
export const isRobotsPathAllowed = (policy, pathname) => { const matchingAllow = (policy.allow || []).filter((path) => pathname.startsWith(path)).sort((a, b) => b.length - a.length)[0]; const matchingDeny = (policy.disallow || []).filter((path) => pathname.startsWith(path)).sort((a, b) => b.length - a.length)[0]; return !matchingDeny || Boolean(matchingAllow && matchingAllow.length >= matchingDeny.length); };
export const getRobotsDecision = async ({ url, source, fetchText }) => {
  if (source.robotsPolicy === "NOT_APPLICABLE") return { allowed: true, reason: "NOT_APPLICABLE", crawlDelayMs: source.minimumDelayMilliseconds };
  if (source.robotsPolicy === "DISALLOW_AUTOMATION") return { allowed: false, reason: "SOURCE_DISALLOWS_AUTOMATION", crawlDelayMs: 0 };
  const key = `${url.origin}/robots.txt`; let cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) { try { cached = { text: await fetchText(key), expiresAt: Date.now() + ttlMs }; cache.set(key, cached); } catch { return { allowed: source.robotsPolicy === "MANUAL_REVIEW", reason: "ROBOTS_UNAVAILABLE_CONSERVATIVE", crawlDelayMs: source.minimumDelayMilliseconds }; } }
  const policy = parseRobotsPolicy(cached.text); return { allowed: isRobotsPathAllowed(policy, url.pathname), reason: "ROBOTS_EVALUATED", crawlDelayMs: Math.max(source.minimumDelayMilliseconds, policy.crawlDelay * 1000) };
};
