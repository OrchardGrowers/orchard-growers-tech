import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SEO, { getInitialPublicMetadata } from "./SEO";
import LotDetails from "../pages/LotDetails";
import MandiRates from "../pages/MandiRates";

const origin = "https://www.efruitmandi.live";
const originalCanUseDOM = HelmetProvider.canUseDOM;

function serverMetadata({ canonical, title = "Apple on eFruitMandi", description = "Public apple marketplace activity.", robots = "index,follow" } = {}) {
  vi.stubGlobal("document", {
    title,
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]') return canonical ? { href: canonical } : null;
      if (selector === 'meta[name="description"]') return { getAttribute: () => description };
      if (selector === 'meta[name="robots"]') return { getAttribute: () => robots };
      return null;
    },
  });
}

function renderHead(element) {
  const context = {};
  const body = renderToStaticMarkup(<HelmetProvider context={context}>{element}</HelmetProvider>);
  return {
    body,
    title: context.helmet.title.toString(),
    meta: context.helmet.meta.toString(),
    links: context.helmet.link.toString(),
  };
}

beforeEach(() => {
  HelmetProvider.canUseDOM = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  HelmetProvider.canUseDOM = originalCanUseDOM;
});

describe("initial public SEO metadata", () => {
  it("rejects homepage metadata when the requested route canonical differs", () => {
    serverMetadata({ canonical: origin + "/", title: "Homepage" });
    expect(getInitialPublicMetadata("/fruits/apple")).toBeNull();
  });

  it("preserves metadata only for the matching public route", () => {
    serverMetadata({ canonical: origin + "/fruits/apple", robots: "index, follow" });
    expect(getInitialPublicMetadata("/fruits/apple")).toEqual({
      canonical: origin + "/fruits/apple",
      title: "Apple on eFruitMandi",
      description: "Public apple marketplace activity.",
      robots: "index,follow",
    });
  });

  it("rejects a null canonical even when the document contains public metadata", () => {
    serverMetadata({ canonical: origin + "/fruits/apple" });
    expect(getInitialPublicMetadata(null)).toBeNull();
  });

  it("does not invent initial metadata without a document canonical", () => {
    serverMetadata();
    expect(getInitialPublicMetadata("/fruits/apple")).toBeNull();
    vi.stubGlobal("document", undefined);
    expect(getInitialPublicMetadata("/fruits/apple")).toBeNull();
  });
});

describe("public SEO while client data is loading", () => {
  it("retains server indexability and route metadata instead of temporary loading defaults", () => {
    serverMetadata({ canonical: origin + "/fruits/apple" });
    const head = renderHead(<SEO canonical="/fruits/apple" loading noIndex robots="noindex,nofollow" title="Loading" description="Loading public activity." />);
    expect(head.title).toContain("Apple on eFruitMandi");
    expect(head.meta).toContain('name="description" content="Public apple marketplace activity."');
    expect(head.meta).toContain('name="robots" content="index,follow"');
    expect(head.meta).toContain('name="googlebot" content="index,follow"');
    expect(head.meta).not.toContain("noindex");
    expect(head.links).toContain('href="' + origin + '/fruits/apple"');
    expect(head.links.match(/rel="canonical"/g)).toHaveLength(1);
  });

  it("does not replace route metadata with a mismatched homepage snapshot", () => {
    serverMetadata({ canonical: origin + "/", title: "Homepage", description: "Homepage description." });
    const head = renderHead(<SEO canonical="/fruits/apple" loading robots="noindex,follow" title="Apple route" description="Apple route description." />);
    expect(head.title).toContain("Apple route");
    expect(head.meta).toContain('name="robots" content="noindex,follow"');
    expect(head.meta).not.toContain("Homepage");
    expect(head.links).toContain('href="' + origin + '/fruits/apple"');
    expect(head.links.match(/rel="canonical"/g)).toHaveLength(1);
  });

  it("uses resolved metadata once loading completes", () => {
    serverMetadata({ canonical: origin + "/fruits/apple" });
    const head = renderHead(<SEO canonical="/fruits/apple" title="Resolved Apple" description="Resolved description." robots="noindex,follow" />);
    expect(head.title).toContain("Resolved Apple");
    expect(head.meta).toContain('name="robots" content="noindex,follow"');
    expect(head.meta).toContain('name="description" content="Resolved description."');
  });

  it("keeps search and unavailable pages without canonical or og:url", () => {
    serverMetadata({ canonical: origin + "/" });
    const head = renderHead(<SEO canonical={null} robots="noindex,follow" title="Search" loading />);
    expect(head.links).not.toContain("canonical");
    expect(head.meta).not.toContain('property="og:url"');
    expect(head.meta).toContain('name="robots" content="noindex,follow"');
  });

  it("keeps an invalid mandi route unavailable without adding a canonical", () => {
    serverMetadata();
    const head = renderHead(<MemoryRouter initialEntries={["/mandi-rates/not-a-real-fruit"]}><Routes><Route path="/mandi-rates/:commoditySlug" element={<MandiRates />} /></Routes></MemoryRouter>);
    expect(head.links).not.toContain("canonical");
    expect(head.meta).not.toContain('property="og:url"');
    expect(head.meta).toContain('name="robots" content="noindex,follow"');
    expect(head.body).toMatch(/not found|unavailable/i);
  });
});


describe("lot loading metadata", () => {
  const id="6a1a888824c3a406bc961a3a";
  const renderLot=()=>renderHead(<MemoryRouter initialEntries={[`/lots/${id}`]}><Routes><Route path="/lots/:lotId" element={<LotDetails />} /></Routes></MemoryRouter>);
  it("retains the successful server lot title, canonical and indexability", () => {
    serverMetadata({canonical:origin+"/lots/"+id,title:"Alphonso Mango Lot | eFruitMandi"});
    const head=renderLot();
    expect(head.title).toContain("Alphonso Mango Lot");
    expect(head.meta).toContain('name="robots" content="index,follow"');
    expect(head.links).toContain(origin+"/lots/"+id);
  });
  it("does not invent a canonical before a client-only lot lookup succeeds", () => {
    serverMetadata({canonical:origin+"/"});
    const head=renderLot();
    expect(head.links).not.toContain("canonical");
    expect(head.meta).toContain('name="robots" content="noindex,follow"');
    expect(head.title).not.toContain("Fresh Fruit Lot Details");
  });
});
