import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./models/User.js";
import Admin from "./models/Admin.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
import Auction from "./models/Auction.js";
import VerificationRequest from "./models/VerificationRequest.js";
import dotenv from "dotenv";

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Admin.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Auction.deleteMany({});
    await VerificationRequest.deleteMany({});

    // Create test users
    const hashedPassword = await bcrypt.hash("password123", 10);

    const users = [
      {
        name: "John Grower",
        email: "grower@test.com",
        password: hashedPassword,
        role: "grower",
        phone: "1234567890",
        isVerified: true,
        orchardName: "Sunny Orchards",
        location: "California",
      },
      {
        name: "Jane Buyer",
        email: "buyer@test.com",
        password: hashedPassword,
        role: "buyer",
        phone: "0987654321",
        isVerified: true,
        location: "New York",
      },
      {
        name: "OrchardGrowerstestuser",
        email: "orchardgrowerstestuser@test.com",
        password: hashedPassword,
        role: "buyer",
        phone: "7018108900",
        isVerified: true,
        location: "India",
        businessName: "Orchard Growers Test Buyer",
        buyerContactPerson: "OrchardGrowerstestuser",
      },
      {
        name: "Bob Driver",
        email: "driver@test.com",
        password: hashedPassword,
        role: "driver",
        phone: "1122334455",
        isVerified: true,
        location: "Texas",
      },
      {
        name: "Alice Pending",
        email: "pending@test.com",
        password: hashedPassword,
        role: "grower",
        phone: "5566778899",
        isVerified: false,
        orchardName: "Green Valley",
        location: "Florida",
      },
    ];

    const createdUsers = await User.insertMany(users);
    console.log("Created users:", createdUsers.length);

    // Create verification request
    const verificationRequest = new VerificationRequest({
      user: createdUsers[3]._id, // Alice Pending
      orchardName: "Green Valley",
      ownerName: "Alice Pending",
      location: "Florida",
      phone: "5566778899",
      documents: [
        {
          type: "video",
          path: "uploads/verification/sample_video.mp4",
          filename: "sample_video.mp4",
        },
      ],
      status: "SUBMITTED",
      adminReviews: [],
    });
    await verificationRequest.save();
    console.log("Created verification request");

    // Create demo products for every Orchard Growers category and filter.
    const demoProductSpecs = [
      ["all-products-showcase", "All Products Orchard Starter Pack", "All Products", "Plants Tools Seeds Inputs", "All products showcase with plants, tools, planters, seeds, organic inputs, and orchard care essentials.", "Orchard Growers India", 75, 499, "orchard plants gardening supplies"],
      ["seasonal-plants", "Seasonal Plants Collection", "Seasonal Plants", "Spring Summer Monsoon Autumn Winter", "Seasonal plants for spring, summer, monsoon, autumn, and winter garden planning.", "Shimla Nursery", 120, 349, "seasonal flowering plants nursery"],
      ["all-season-plants", "All Season Perennial Plants", "All Season Plants", "Perennial All Season", "All season perennial plants for year round homes, balconies, farms, and orchard borders.", "Solan Nursery", 90, 699, "perennial garden plants"],
      ["tools-equipments", "Tools & Equipments Garden Kit", "Tools & Equipments", "Hand Tools Equipment", "Tools and equipment kit with garden tool, pruning tool, sprayer, cutter, and hand equipment.", "Orchard Growers Store", 55, 1299, "garden tools equipment"],
      ["ornamental-plants", "Ornamental Plants Mix", "Ornamental Plants", "Flower Decorative", "Ornamental, flower, and decorative plants for entrances, patios, and landscape corners.", "Bengaluru Nursery", 85, 549, "ornamental plants flowers"],
      ["plant-seeds", "Plant Seeds Variety Box", "Plant Seeds", "Vegetable Flower Herb Seeds", "Plant seed box with vegetable seeds, flower seeds, herb seeds, and nursery seed trays.", "Pune Seed Centre", 180, 249, "plant seeds gardening"],
      ["organic-natural-products", "Organic and Natural Products Pack", "Organic and Natural Products", "Organic Natural Bio", "Organic, natural, and bio garden care products for healthier soil and safer plant growth.", "Kerala Organic Farm", 70, 899, "organic gardening products"],
      ["planters-pots", "Planters & Pots Combo", "Planters & Pots", "Planter Pot Grow Bag", "Planter, pot, and grow bag combo for terrace gardens, nurseries, and indoor plants.", "Delhi Garden Store", 110, 999, "planters pots garden"],
      ["tools", "Professional Orchard Tools", "Tools", "Tool Pruner Cutter", "Professional orchard tool set with pruning tool, grafting tool, cutter, and measuring tool.", "Orchard Tools Hub", 45, 1599, "orchard pruning tools"],
      ["live-fruit-plants", "Live Fruit Plants Bundle", "Live Fruit Plants", "Mango Apple Pear Plum Peach Citrus", "Live fruit plants including mango, apple, pear, plum, peach, and citrus nursery plants.", "Himachal Fruit Nursery", 140, 749, "fruit plant nursery"],
      ["live-forest-plants", "Live Forest Plant Saplings", "Live Forest Plants", "Forest Native Tree Timber Shade Tree", "Live forest plants with native tree, timber tree, and shade tree saplings for plantations.", "Uttarakhand Forest Nursery", 200, 649, "forest saplings native trees"],
      ["machineries", "Machineries Sprayer and Tiller", "Machineries", "Machine Sprayer Tiller Pump Cutter", "Machinery and machine options including sprayer, tiller, pump, cutter, and orchard equipment.", "Ludhiana Machinery Market", 18, 7499, "agriculture machinery sprayer tiller"],
      ["gardening-inputs", "Gardening Inputs Soil Kit", "Gardening Inputs", "Fertilizer Soil Mulch Cocopeat", "Gardening input kit with fertilizer, soil mix, mulch, cocopeat, and nursery media.", "Noida Garden Inputs", 95, 1199, "gardening soil fertilizer"],
      ["manure", "Organic Manure Compost", "Manure", "Manure Compost Vermicompost", "Manure, compost, and vermicompost for fruit plants, vegetables, and ornamental plants.", "Nashik Compost Farm", 160, 599, "organic compost manure"],
      ["growth-tonic", "Growth Tonic Booster", "Growth Tonic", "Growth Tonic Booster Bio Stimulant", "Growth tonic, booster, bio stimulant, and biostimulant support for healthy plant growth.", "Hyderabad Plant Care", 130, 799, "plant growth tonic fertilizer"],
      ["price-under-500", "Price Under Rs. 500 Starter Seeds", "Budget Seeds", "Price Under 500", "Affordable product for price under Rs. 500 filter and starter garden use.", "Jaipur Seed Store", 210, 299, "seed packets garden"],
      ["price-500-1000", "Price Rs. 500 - Rs. 1,000 Plant Pack", "Budget Plant Pack", "Price 500 1000", "Value product for price Rs. 500 to Rs. 1,000 filter and small garden orders.", "Chandigarh Nursery", 100, 799, "small nursery plants"],
      ["price-1000-2500", "Price Rs. 1,000 - Rs. 2,500 Orchard Kit", "Orchard Kit", "Price 1000 2500", "Mid range product for price Rs. 1,000 to Rs. 2,500 filter and orchard planning.", "Nagpur Orchard Store", 52, 1599, "orchard garden kit"],
      ["price-2500-5000", "Price Rs. 2,500 - Rs. 5,000 Premium Combo", "Premium Combo", "Price 2500 5000", "Premium product for price Rs. 2,500 to Rs. 5,000 filter and nursery bulk order.", "Lucknow Nursery Market", 34, 3499, "premium nursery plants"],
      ["price-above-5000", "Price Above Rs. 5,000 Machinery Pack", "Machinery Pack", "Price Above 5000", "High value product for price above Rs. 5,000 filter with orchard machinery support.", "Punjab Machinery Depot", 16, 8499, "farm machinery orchard"],
      ["season-spring", "Season Spring Flowering Plants", "Season Spring", "Spring", "Spring season plants for fresh garden beds, flowering borders, and orchard edges.", "Kashmir Spring Nursery", 115, 699, "spring flowering plants"],
      ["season-summer", "Season Summer Heat Ready Plants", "Season Summer", "Summer", "Summer season plants selected for heat, sun, terrace gardens, and outdoor landscapes.", "Rajasthan Summer Nursery", 105, 749, "summer garden plants"],
      ["season-monsoon", "Season Monsoon Rainy Plants", "Season Monsoon", "Monsoon Rainy", "Monsoon season and rainy season plants for fast establishment and plantation drives.", "Konkan Monsoon Nursery", 150, 649, "monsoon plants rain garden"],
      ["season-autumn", "Season Autumn Garden Plants", "Season Autumn", "Autumn Fall", "Autumn season and fall garden plants for colorful borders and orchard preparation.", "Dehradun Autumn Nursery", 80, 899, "autumn garden plants"],
      ["season-winter", "Season Winter Hardy Plants", "Season Winter", "Winter", "Winter season hardy plants for cool weather gardens, orchards, and nursery displays.", "Manali Winter Nursery", 95, 999, "winter hardy plants"],
    ];

    const products = demoProductSpecs.map(([slug, title, fruitName, variety, description, location, quantity, basePrice, imageQuery], index) => ({
      title,
      fruitName,
      variety,
      description,
      location,
      quantity,
      lotNo: `OG-DEMO-${String(index + 1).padStart(3, "0")}`,
      packingType: "Demo listing",
      packingWeightKg: 1,
      totalWeightKg: quantity,
      basePrice,
      createdBy: createdUsers[0]._id,
      images: Array.from({ length: 5 }, (_, imageIndex) =>
        `https://source.unsplash.com/640x480/?${encodeURIComponent(imageQuery)}&sig=${slug}-${imageIndex + 1}`
      ),
      status: "AVAILABLE",
    }));

    const createdProducts = await Product.insertMany(products);
    console.log("Created products:", createdProducts.length);

    // Create auction
    const auction = new Auction({
      product: createdProducts[0]._id,
      startingPrice: 40,
      currentBid: 45,
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      bids: [],
      status: "ACTIVE",
    });
    await auction.save();
    console.log("Created auction");

    // Create orders
    const orders = [
      {
        buyer: createdUsers[1]._id,
        items: [
          {
            product: createdProducts[0]._id,
            quantity: 10,
            price: 50,
          },
        ],
        totalAmount: 500,
        status: "completed",
        deliveryAddress: "123 Buyer St, New York",
      },
      {
        buyer: createdUsers[1]._id,
        items: [
          {
            product: createdProducts[1]._id,
            quantity: 5,
            price: 30,
          },
        ],
        totalAmount: 150,
        status: "pending",
        deliveryAddress: "123 Buyer St, New York",
      },
    ];

    const createdOrders = await Order.insertMany(orders);
    console.log("Created orders:", createdOrders.length);

    // Create admins
    const adminPassword = await bcrypt.hash("admin123", 10);
    const admins = [
      {
        name: "Super Admin",
        email: "super@admin.com",
        password: adminPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
      {
        name: "Admin X",
        email: "adminx@admin.com",
        password: adminPassword,
        role: "ADMIN",
        status: "ACTIVE",
      },
    ];

    await Admin.insertMany(admins);
    console.log("Created admins:", admins.length);

    console.log("Test data seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
