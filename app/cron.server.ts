import cron from "node-cron";
import db from "./db.server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

let started = false;

export function startCron() {
  if (started) return;
  started = true;

  // Runs every hour, on the hour
  cron.schedule("0 * * * *", async () => {
    console.log("[cron] Checking for due review emails...");

    try {
      const dueRequests = await db.reviewRequest.findMany({
        where: { sent: false, sendAfter: { lte: new Date() } },
      });

      console.log(`[cron] Found ${dueRequests.length} due.`);

      for (const req of dueRequests) {
        try {
          const settings = await db.settings.findUnique({ where: { shop: req.shop } });

          const subjectTemplate = settings?.emailSubject || "How was your {product}?";
          const bodyTemplate =
            settings?.emailBody ||
            "Hi {name}, thanks for your recent order #{order}! We'd love to hear what you think of your {product}. Would you leave a quick review?";

          const reviewUrl = `${process.env.SHOPIFY_APP_URL}/review/${req.reviewToken}`;

          const subject = subjectTemplate.replace("{product}", req.productName);
          const bodyText = bodyTemplate
            .replace("{name}", req.customerName)
            .replace("{order}", req.orderNumber)
            .replace("{product}", req.productName);

          const logoHtml = settings?.logoUrl
            ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height:${settings.logoSize || 50}px;" />`
            : `<div style="font-size:18px;font-weight:700;color:#111;">${req.shop.split(".")[0]}</div>`;
          const btnColor = settings?.headerColor || "#000000";

          const emailHtml = `
          <div style="background:#f6f6f7; padding: 40px 16px; font-family: -apple-system, Helvetica, Arial, sans-serif;">
            <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #ececec;">
              <div style="padding: 28px 32px; border-bottom: 1px solid #f0f0f0;">${logoHtml}</div>
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">How was your order?</h2>
                <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">${bodyText}</p>
                <div style="background: #fafafa; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px;">
                  <div style="font-size: 13px; color: #999; margin-bottom: 4px;">Product</div>
                  <div style="font-size: 15px; font-weight: 600; color: #111;">${req.productName}</div>
                </div>
                <div style="text-align: center;">
                  <a href="${reviewUrl}" style="display: inline-block; padding: 14px 36px; background: ${btnColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Leave a Review</a>
                </div>
              </div>
              <div style="padding: 20px 32px; background: #fafafa; border-top: 1px solid #f0f0f0; text-align: center;">
                <p style="font-size: 12px; color: #999; margin: 0;">Order #${req.orderNumber} · You're receiving this because you recently made a purchase.</p>
              </div>
            </div>
          </div>`;

          await resend.emails.send({
            from: "Simple Reviews <onboarding@resend.dev>",
            to: req.customerEmail,
            subject,
            html: emailHtml,
          });

          await db.reviewRequest.update({
            where: { id: req.id },
            data: { sent: true },
          });

          console.log(`[cron] Sent for order ${req.orderNumber}`);
        } catch (err) {
          console.error(`[cron] Failed for order ${req.orderNumber}:`, err);
        }
      }
    } catch (err) {
      console.error("[cron] Error:", err);
    }
  });

  console.log("[cron] Scheduler started — checking hourly.");
}