import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaSearchMinus, FaSearchPlus, FaStar } from "react-icons/fa";
import { withDemoProducts } from "../demoProducts";
import { FILE_BASE_URL } from "../services/api";
import { fetchProducts } from "../services/productService";
import type { Product } from "../types";

const CART_KEY = "orchardCart";

type ProductImagePreview = {
  images: string[];
  activeIndex: number;
  title: string;
};

function addToCart(product: Product) {
  const current = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  const stockIssue = getStockIssue(product, current);

  if (stockIssue) {
    return stockIssue;
  }

  const existing = current.find((item: { productId: string }) => item.productId === product._id);
  const next = existing
    ? current.map((item: { productId: string; quantity: number }) =>
        item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
      )
    : [
        ...current,
        {
          productId: product._id,
          title: product.title || product.fruitName || "Product",
          unitPrice: Number(product.basePrice || 0),
          quantity: 1,
          imageUrl: product.images?.[0] || "",
        },
      ];

  localStorage.setItem(CART_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("orchard-cart-updated"));
  return null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingProduct, setRatingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<ProductImagePreview | null>(null);
  const [stockMessage, setStockMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProducts();
        setProducts(withDemoProducts(data));
      } catch (err) {
        setProducts(withDemoProducts([]));
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Orchard Growers Products</h2>
            <p className="mt-2 text-slate-600">Browse plants, tools, seeds, and orchard essentials from Orchard Growers.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
            Orchard Growers brand
          </span>
          <Link to="/cart" className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white">
            View Cart
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-700 shadow-sm">
          Loading products...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-700 shadow-sm">
          No products available yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article key={product._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <ProductDescriptionPreview product={product} />
              <ProductImageCarousel product={product} onOpenImage={setImagePreview} />
              <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-end">
                <div className="min-w-0 text-sm text-black">
                  <h3 className="line-clamp-1 font-semibold">{product.title || "Product Name"}</h3>
                  <ProductStockLine product={product} />
                  <p className="mt-2 line-clamp-1 font-medium">{product.description || "Product Description"}</p>
                  <ProductRatingSummary productId={product._id} />
                  <p className="mt-2 text-xs font-medium leading-4 text-slate-600">
                    "{getDemoReview(product._id)}"
                  </p>
                </div>
                <div className="grid gap-2 sm:col-start-2 sm:row-start-1 sm:self-end">
                  <button
                    type="button"
                    onClick={() => setRatingProduct(product)}
                    className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                  >
                    Rate Product
                  </button>
                  <span className="hidden">{product.basePrice}</span>
                </div>
                <div className="hidden">
                  <p>{product.quantity} units available</p>
                  <p>Sold by Orchard Growers</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const stockIssue = addToCart(product);
                    if (stockIssue) setStockMessage(stockIssue);
                  }}
                  className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 sm:col-start-2 sm:row-start-1 sm:self-end sm:translate-y-[48px]"
                >
                  Add to Cart
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <RatingPopup product={ratingProduct} onClose={() => setRatingProduct(null)} />
      <ImagePreviewModal preview={imagePreview} onClose={() => setImagePreview(null)} />
      <StockNoticePopup message={stockMessage} onClose={() => setStockMessage("")} />
    </section>
  );
}

function ProductImageCarousel({
  product,
  onOpenImage,
}: {
  product: Product;
  onOpenImage: (preview: ProductImagePreview) => void;
}) {
  const images = getProductImages(product);
  const [activeImage, setActiveImage] = useState(0);

  if (!images.length) {
    return <div className="flex h-56 items-center justify-center bg-slate-100 text-slate-400">No image</div>;
  }

  const activeAlt = `${product.title || "Product"} ${activeImage + 1}`;
  const showPrevious = () => setActiveImage((current) => (current === 0 ? images.length - 1 : current - 1));
  const showNext = () => setActiveImage((current) => (current + 1) % images.length);

  return (
    <div className="relative h-56 overflow-hidden bg-green-50">
      <button
        type="button"
        onClick={() => onOpenImage({ images, activeIndex: activeImage, title: product.title || "Product" })}
        className="block h-full w-full"
        aria-label={`Open ${activeAlt} fullscreen`}
      >
        <img src={images[activeImage]} alt={activeAlt} className="h-full w-full object-cover" />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
            aria-label="Show previous product image"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
            aria-label="Show next product image"
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

function ProductDescriptionPreview({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const description = product.description || `${product.title || product.fruitName || "This product"} from Orchard Growers.`;

  return (
    <div className="border-b border-slate-100 p-4 text-sm leading-5 text-slate-700">
      <p className={expanded ? "" : "line-clamp-2"}>{description}</p>
      {description.length > 72 && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-xs font-semibold text-green-700 hover:text-green-800"
        >
          {expanded ? "Show Less" : "Show More"}
        </button>
      )}
    </div>
  );
}

function ProductStockLine({ product }: { product: Product }) {
  const stock = getProductStock(product);
  const inStock = isProductInStock(product);

  return (
    <p className={`mt-1 text-xs font-semibold ${inStock ? "text-green-700" : "text-rose-600"}`}>
      {inStock ? `Stock: ${stock} unit${stock === 1 ? "" : "s"}` : "Out of stock"}
    </p>
  );
}

function ProductRatingSummary({ productId }: { productId: string }) {
  const rating = getDemoRating(productId);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="flex items-center gap-0.5 text-amber-400" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <FaStar key={index} className={index < Math.round(rating) ? "text-amber-400" : "text-slate-300"} aria-hidden="true" />
        ))}
      </span>
      <span className="font-semibold text-slate-700">{rating.toFixed(1)} out of 5</span>
    </div>
  );
}

function StockNoticePopup({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 px-4">
      <section className="w-full max-w-xs rounded-lg bg-white p-5 text-center shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Stock Alert</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-md bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          OK
        </button>
      </section>
    </div>
  );
}

function RatingPopup({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!product) return;
    setRating(Math.round(getDemoRating(product._id)));
    setComment("");
  }, [product]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
      <section className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Rate Product</h2>
            <p className="mt-1 line-clamp-1 text-sm text-slate-600">{product.title || "Orchard Growers product"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="text-2xl"
                aria-label={`Rate ${value} out of 5`}
              >
                <FaStar className={value <= rating ? "text-amber-400" : "text-slate-300"} aria-hidden="true" />
              </button>
            );
          })}
          <span className="text-sm font-semibold text-slate-700">{rating} out of 5</span>
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Comment
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share your experience with this product"
            className="mt-2 min-h-24 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-700"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={onClose} className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
            Submit Rating
          </button>
        </div>
      </section>
    </div>
  );
}

function ImagePreviewModal({
  preview,
  onClose,
}: {
  preview: ProductImagePreview | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!preview) return;
    setZoom(1);
    setActiveIndex(preview.activeIndex);
  }, [preview]);

  if (!preview) return null;

  const activeSrc = preview.images[activeIndex] || preview.images[0];
  const activeAlt = `${preview.title} ${activeIndex + 1}`;
  const showPrevious = () => {
    setZoom(1);
    setActiveIndex((current) => (current === 0 ? preview.images.length - 1 : current - 1));
  };
  const showNext = () => {
    setZoom(1);
    setActiveIndex((current) => (current + 1) % preview.images.length);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/95">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow hover:bg-green-50"
          aria-label="Zoom out"
        >
          <FaSearchMinus aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow hover:bg-green-50"
          aria-label="Zoom in"
        >
          <FaSearchPlus aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-900 shadow hover:bg-green-50"
          aria-label="Close fullscreen image"
        >
          ×
        </button>
      </div>
      {preview.images.length > 1 && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow hover:bg-green-50"
            aria-label="Show previous image"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow hover:bg-green-50"
            aria-label="Show next image"
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        </>
      )}
      <div className="flex h-full w-full items-center justify-center overflow-auto p-6">
        <img
          src={activeSrc}
          alt={activeAlt}
          className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
      {preview.images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800">
          {activeIndex + 1} / {preview.images.length}
        </div>
      )}
    </div>
  );
}

function getDemoRating(productId: string) {
  const ratings = [4.8, 4.7, 4.9, 4.6, 4.8];
  return ratings[getStableDemoIndex(productId, ratings.length)];
}

function getDemoReview(productId: string) {
  const reviews = [
    "Healthy plants and neat packaging from Orchard Growers.",
    "Good quality product, delivered fresh and ready to use.",
    "Strong growth after planting. Very happy with the quality.",
    "Clean packing, useful product, and reliable Orchard Growers support.",
    "Looks premium and performed well in our garden setup.",
  ];
  return reviews[getStableDemoIndex(productId, reviews.length)];
}

function getStableDemoIndex(value: string, length: number) {
  return Array.from(value || "orchard").reduce((sum, char) => sum + char.charCodeAt(0), 0) % length;
}

function getProductStock(product: Product) {
  return Math.max(0, Number(product.quantity || 0));
}

function isProductInStock(product: Product) {
  const status = product.status?.toUpperCase();
  const statusAvailable = !status || status === "AVAILABLE" || status === "ACTIVE";
  return statusAvailable && getProductStock(product) > 0;
}

function getStockIssue(product: Product, cartItems: Array<{ productId: string; quantity: number }>) {
  const title = product.title || product.fruitName || "This product";
  const stock = getProductStock(product);

  if (!isProductInStock(product)) {
    return `${title} is out of stock.`;
  }

  const existingQuantity = cartItems.find((item) => item.productId === product._id)?.quantity || 0;
  if (existingQuantity >= stock) {
    return `Only ${stock} unit${stock === 1 ? "" : "s"} available for ${title}.`;
  }

  return "";
}

function getProductImages(product: Product) {
  if (!Array.isArray(product.images)) return [];
  return product.images.map(normalizeProductImage).filter(Boolean);
}

function normalizeProductImage(image: string) {
  const normalized = image ? image.replace(/\\/g, "/") : "";
  if (!normalized) return "";
  if (/^https?:\/\//.test(normalized)) return normalized;
  return `${FILE_BASE_URL}/${normalized}`;
}
