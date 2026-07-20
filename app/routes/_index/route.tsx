import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #f7f8fa 0%, #eef0f3 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: 24,
  };

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
    border: "1px solid #f0f0f0",
    padding: "48px 40px",
    maxWidth: 460,
    width: "100%",
    textAlign: "center",
  };

  const feature: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    textAlign: "left",
    fontSize: 14,
    color: "#555",
    marginBottom: 12,
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
        <h1 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#1a1a1a" }}>
          Simple Reviews
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, color: "#777", lineHeight: 1.5 }}>
          Automatically collect verified product reviews from real buyers — and turn them into social proof that sells.
        </p>

        {showForm && (
          <Form method="post" action="/auth/login" style={{ marginBottom: 28 }}>
            <label style={{ display: "block", textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
                Shop domain
              </span>
              <input
                type="text"
                name="shop"
                placeholder="my-shop-domain.myshopify.com"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </label>
            <button
              type="submit"
              style={{
                marginTop: 14,
                width: "100%",
                padding: "12px 20px",
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          </Form>
        )}

        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 24 }}>
          <div style={feature}>
            <span>📧</span>
            <span><strong>Automated emails.</strong> We ask customers for a review after their order is delivered — hands-free.</span>
          </div>
          <div style={feature}>
            <span>⭐</span>
            <span><strong>Verified reviews.</strong> Star ratings and reviews display beautifully on your product pages.</span>
          </div>
          <div style={feature}>
            <span>🔍</span>
            <span><strong>Google-ready.</strong> Star ratings can appear in Google Search results to boost clicks.</span>
          </div>
        </div>
      </div>
    </div>
  );
}