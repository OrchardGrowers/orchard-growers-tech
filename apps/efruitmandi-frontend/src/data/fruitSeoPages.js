export const fruitSeoPages = {
  buyers: {
    apple: {
      title: "Apple Buyers in India | Buy Apples Directly from Growers | eFruitMandi",
      description: "Find apple growers, apple lots, grading, packing, offers, logistics and direct sourcing support through eFruitMandi.",
      h1: "Apple Buyers in India",
      intro: "eFruitMandi helps apple buyers, wholesalers, traders, commission agents, retailers and bulk purchasers discover apple lots directly from growers and orchard owners.",
      sections: [
        {
          title: "Apple sourcing through eFruitMandi",
          body: [
            "Apple buyers can review available lots, fruit variety, grade, packing, estimated quantity, orchard location, harvest stage, photos and seller information where available.",
            "The platform supports offer-based communication. Buyers can compare lots and share rates through a documented process instead of depending only on scattered phone calls."
          ]
        },
        {
          title: "What apple buyers should check",
          body: [
            "Apple buyers should check grade, size, colour percentage, packing quality, carton type, maturity, storage history, dispatch readiness and transport feasibility.",
            "For Himachal Pradesh, Jammu and Kashmir, Uttarakhand and other apple growing regions, location and road distance are important because transport timing can affect fruit value."
          ]
        },
        {
          title: "Useful for wholesale and mandi-linked buyers",
          body: [
            "This page is useful for apple wholesalers, fruit traders, commission agents, retail chains, processors, exporters and institutional buyers looking for organized apple sourcing.",
            "eFruitMandi does not force any trade. Final rate, quantity, payment and dispatch terms depend on mutual agreement between buyer and grower."
          ]
        }
      ]
    }
  },
  growers: {
    apple: {
      title: "Apple Growers in India | List Apple Lots Online | eFruitMandi",
      description: "Apple growers can list fruit lots, share grading and packing details, receive buyer offers and improve market reach through eFruitMandi.",
      h1: "Apple Growers in India",
      intro: "eFruitMandi helps apple growers and orchard owners list produce online, receive buyer interest and manage fruit trade communication with better documentation.",
      sections: [
        {
          title: "Apple lot listing for growers",
          body: [
            "Apple growers can list fruit type, variety, grade, size, packing, expected quantity, harvest stage, orchard location, photos and dispatch timeline.",
            "Clear information helps buyers understand quality and share more practical offers."
          ]
        },
        {
          title: "Improve buyer confidence",
          body: [
            "Apple growers should upload fresh photos, avoid misleading quality claims and mention grade-wise details honestly.",
            "Good grading, packing, location clarity and realistic quantity details can improve buyer confidence."
          ]
        },
        {
          title: "For orchard regions",
          body: [
            "The page is useful for apple growers from Himachal Pradesh, Jammu and Kashmir, Uttarakhand and other apple producing areas.",
            "eFruitMandi is a marketplace facilitation platform. Final sale depends on mutual agreement between grower and buyer."
          ]
        }
      ]
    }
  },
  marketPrice: {
    apple: {
      title: "Apple Market Price | Apple Mandi Bhav and Rate Discovery | eFruitMandi",
      description: "Understand apple market price, mandi bhav, buyer offers, grade-wise rates, packing impact and transport factors with eFruitMandi.",
      h1: "Apple Market Price and Mandi Bhav",
      intro: "Apple market price depends on grade, size, colour, variety, packing, market demand, buyer location, transport distance and harvest timing.",
      sections: [
        {
          title: "Apple rate discovery",
          body: [
            "eFruitMandi helps growers and buyers compare apple lots and offers before final trade.",
            "The platform does not guarantee a fixed apple mandi rate. Rates change according to market demand, quality and commercial feasibility."
          ]
        },
        {
          title: "Factors affecting apple price",
          body: [
            "Important factors include A grade, B grade, mixed grade, colour percentage, carton packing, storage condition, location, quantity, maturity and road distance.",
            "Transport cost, loading time, weather and buyer demand can also affect final apple offer."
          ]
        },
        {
          title: "Use price information carefully",
          body: [
            "Apple market price should be used as guidance, not as a guaranteed selling price.",
            "Growers should compare offers, quality expectations, payment clarity and logistics before final confirmation."
          ]
        }
      ]
    }
  },
  transport: {
    default: {
      title: "Fruit Transport in India | Apple, Mango and Pear Logistics | eFruitMandi",
      description: "Fruit transport, apple transportation, mango logistics, pear transport, loading, dispatch, route planning and delivery coordination through eFruitMandi.",
      h1: "Fruit Transport and Logistics",
      intro: "Fruit transport requires careful coordination because delay, poor loading, wrong route planning or unclear communication can affect fruit quality and trade value.",
      sections: [
        {
          title: "Fruit transportation network",
          body: [
            "eFruitMandi aims to support fruit growers, buyers, drivers, transporters and logistics partners with better delivery-related records and coordination.",
            "The network can support apple transportation, mango transportation, pear transportation, pomegranate transportation, grape transportation, plum transportation and other seasonal fruit logistics."
          ]
        },
        {
          title: "Transport cost factors",
          body: [
            "Fruit transport cost may depend on distance, vehicle size, fruit category, loading requirements, unloading requirements, route condition, fuel prices and seasonal demand.",
            "Cold chain or refrigerated transport may be needed for selected fruits or long-distance movement."
          ]
        },
        {
          title: "Important disclaimer",
          body: [
            "eFruitMandi is not a transporter, carrier, freight forwarder, warehouse operator or insurer unless specifically agreed in writing.",
            "Final vehicle selection, route, freight, delivery timing and cargo responsibility should be clearly agreed between concerned parties."
          ]
        }
      ]
    }
  }
};

export function getFruitSeoPage(type, fruitSlug) {
  if (type === "transport") return fruitSeoPages.transport.default;
  return fruitSeoPages[type]?.[fruitSlug] || null;
}
