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

  const stat = (value: string | number, label: string) => (
    <s-box padding="large" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="small-500">
        <s-text type="strong">{String(value)}</s-text>
        <s-text color="subdued">{label}</s-text>
      </s-stack>
    </s-box>
  );

  return (
    <s-page heading="Simple Reviews">
      <s-section heading="Overview">
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          {stat(totalReviews, "Total reviews")}
          {stat(`${averageRating} ★`, "Average rating")}
          {stat(pendingCount, "Pending approval")}
          {stat(emailsSentThisMonth, "Emails sent this month")}
          {stat(emailsScheduled, "Emails scheduled")}
        </s-grid>
      </s-section>

      <s-section heading="Upcoming review emails">
        {upcomingEmails.length === 0 ? (
          <s-text color="subdued">Nothing scheduled right now.</s-text>
        ) : (
          <s-stack direction="block" gap="none">
            {upcomingEmails.map((req) => (
              <s-box key={req.id} paddingBlock="base" borderBlockEnd="base">
                <s-grid gridTemplateColumns="2fr 1fr auto" gap="base" alignItems="center">
                  <s-stack direction="block" gap="small-500">
                    <s-text type="strong">{req.customerName}</s-text>
                    <s-text color="subdued">{req.customerEmail}</s-text>
                  </s-stack>
                  <s-stack direction="block" gap="small-500">
                    <s-text>{req.productName}</s-text>
                    <s-text color="subdued">#{req.orderNumber} · {new Date(req.sendAfter).toLocaleDateString()}</s-text>
                    {justSent === req.id ? <s-badge tone="success">Queued</s-badge> : null}
                  </s-stack>
                  <s-stack direction="inline" gap="small">
                    <s-button onClick={() => handleSendNow(req.id)}>Send now</s-button>
                    <s-button tone="critical" onClick={() => handleCancel(req.id)}>Cancel</s-button>
                  </s-stack>
                </s-grid>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Recently sent emails">
        {recentSentEmails.length === 0 ? (
          <s-text color="subdued">No emails sent yet.</s-text>
        ) : (
          <s-stack direction="block" gap="none">
            {recentSentEmails.map((req) => (
              <s-box key={req.id} paddingBlock="base" borderBlockEnd="base">
                <s-grid gridTemplateColumns="2fr 1fr auto" gap="base" alignItems="center">
                  <s-stack direction="block" gap="small-500">
                    <s-text type="strong">{req.customerName}</s-text>
                    <s-text color="subdued">{req.customerEmail}</s-text>
                  </s-stack>
                  <s-text>{req.productName}</s-text>
                  <s-text color="subdued">{new Date(req.createdAt).toLocaleDateString()}</s-text>
                </s-grid>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}