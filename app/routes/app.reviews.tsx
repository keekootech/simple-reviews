import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

type Review = {
  id: string;
  orderId: string;
  customerName: string;
  rating: number;
  body: string;
  verified: boolean;
  approved: boolean;
  createdAt: string;
  reply: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getAllReviews {
      products(first: 50) {
        nodes {
          id
          title
          metafield(namespace: "simple_reviews", key: "reviews") {
            value
          }
        }
      }
    }`
  );

  const data = await response.json();
  const products = data.data?.products?.nodes || [];

  const allReviews: (Review & { productId: string; productTitle: string })[] = [];

  for (const product of products) {
    if (product.metafield?.value) {
      const reviews: Review[] = JSON.parse(product.metafield.value);
      for (const review of reviews) {
        allReviews.push({ ...review, productId: product.id, productTitle: product.title });
      }
    }
  }

  allReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalReviews = allReviews.length;
  const averageRating =
    totalReviews > 0
      ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : "0.0";
  const pendingCount = allReviews.filter((r) => !r.approved).length;

  return { reviews: allReviews, totalReviews, averageRating, pendingCount };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const productId = String(formData.get("productId"));
  const reviewId = String(formData.get("reviewId"));
  const actionType = String(formData.get("actionType")); // "approve", "reject", or "reply"
  const replyText = String(formData.get("replyText") || "");

  const response = await admin.graphql(
    `#graphql
    query getMetafield($id: ID!) {
      product(id: $id) {
        metafield(namespace: "simple_reviews", key: "reviews") {
          value
        }
      }
    }`,
    { variables: { id: productId } }
  );

  const data = await response.json();
  const reviews: Review[] = data.data?.product?.metafield?.value
    ? JSON.parse(data.data.product.metafield.value)
    : [];

  let updatedReviews;
  if (actionType === "reject") {
    updatedReviews = reviews.filter((r) => r.id !== reviewId);
  } else if (actionType === "reply") {
    updatedReviews = reviews.map((r) =>
      r.id === reviewId ? { ...r, reply: replyText } : r
    );
  } else {
    updatedReviews = reviews.map((r) =>
      r.id === reviewId ? { ...r, approved: true } : r
    );
  }

  await admin.graphql(
    `#graphql
    mutation setMetafield($input: MetafieldsSetInput!) {
      metafieldsSet(metafields: [$input]) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          ownerId: productId,
          namespace: "simple_reviews",
          key: "reviews",
          type: "json",
          value: JSON.stringify(updatedReviews),
        },
      },
    }
  );

  return { success: true };
};

export default function ReviewsDashboard() {
  const { reviews, totalReviews, averageRating, pendingCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const filteredReviews = reviews.filter((r) => {
    if (filter === "pending") return !r.approved;
    if (filter === "approved") return r.approved;
    return true;
  });

  const handleAction = (productId: string, reviewId: string, actionType: "approve" | "reject") => {
    fetcher.submit({ productId, reviewId, actionType }, { method: "post" });
  };

  const handleReply = (productId: string, reviewId: string) => {
    const replyText = replyDrafts[reviewId] || "";
    fetcher.submit({ productId, reviewId, actionType: "reply", replyText }, { method: "post" });
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 24 }}>Reviews</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>{totalReviews}</div>
          <div style={{ color: "#666" }}>Total reviews</div>
        </div>
        <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>{averageRating} ★</div>
          <div style={{ color: "#666" }}>Average rating</div>
        </div>
        <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>{pendingCount}</div>
          <div style={{ color: "#666" }}>Pending approval</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "pending", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              border: "1px solid #000",
              background: filter === f ? "#000" : "#fff",
              color: filter === f ? "#fff" : "#000",
              cursor: "pointer",
              borderRadius: 4,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filteredReviews.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "#999" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗒️</div>
          <p style={{ margin: 0 }}>No reviews here yet.</p>
        </div>
      )}

      {filteredReviews.map((review) => (
        <div
          key={review.id}
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{review.productTitle}</strong>
            <span style={{ color: "#666", fontSize: 13 }}>
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div style={{ margin: "6px 0" }}>
            {"★".repeat(review.rating)}
            {"☆".repeat(5 - review.rating)}
            {review.verified && (
              <span style={{ marginLeft: 8, fontSize: 12, color: "#0a0" }}>
                ✓ Verified buyer
              </span>
            )}
          </div>
          <p style={{ margin: "8px 0" }}>{review.body}</p>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
            — {review.customerName}
          </div>

          {!review.approved ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleAction(review.productId, review.id, "approve")}
                style={{
                  padding: "6px 14px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Approve
              </button>
              <button
                onClick={() => handleAction(review.productId, review.id, "reject")}
                style={{
                  padding: "6px 14px",
                  background: "#fff",
                  color: "#000",
                  border: "1px solid #000",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "#0a0" }}>✓ Approved — live on product page</span>
          )}

          {review.reply ? (
            <div style={{ marginTop: 12, padding: 12, background: "#f6f6f6", borderRadius: 8, borderLeft: "3px solid #000" }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4, fontWeight: 600 }}>Your reply</div>
              <div style={{ fontSize: 14 }}>{review.reply}</div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <textarea
                placeholder="Write a reply to this customer..."
                value={replyDrafts[review.id] || ""}
                onChange={(e) => setReplyDrafts({ ...replyDrafts, [review.id]: e.target.value })}
                rows={2}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6, fontFamily: "inherit", fontSize: 13, boxSizing: "border-box" as const }}
              />
              <button
                onClick={() => handleReply(review.productId, review.id)}
                disabled={!replyDrafts[review.id]}
                style={{
                  marginTop: 6,
                  padding: "5px 12px",
                  background: "#fff",
                  color: "#000",
                  border: "1px solid #000",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Post reply
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}