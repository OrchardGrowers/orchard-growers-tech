import { afterEach, expect, it, vi } from "vitest";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import * as users from "../controllers/userController.js";
import * as mandi from "../services/mandiRateService.js";
import router from "./sitemapRoutes.js";

const query = (rows) => ({select(){return this;},sort(){return this;},limit(){return this;},lean:async()=>rows});
afterEach(()=>vi.restoreAllMocks());
it("the existing sitemap excludes deleted, unavailable and nonexistent lots and delivery", async () => {
  const available={_id:"6a0000000000000000000001",createdSource:"grower",inventoryType:"finished_product",status:"AVAILABLE",active:true};
  const deleted={...available,_id:"6a0000000000000000000002",status:"DELETED",active:false};
  const privateLot={...available,_id:"6a0000000000000000000003",inventoryType:"raw_material"};
  vi.spyOn(User,"find").mockImplementation(()=>query([]));
  vi.spyOn(Product,"find").mockImplementation(()=>query([available,deleted,privateLot]));
  vi.spyOn(Order,"find").mockImplementation(()=>query([]));
  vi.spyOn(users,"buildPublicFruitDiscovery").mockResolvedValue({fruits:[]});
  vi.spyOn(mandi,"getAvailableMandiFruitSlugs").mockResolvedValue(["mango"]);
  const res={header:vi.fn().mockReturnThis(),send:vi.fn(),status:vi.fn().mockReturnThis(),type:vi.fn().mockReturnThis()};
  await router.stack.find((layer)=>layer.route?.path==="/sitemap.xml").route.stack[0].handle({},res);
  expect(res.status).not.toHaveBeenCalled();
  const xml=res.send.mock.calls[0][0];
  expect(xml).toContain(`/lots/${available._id}`);
  for (const id of [deleted._id,privateLot._id,"6a1a888824c3a406bc961a3a"]) expect(xml).not.toContain(`/lots/${id}`);
  expect(xml).not.toContain("/delivery");
  expect(xml).toContain("/mandi-rates/mango");
});
