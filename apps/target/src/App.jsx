import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";

function Shell() {
  const location = useLocation();
  const [account, setAccount] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [chaos, setChaos] = useState({
    newsletterPopup: true,
      slowReview: true,
      stuckLoader: false
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const readFlag = (name, fallback) => {
      const value = params.get(name);
      if (value === null) {
        return fallback;
      }
      return value === "true";
    };

    setChaos({
      newsletterPopup: readFlag("newsletterPopup", true),
      slowReview: readFlag("slowReview", true),
      stuckLoader: readFlag("stuckLoader", false)
    });
  }, [location.search]);

  useEffect(() => {
    if (location.pathname === "/checkout" && chaos.newsletterPopup) {
      const timer = setTimeout(() => setNewsletterOpen(true), 1600);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, chaos.newsletterPopup]);

  return (
    <div className="store-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="site-header">
        <div>
          <p className="eyebrow">QA Playground</p>
          <h1>Neon Cart</h1>
        </div>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/signup">Sign Up</Link>
          <Link to="/store">Store</Link>
          <Link to="/checkout">Checkout ({cartCount})</Link>
        </nav>
      </header>

      <aside className="chaos-card">
        <h2>Chaos Switches</h2>
        <label>
          <input
            checked={chaos.newsletterPopup}
            name="newsletterPopup"
            onChange={(event) =>
              setChaos((current) => ({ ...current, newsletterPopup: event.target.checked }))
            }
            type="checkbox"
          />
          Newsletter pop-up blocks checkout
        </label>
        <label>
          <input
            checked={chaos.slowReview}
            name="slowReview"
            onChange={(event) => setChaos((current) => ({ ...current, slowReview: event.target.checked }))}
            type="checkbox"
          />
          Delayed review button enablement
        </label>
        <label>
          <input
            checked={chaos.stuckLoader}
            name="stuckLoader"
            onChange={(event) => setChaos((current) => ({ ...current, stuckLoader: event.target.checked }))}
            type="checkbox"
          />
          Infinite loader on review
        </label>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup account={account} onAccountCreated={setAccount} />} />
          <Route
            path="/store"
            element={<Store cartCount={cartCount} onAddToCart={() => setCartCount((value) => value + 1)} />}
          />
          <Route
            path="/checkout"
            element={
              <Checkout
                cartCount={cartCount}
                chaos={chaos}
                onOrderPlaced={() => setCartCount(0)}
              />
            }
          />
        </Routes>
      </main>

      {newsletterOpen ? (
        <div className="newsletter-modal" role="dialog" aria-modal="true" data-modal="true">
          <div className="newsletter-card">
            <p className="eyebrow">Pop-up Obstruction</p>
            <h2>Stay in the loop</h2>
            <p>
              This modal intentionally blocks the checkout CTA so the Auditor can detect obstructing UI.
            </p>
            <button className="secondary-button" onClick={() => setNewsletterOpen(false)} type="button">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Home() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Intent-Driven Testing</p>
        <h2>Break the UI. The orchestrator should recover.</h2>
        <p>
          Use this app to test sign-up, cart, and no-card checkout journeys under popups, loader delays, and layout
          noise.
        </p>
        <div className="hero-actions">
          <Link className="primary-link" to="/signup">
            Create Account
          </Link>
          <Link className="secondary-link" to="/store">
            Explore Store
          </Link>
        </div>
      </div>
      <div className="glass-card">
        <h3>Suggested goals</h3>
        <ul>
          <li>Create a new user</li>
          <li>Find a way to check out without a credit card</li>
          <li>See whether a popup hides the order button</li>
        </ul>
      </div>
    </section>
  );
}

function Signup({ account, onAccountCreated }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    onAccountCreated({
      name: form.name,
      email: form.email
    });
    setLoading(false);
    navigate("/signup?success=true");
  }

  const success = useMemo(
    () => new URLSearchParams(location.search).get("success") === "true",
    [location.search]
  );

  return (
    <section className="page-grid">
      <form className="glass-card form-card" onSubmit={submit}>
        <p className="eyebrow">Registration</p>
        <h2>Create your Neon Cart account</h2>
        <label>
          Full name
          <input
            name="name"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Hackathon Tester"
            value={form.name}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="qa.agent@example.com"
            type="email"
            value={form.email}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="TestPass123!"
            type="password"
            value={form.password}
          />
        </label>
        <button className="primary-button" type="submit">
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <article className="glass-card status-card">
        <h3>Account state</h3>
        {success && account ? (
          <>
            <p className="status-badge success-badge">Account created</p>
            <p>Welcome, {account.name}. Your profile is ready.</p>
            <p>{account.email}</p>
          </>
        ) : (
          <p>No account created yet.</p>
        )}
      </article>
    </section>
  );
}

function Store({ cartCount, onAddToCart }) {
  return (
    <section className="page-grid">
      <article className="product-card">
        <p className="eyebrow">Featured Product</p>
        <h2>Pulse Lamp</h2>
        <p>A tactile desk light with enough contrast and shimmer to make visual diffing obvious.</p>
        <div className="price-row">
          <strong>$149</strong>
          <span>{cartCount} items in cart</span>
        </div>
        <button className="primary-button" onClick={onAddToCart} type="button">
          Add to Cart
        </button>
      </article>
      <article className="glass-card">
        <h3>Why this page exists</h3>
        <p>
          The Explorer can click through to checkout from a realistic product card instead of relying on stable ids.
        </p>
      </article>
    </section>
  );
}

function Checkout({ cartCount, chaos, onOrderPlaced }) {
  const [address, setAddress] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [reviewState, setReviewState] = useState("idle");
  const [paymentMode, setPaymentMode] = useState("card");
  const [orderPlaced, setOrderPlaced] = useState(false);

  async function reviewOrder() {
    if (!address) {
      return;
    }

    setReviewState("loading");
    if (chaos.stuckLoader) {
      return;
    }

    const delay = chaos.slowReview ? 2200 : 450;
    await new Promise((resolve) => setTimeout(resolve, delay));
    setReviewState("ready");
  }

  async function placeOrder() {
    setReviewState("loading");
    await new Promise((resolve) => setTimeout(resolve, 900));
    setReviewState("done");
    setOrderPlaced(true);
    onOrderPlaced();
  }

  const invoiceEnabled = address.length > 6;
  const canPlaceOrder = reviewState === "ready" && (paymentMode === "invoice" || cardNumber.replace(/\s+/g, "").length >= 12);

  return (
    <section className="page-grid">
      <div className="glass-card form-card">
        <p className="eyebrow">Checkout</p>
        <h2>Complete the order</h2>
        <p>Cart size: {cartCount}</p>
        <label>
          Shipping address
          <input
            name="address"
            onChange={(event) => setAddress(event.target.value)}
            placeholder="221B Baker Street"
            value={address}
          />
        </label>

        <div className="payment-options">
          <button
            aria-pressed={paymentMode === "card"}
            className={`secondary-button ${paymentMode === "card" ? "active" : ""}`}
            onClick={() => setPaymentMode("card")}
            type="button"
          >
            Credit Card
          </button>
          <button
            aria-pressed={paymentMode === "invoice"}
            className={`secondary-button ${paymentMode === "invoice" ? "active" : ""}`}
            disabled={!invoiceEnabled}
            onClick={() => setPaymentMode("invoice")}
            type="button"
          >
            Pay by Invoice
          </button>
        </div>

        {paymentMode === "card" ? (
          <label>
            Card number
            <input
              name="cardNumber"
              onChange={(event) => setCardNumber(event.target.value)}
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
            />
          </label>
        ) : null}

        <button className="secondary-button" onClick={reviewOrder} type="button">
          Review Order
        </button>

        {reviewState === "loading" ? (
          <div aria-busy="true" className="loader-card" data-loader="true">
            <div className="spinner" />
            <p>Reviewing shipment and payment state...</p>
          </div>
        ) : null}

        <button className="primary-button" disabled={!canPlaceOrder} onClick={placeOrder} type="button">
          Place Order
        </button>
      </div>

      <article className="glass-card status-card">
        <h3>Order status</h3>
        {orderPlaced ? (
          <>
            <p className="status-badge success-badge">Invoice approved</p>
            <p>Order placed without a credit card.</p>
          </>
        ) : (
          <>
            <p>Use the address field, then review the order.</p>
            <p>
              The invoice path becomes available after the address is entered. The Auditor should also notice blocked
              buttons or endless loaders.
            </p>
          </>
        )}
      </article>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
