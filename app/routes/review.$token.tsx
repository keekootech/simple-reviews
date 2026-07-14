import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const reviewRequest = await db.reviewRequest.findUnique({
    where: { reviewToken: params.token },
  });

  if (!reviewRequest) {
    throw new Response("Review link not found", { status: 404 });
  }

  const settings = await db.settings.findUnique({ where: { shop: reviewRequest.shop } });

  return { reviewRequest, settings };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") || "");

  const reviewRequest = await db.reviewRequest.findUnique({
    where: { reviewToken: params.token },
  });

  if (!reviewRequest) {
    throw new Response("Not found", { status: 404 });
  }

const { admin } = await unauthenticated.admin(reviewRequest.shop);

  // Find the product ID from the order's line items via the order
  const orderResponse = await admin.graphql(
    `#graphql
    query getOrder($id: ID!) {
      order(id: $id) {
        lineItems(first: 1) {
          nodes {
            product {
              id
            }
          }
        }
      }
    }`,
    { variables: { id: `gid://shopify/Order/${reviewRequest.orderId}` } }
  );

  const orderData = await orderResponse.json();
  const productId = orderData.data?.order?.lineItems?.nodes?.[0]?.product?.id;

  if (productId) {
    const newReview = {
      id: reviewRequest.id,
      orderId: reviewRequest.orderId,
      customerName: reviewRequest.customerName,
      rating,
      body,
      verified: true,
      approved: false,
      createdAt: new Date().toISOString(),
      reply: "",
    };

    // Get existing reviews on this product, append new one
    const existingResponse = await admin.graphql(
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

    const existingData = await existingResponse.json();
    const existingReviews = existingData.data?.product?.metafield?.value
      ? JSON.parse(existingData.data.product.metafield.value)
      : [];

    existingReviews.push(newReview);

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
            value: JSON.stringify(existingReviews),
          },
        },
      }
    );

    console.log("Review saved to product metafield:", newReview);
  }

  return { success: true };
  };

export default function ReviewPage() {
  const { reviewRequest, settings } = useLoaderData<typeof loader>();
  const headerColor = settings?.headerColor || "#000";
  const textColor = settings?.textColor || "#333";
  const fetcher = useFetcher<typeof action>();
  const [rating, setRating] = useState(0);

  if (fetcher.data?.success) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Thank you! 🙏</h2>
        <p>Your review has been submitted.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: 24, fontFamily: "sans-serif", color: textColor }}>
      {settings?.customCss && <style>{settings.customCss}</style>}
      {settings?.logoUrl && (
        <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: settings.logoSize || 50, marginBottom: 20 }} />
      )}
      <h2 style={{ color: headerColor }}>How was your {reviewRequest.productName}?</h2>
      <p>Hi {reviewRequest.customerName}, tell us what you think.</p>

      <fetcher.Form method="post">
        <div style={{ fontSize: 32, margin: "16px 0" }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              onClick={() => setRating(star)}
              style={{ cursor: "pointer", color: star <= rating ? "#000" : "#ddd" }}
            >
              ★
            </span>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />

        <textarea
          name="body"
          placeholder="Write your review..."
          rows={5}
          style={{ width: "100%", padding: 8, fontFamily: "inherit" }}
        />

        <button
          type="submit"
          disabled={rating === 0}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            background: headerColor,
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Submit Review
        </button>
      </fetcher.Form>
    </div>
  );
}