import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // authenticate.webhook verifies the HMAC signature.
  // If it's invalid or missing, it throws a Response with 401 automatically.
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received compliance webhook: ${topic} for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // A customer asked the merchant for their data.
      // We store customer names/emails inside review data on Shopify metafields
      // and in our ReviewRequest table. There's nothing extra to compile here,
      // but we acknowledge the request.
      console.log("Customer data request acknowledged for", shop);
      break;

    case "CUSTOMERS_REDACT":
      // A customer asked to have their data deleted.
      // Remove any ReviewRequest rows tied to this customer's email.
      try {
        const email = (payload as any)?.customer?.email;
        if (email) {
          await db.reviewRequest.deleteMany({ where: { customerEmail: email } });
          console.log("Redacted review requests for customer", email);
        }
      } catch (err) {
        console.error("Error redacting customer:", err);
      }
      break;

    case "SHOP_REDACT":
      // 48h after uninstall — erase all data for this shop.
      try {
        await db.reviewRequest.deleteMany({ where: { shop } });
        await db.settings.deleteMany({ where: { shop } });
        console.log("Redacted all data for shop", shop);
      } catch (err) {
        console.error("Error redacting shop:", err);
      }
      break;

    default:
      console.log("Unhandled compliance topic:", topic);
  }

  return new Response();
};