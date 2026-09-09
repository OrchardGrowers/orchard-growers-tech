const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const seo = require("./prerender-seo.cjs");
const { inspectHtml, robotsBlocked, validateIndexable, fetchPage } = require("./validate-seo.cjs");
const { validateBuild } = require("./validate-seo-build.cjs");
const app = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(app, "vercel.json")));
const robots = fs.readFileSync(path.join(app, "public/robots.txt"), "utf8");
const base = fs.readFileSync(path.join(app, "index.html"), "utf8");
const origin = "https://www.efruitmandi.live";
const profiles = ["grower", "buyer"].flatMap((role) => [1,2].map((i) => ({
  role, slug: role + "-fixture-" + i, companyName: role + " fixture " + i,
  orchardName: role === "grower" ? "Orchard " + i : undefined,
  businessName: role === "buyer" ? "Buyer " + i : undefined,
  state: "Himachal Pradesh", district: "Shimla", mainLocation: "Shimla, Himachal Pradesh",
})));
const fruit = { slug: "apple", name: "Apple", lotCount: 2,
  growers: profiles.filter((p) => p.role === "grower"),
  buyers: profiles.filter((p) => p.role === "buyer"),
  varieties: [{slug:"royal-delicious", name:"Royal Delicious",lotCount:2,growers:[],buyers:[]}] };
const metas = [
  ...seo.routes.filter((r) => ["/mandi-rates", "/buyer-guide", "/contact-us", "/search"].includes(r.path)),
  {...seo.routes.find((r) => r.path === "/mandi-rates/apple"), noIndex:false, robots:"index,follow"},
  ...seo.getFruitPrerenderMetas({fruits:[fruit]}),
  ...profiles.map((p) => seo.getPublicProfileMeta(p, p.role)),
  ...["grower","buyer"].flatMap((role) => [
    seo.getPublicDirectoryMeta(profiles.filter((p) => p.role === role),role),
    ...seo.getPublicLocationMetas(profiles.filter((p) => p.role === role),role),
  ]),
];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "efruitmandi-seo-"));
let server, local;
let sitemap = "<urlset>" + metas.filter((m) => !m.noIndex).map((m) => "<url><loc>" + origin + m.path + "</loc></url>").join("") + "</urlset>";
before(async () => {
  metas.push(...await seo.getEditorialRoutes());
  sitemap = "<urlset>" + metas.filter((m) => !m.noIndex).map((m) => "<url><loc>" + origin + m.path + "</loc></url>").join("") + "</urlset>";
  for (const meta of metas) {
    const body = meta.name ? seo.renderPublicProfileFallback(meta) : meta.profiles ? seo.renderPublicDirectoryFallback(meta) : seo.renderFallback(meta);
    const html = seo.replaceRootContent(seo.replaceProfileHeadTags(base, meta), body);
    const file = path.join(temp, meta.path, "index.html");
    fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,html);
  }
  fs.writeFileSync(path.join(temp,"404.html"),seo.renderNotFoundPage(base));
  server = http.createServer((req,res) => {
    const route = new URL(req.url, origin).pathname;
    const rule = config.redirects.find((r) => new RegExp("^" + r.source.replace(/:[a-zA-Z]+/g, "([^/]+)") + "$").test(route));
    const params = rule && new RegExp("^" + rule.source.replace(/:[a-zA-Z]+/g, "([^/]+)") + "$").exec(route);
    let parameter = 0;
    const redirect = rule && { destination: rule.destination.replace(/:[a-zA-Z]+/g, () => params[++parameter]) };
    if (redirect) {res.writeHead(308,{Location:redirect.destination});return res.end();}
    for (const rule of config.headers) {
      if (new RegExp("^" + rule.source + "$").test(route)) for (const header of rule.headers) res.setHeader(header.key,header.value);
    }
    if (route === "/robots.txt") return res.end(robots);
    if (route === "/sitemap.xml") return res.end(sitemap);
    const file = path.join(temp,route,"index.html");
    if (fs.existsSync(file)) return res.end(fs.readFileSync(file));
    const fallback = config.rewrites.find((r) => r.source.startsWith("/((?!"));
    if (new RegExp("^"+fallback.source+"$").test(route)) return res.end(base);
    res.statusCode=404;res.end(fs.readFileSync(path.join(temp,"404.html")));
  });
  await new Promise((resolve) => server.listen(0,"127.0.0.1",resolve));
  local = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(temp,{recursive:true,force:true});
});
for (const route of [
  "/fruits/apple", "/fruits/apple/varieties/royal-delicious",
  "/growers/grower-fixture-1", "/buyers/buyer-fixture-1",
  "/buyers/state/himachal-pradesh", "/growers/state/himachal-pradesh",
  "/mandi-rates/apple", "/mandi-rates", "/buyer-guide", "/contact-us", "/blog/fruit-buyers/apple",
]) test("initial HTML and HTTP contract: " + route,async () => {
  const result=await fetchPage(local+route);result.url=origin+route;
  assert.deepEqual(validateIndexable(result,robots),[]);
  assert.equal(result.meta.canonical.length,1);
  assert.ok(sitemap.includes(result.url));
  assert.equal(result.xRobots,null);
});
test("search remains noindex,follow, without a canonical or placeholder",async () => {
  for (const route of ["/search","/search?q={search_term_string}"]) {
    const result=await fetchPage(local+route);
    assert.equal(result.status,200);assert.ok(result.meta.robots.every((r)=>r==="noindex,follow"));
    assert.equal(result.xRobots,"noindex, follow");assert.deepEqual(result.meta.canonical,[]);
    assert.ok(!sitemap.includes("/search"));assert.equal(result.meta.placeholder,false);
  }
});
test("existing 404 handles every missing dynamic family",async () => {
  for (const route of ["/lots/missing","/growers/missing","/buyers/missing","/fruits/missing","/fruits/apple/varieties/missing","/mandi-rates/missing","/fruit-lots/missing","\/blog/fruit-buyers/missing"]) {
    const result=await fetchPage(local+route);
    assert.equal(result.status,404,route);assert.deepEqual(result.meta.canonical,[]);
    assert.ok(result.meta.robots.every((r)=>r==="noindex,follow"));assert.ok(!sitemap.includes(route));
  }
});
test("intentional contact redirect and corrected grower alias go directly to canonical directories",async () => {
  for (const [source,destination] of [["/contact","/contact-us"],["/fruit-growers","/growers"],["/fruit-buyers/apple","/blog/fruit-buyers/apple"]]) {
    const result=await fetchPage(local+source);
    assert.equal(result.status,308);assert.equal(result.location,destination);
    assert.ok(!sitemap.includes("<loc>"+origin+source+"</loc>"));
    assert.equal((await fetchPage(local+destination)).status,200);
  }
});
test("legacy fruit-buyer redirects only target an existing equivalent editorial page",async () => {
  const apple = await fetchPage(local+"/fruit-buyers/apple");
  assert.equal(apple.status,308);
  assert.equal(apple.location,"/blog/fruit-buyers/apple");
  const destination = await fetchPage(local+apple.location);
  destination.url = origin+apple.location;
  assert.deepEqual(validateIndexable(destination,robots),[]);

  for (const slug of ["mango","pear","missing"]) {
    const route = "/fruit-buyers/"+slug;
    const result = await fetchPage(local+route);
    assert.equal(result.status,404,route);
    assert.equal(result.location,null,route);
    assert.deepEqual(result.meta.canonical,[]);
    assert.ok(result.meta.robots.length > 0);
    assert.ok(result.meta.robots.every((directive) => directive === "noindex,follow"));
    assert.ok(!sitemap.includes("<loc>"+origin+route+"</loc>"));
  }
});

test("private and registration routes retain robots and header exclusions",async () => {
  for (const route of ["/profile-dashboard","/notifications","/register-buyer"]) {
    const result=await fetchPage(local+route);
    assert.ok(robotsBlocked(origin+route,robots));assert.match(result.xRobots,/noindex/);
    assert.ok(!sitemap.includes(route));
  }
});
test("all sitemap entries agree with generated HTML, directives, and headers", () => {
  assert.equal(validateBuild(temp,sitemap,config,robots),metas.filter((m)=>!m.noIndex).length);
});
test("validator rejects redirect, non-200, noindex, blocked, duplicate and conflicting canonicals",() => {
  const good={url:origin+"/buyer-guide",status:200,meta:inspectHtml(fs.readFileSync(path.join(temp,"buyer-guide/index.html"),"utf8"))};
  assert.deepEqual(validateIndexable(good,robots),[]);
  for (const bad of [
    {...good,status:308,location:"/"}, {...good,status:404}, {...good,xRobots:"noindex"},
    {...good,meta:{...good.meta,robots:["noindex,follow"]}},
    {...good,meta:{...good.meta,canonical:[origin+"/"]}},
    {...good,meta:{...good.meta,canonical:[good.url,good.url]}},
    {...good,url:origin+"/profile-dashboard"},
  ]) assert.ok(validateIndexable(bad,robots).length);
});
test("Website and Organization survive removal of obsolete SearchAction",()=>{
  const schema=JSON.stringify(seo.buildHomepageSchema());
  assert.match(schema,/"WebSite"/);assert.match(schema,/"Organization"/);
  assert.doesNotMatch(schema,/SearchAction|search_term_string|potentialAction/);
});
test("generated SEO tags are owned by Helmet, avoiding duplicate canonical/noindex tags",()=>{
  const meta=seo.getPublicProfileMeta(profiles[0],"grower");
  const html=seo.replaceProfileHeadTags(base,meta);
  assert.match(html,/<link data-rh="true" rel="canonical"/);
  assert.match(html,/<meta data-rh="true" name="robots"/);
  assert.equal(inspectHtml(seo.replaceProfileHeadTags(html,meta)).canonical.length,1);
});

test("API failure and malformed responses fail instead of publishing empty/noindex routes", async () => {
  const originalFetch = global.fetch;
  try {
    for (const load of [seo.fetchAvailableMandiSlugs, seo.fetchPublicFruitDiscovery, () => seo.fetchPublicProfiles("grower")]) {
      global.fetch = async () => { throw new Error("network unavailable"); };
      await assert.rejects(load, /network unavailable/);
      global.fetch = async () => ({ ok: true, json: async () => ({}) });
      await assert.rejects(load, /Invalid/);
      global.fetch = async () => ({ ok: false, status: 503 });
      await assert.rejects(load, /HTTP 503/);
    }
  } finally { global.fetch = originalFetch; }
});
test("empty successful eligibility data stays excluded rather than being invented", async () => {
  assert.deepEqual(seo.getFruitPrerenderMetas({fruits:[]}),[]);
  assert.equal(seo.routes.find((r) => r.path === "/mandi-rates/pear").noIndex,true);
});
