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

  const cardStyle: React.CSSProperties = {
    flex: 1,
    background: "#fff",
    border: "1px solid #ececec",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };
  const numberStyle = { fontSize: 30, fontWeight: 800 as const, color: "#111" };
  const labelStyle = { color: "#777", fontSize: 13, marginTop: 4 };

  const sectionCard: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #ececec",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    padding: 20,
    marginTop: 24,
  };

  const sendNowBtn: React.CSSProperties = {
    padding: "7px 16px",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const cancelBtn: React.CSSProperties = {
    padding: "7px 16px",
    background: "#fff",
    color: "#d33",
    border: "1px solid #ffd6d6",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const thStyle: React.CSSProperties = { padding: "10px 8px", color: "#666", fontWeight: 600 };
  const tdStyle: React.CSSProperties = { padding: "12px 8px" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif", background: "#fafafa" }}>
      <h1 style={{ marginBottom: 4, fontSize: 26 }}>Simple Reviews</h1>
      <p style={{ color: "#777", marginBottom: 28 }}>Here's how your reviews are doing.</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={numberStyle}>{totalReviews}</div>
          <div style={labelStyle}>Total reviews</div>
        </div>
        <div style={cardStyle}>
          <div style={numberStyle}>{averageRating} ★</div>
          <div style={labelStyle}>Average rating</div>
        </div>
        <div style={cardStyle}>
          <div style={numberStyle}>{pendingCount}</div>
          <div style={labelStyle}>Pending approval</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ ...cardStyle, background: "#f0f8f0" }}>
          <div style={numberStyle}>{emailsSentThisMonth}</div>
          <div style={labelStyle}>Emails sent this month</div>
        </div>
        <div style={{ ...cardStyle, background: "#fff8ec" }}>
          <div style={numberStyle}>{emailsScheduled}</div>
          <div style={labelStyle}>Emails scheduled (waiting)</div>
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Upcoming review emails</h3>
        {upcomingEmails.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#999" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <p style={{ margin: 0, fontSize: 14 }}>Nothing scheduled right now.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Order</th>
                  <th style={thStyle}>Sends on</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {upcomingEmails.map((req, idx) => (
                  <tr key={req.id} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f2f2f2" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{req.customerName}</div>
                      <div style={{ color: "#999", fontSize: 13 }}>{req.customerEmail}</div>
                    </td>
                    <td style={tdStyle}>
                      {req.productName}
                      {justSent === req.id ? (
                        <div style={{ color: "#0a0", fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                          ✓ Will be sent soon
                        </div>
                      ) : null}
                    </td>
                   <td style={tdStyle}>
                      <a href={`https://${req.shop}/admin/orders/${req.orderId}`} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "none" }}>#{req.orderNumber}</a>
                    </td>
                    <td style={{ ...tdStyle, color: "#666" }}>
                      {new Date(req.sendAfter).toLocaleDateString()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
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

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Recently sent emails</h3>
        {recentSentEmails.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#999" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
            <p style={{ margin: 0, fontSize: 14 }}>No emails sent yet.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Sent on</th>
                </tr>
              </thead>
              <tbody>
                {recentSentEmails.map((req, idx) => (
                  <tr key={req.id} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f2f2f2" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{req.customerName}</div>
                      <div style={{ color: "#999", fontSize: 13 }}>{req.customerEmail}</div>
                    </td>
                    <td style={tdStyle}>{req.productName}</td>
                    <td style={{ ...tdStyle, color: "#666" }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}