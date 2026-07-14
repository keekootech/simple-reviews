import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerEmail = payload.email || payload.customer?.email || payload.contact_email;
  const customerName = payload.customer?.first_name || "there";
  const orderNumber = String(payload.order_number || payload.name);
  const orderId = String(payload.id);
  const lineItems = payload.line_items || [];

  if (!customerEmail) {
    console.log("No customer email found on order, skipping.");
    return new Response();
  }

  if (lineItems.length === 0) {
    console.log("No line items found on order, skipping.");
    return new Response();
  }

  const settings = await db.settings.findUnique({ where: { shop } });
  const delayDays = settings?.delayDays ?? 7;
  const maxPerOrder = settings?.maxPerOrder ?? 3;

  const sendAfter = new Date();
  sendAfter.setDate(sendAfter.getDate() + delayDays);

  const itemsToProcess = lineItems.slice(0, maxPerOrder);

  for (const item of itemsToProcess) {
    const productName = item.title || "your order";

    await db.reviewRequest.create({
      data: {
        shop,
        orderId,
        orderNumber,
        customerEmail,
        customerName,
        productName,
        sendAfter,
      },
    });
  }

  console.log(`Scheduled ${itemsToProcess.length} review email(s) for order ${orderNumber} (order had ${lineItems.length} item(s)) to send after ${sendAfter}`);

  return new Response();
};