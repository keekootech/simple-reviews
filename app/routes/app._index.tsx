import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getAllReviews {
      products(first: 50) {
        nodes {
          metafield(namespace: "simple_reviews", key: "reviews") {
            value
          }
        }
      }
    }`
  );

  const data = await response.json();
  const products = data.data?.products?.nodes || [];

  let totalReviews = 0;
  let ratingSum = 0;
  let pendingCount = 0;

  for (const product of products) {
    if (product.metafield?.value) {
      const reviews = JSON.parse(product.metafield.value);
      for (const review of reviews) {
        totalReviews++;
        ratingSum += review.rating;
        if (!review.approved) pendingCount++;
      }
    }
  }

  const averageRating = totalReviews > 0 ? (ratingSum / totalReviews).toFixed(1) : "0.0";

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const emailsSentThisMonth = await db.reviewRequest.count({
    where: { shop: session.shop, sent: true, createdAt: { gte: startOfMonth } },
  });

  const upcomingEmails = await db.reviewRequest.findMany({
    where: { shop: session.shop, sent: false },
    orderBy: { sendAfter: "asc" },
    take: 20,
  });

  const recentSentEmails = await db.reviewRequest.findMany({
    where: { shop: session.shop, sent: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    totalReviews,
    averageRating,
    pendingCount,
    emailsSentThisMonth,
    emailsScheduled: upcomingEmails.length,
    upcomingEmails,
    recentSentEmails,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const id = String(formData.get("id"));
  const actionType = String(formData.get("actionType") || "cancel");

  if (actionType === "cancel") {
    await db.reviewRequest.delete({ where: { id } });
  } else if (actionType === "sendNow") {
    await db.reviewRequest.update({
      where: { id },
      data: { sendAfter: new Date() },
    });
  }

  return { success: true };
};

export default function Index() {
  const [justSent, setJustSent] = useState<string | null>(null);
  const {
    totalReviews,
    averageRating,
    pendingCount,
    emailsSentThisMonth,
    emailsScheduled,
    upcomingEmails,
    recentSentEmails,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher();

  const handleCancel = (id: string) => {
    fetcher.submit({ id, actionType: "cancel" }, { method: "post" });
  };

  const handleSendNow = (id: string) => {
    fetcher.submit({ id, actionType: "sendNow" }, { method: "post" });
    setJustSent(id);
  };

  const page: React.CSSProperties = {
    maxWidth: 760,
    margin: "0 auto",
    padding: "32px 24px 64px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#1a1a1a",
  };

  const statCard = (accent: string): React.CSSProperties => ({
    flex: 1,
    background: "#fff",
    borderRadius: 16,
    padding: "22px 20px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
    border: "1px solid #f0f0f0",
    borderTop: `3px solid ${accent}`,
  });

  const bigNum: React.CSSProperties = { fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 };
  const statLabel: React.CSSProperties = { color: "#8a8a8a", fontSize: 13, marginTop: 8, fontWeight: 500 };

  const section: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
    border: "1px solid #f0f0f0",
    padding: 24,
    marginTop: 20,
  };

  const sectionTitle: React.CSSProperties = { margin: "0 0 18px", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" };

  const sendNowBtn: React.CSSProperties = {
    padding: "8px 16px",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const cancelBtn: React.CSSProperties = {
    padding: "8px 16px",
    background: "#fff",
    color: "#e03131",
    border: "1px solid #ffd0d0",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const th: React.CSSProperties = { padding: "0 8px 12px", color: "#9a9a9a", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" };
  const td: React.CSSProperties = { padding: "14px 8px", fontSize: 14, verticalAlign: "middle" };

  const emptyState = (emoji: string, text: string) => (
    <div style={{ textAlign: "center", padding: "40px 16px" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{emoji}</div>
      <p style={{ margin: 0, fontSize: 14, color: "#9a9a9a" }}>{text}</p>
    </div>
  );

  return (
    <div style={{ background: "linear-gradient(180deg, #f7f8fa 0%, #f2f3f5 100%)", minHeight: "100vh" }}>
      <div style={page}>
        <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Simple Reviews</h1>
        <p style={{ color: "#8a8a8a", margin: "0 0 28px", fontSize: 15 }}>Here's how your reviews are doing.</p>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <div style={statCard("#111")}>
            <div style={bigNum}>{totalReviews}</div>
            <div style={statLabel}>Total reviews</div>
          </div>
          <div style={statCard("#f5a623")}>
            <div style={bigNum}>{averageRating} <span style={{ color: "#f5a623" }}>★</span></div>
            <div style={statLabel}>Average rating</div>
          </div>
          <div style={statCard("#e03131")}>
            <div style={bigNum}>{pendingCount}</div>
            <div style={statLabel}>Pending approval</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={statCard("#2f9e44")}>
            <div style={bigNum}>{emailsSentThisMonth}</div>
            <div style={statLabel}>Emails sent this month</div>
          </div>
          <div style={statCard("#1971c2")}>
            <div style={bigNum}>{emailsScheduled}</div>
            <div style={statLabel}>Emails scheduled (waiting)</div>
          </div>
        </div>

        <div style={section}>
          <h3 style={sectionTitle}>Upcoming review emails</h3>
          {upcomingEmails.length === 0 ? emptyState("📭", "Nothing scheduled right now.") : (
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                    <th style={th}>Customer</th>
                    <th style={th}>Product</th>
                    <th style={th}>Order</th>
                    <th style={th}>Sends on</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingEmails.map((req) => (
                    <tr key={req.id} style={{ borderBottom: "1px solid #f4f4f4" }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{req.customerName}</div>
                        <div style={{ color: "#aaa", fontSize: 13 }}>{req.customerEmail}</div>
                      </td>
                      <td style={td}>
                        {req.productName}
                        {justSent === req.id ? (
                          <div style={{ display: "inline-block", marginTop: 4, marginLeft: 0, color: "#2f9e44", fontSize: 12, fontWeight: 700, background: "#eafbf0", padding: "2px 8px", borderRadius: 20 }}>
                            ✓ Queued
                          </div>
                        ) : null}
                      </td>
                      <td style={td}>
                        <a href={`https://${req.shop}/admin/orders/${req.orderId}`} target="_blank" rel="noreferrer" style={{ color: "#1971c2", textDecoration: "none", fontWeight: 600 }}>#{req.orderNumber}</a>
                      </td>
                      <td style={{ ...td, color: "#777" }}>{new Date(req.sendAfter).toLocaleDateString()}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button style={sendNowBtn} onClick={() => handleSendNow(req.id)}>Send now</button>
                          <button style={cancelBtn} onClick={() => handleCancel(req.id)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={section}>
          <h3 style={sectionTitle}>Recently sent emails</h3>
          {recentSentEmails.length === 0 ? emptyState("✉️", "No emails sent yet.") : (
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                    <th style={th}>Customer</th>
                    <th style={th}>Product</th>
                    <th style={th}>Sent on</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSentEmails.map((req) => (
                    <tr key={req.id} style={{ borderBottom: "1px solid #f4f4f4" }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{req.customerName}</div>
                        <div style={{ color: "#aaa", fontSize: 13 }}>{req.customerEmail}</div>
                      </td>
                      <td style={td}>{req.productName}</td>
                      <td style={{ ...td, color: "#777" }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}