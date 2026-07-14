import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let settings = await db.settings.findUnique({ where: { shop: session.shop } });

  if (!settings) {
    settings = await db.settings.create({ data: { shop: session.shop } });
  }

  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const delayDays = Number(formData.get("delayDays"));
  const emailSubject = String(formData.get("emailSubject"));
  const emailBody = String(formData.get("emailBody"));
  const logoSize = Number(formData.get("logoSize")) || 50;
  const logoUrl = String(formData.get("logoUrl") || "");
  const headerColor = String(formData.get("headerColor"));
  const textColor = String(formData.get("textColor"));
  const customCss = String(formData.get("customCss") || "");

  await db.settings.upsert({
    where: { shop: session.shop },
    update: { delayDays, emailSubject, emailBody, logoUrl, logoSize, headerColor, textColor, customCss },
    create: { shop: session.shop, delayDays, emailSubject, emailBody, logoUrl, logoSize, headerColor, textColor, customCss },
  });

  return { success: true };
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [delayDays, setDelayDays] = useState(settings.delayDays);
  const [emailSubject, setEmailSubject] = useState(settings.emailSubject);
  const [emailBody, setEmailBody] = useState(settings.emailBody);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");
  const [headerColor, setHeaderColor] = useState(settings.headerColor);
  const [textColor, setTextColor] = useState(settings.textColor);
  const [customCss, setCustomCss] = useState(settings.customCss || "");
  const [logoSize, setLogoSize] = useState(settings.logoSize || 50);

  const handleSave = () => {
    fetcher.submit(
      { delayDays: String(delayDays), emailSubject, emailBody, logoUrl, logoSize: String(logoSize), headerColor, textColor, customCss },
      { method: "post" }
    );
  };

  const sectionCard: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #ececec",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    padding: 24,
    marginBottom: 20,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 8,
    fontWeight: 600,
    fontSize: 14,
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    width: "100%",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 14,
    boxSizing: "border-box",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 4, fontSize: 26 }}>Settings</h1>
      <p style={{ color: "#777", marginBottom: 28 }}>Configure timing, email content, and branding.</p>

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Timing</h3>
        <label style={labelStyle}>Send review request after (days)</label>
        <input
          type="number"
          min={1}
          value={delayDays}
          onChange={(e) => setDelayDays(Number(e.target.value))}
          style={{ ...inputStyle, width: 120 }}
        />
      </div>

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Email content</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Subject line</label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            style={inputStyle}
          />
          <div style={hintStyle}>Use {"{product}"} to insert the product name</div>
        </div>

        <div>
          <label style={labelStyle}>Email body</label>
          <textarea
            rows={5}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            style={{ ...inputStyle, resize: "vertical" as const }}
          />
          <div style={hintStyle}>Use {"{name}"}, {"{order}"}, {"{product}"} as placeholders</div>
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Review Page Branding</h3>
        <div style={{ ...hintStyle, marginBottom: 16 }}>
          This controls how your customer's review page looks — not the email itself.
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Logo URL</label>
          <input
            type="text"
            placeholder="https://yourstore.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            style={inputStyle}
          />
          <div style={hintStyle}>Paste a hosted image link (e.g. from your Shopify product images)</div>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo preview"
              style={{ marginTop: 10, maxHeight: 50, borderRadius: 4 }}
            />
          )}
          {logoUrl && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Logo size ({logoSize}px)</label>
              <input
                type="range"
                min={20}
                max={150}
                value={logoSize}
                onChange={(e) => setLogoSize(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
          <div>
            <label style={labelStyle}>Header color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={headerColor}
                onChange={(e) => setHeaderColor(e.target.value)}
                style={{ width: 44, height: 36, border: "1px solid #ddd", borderRadius: 6, padding: 0, cursor: "pointer" }}
              />
              <input
                type="text"
                value={headerColor}
                onChange={(e) => setHeaderColor(e.target.value)}
                style={{ ...inputStyle, width: 100 }}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Text color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ width: 44, height: 36, border: "1px solid #ddd", borderRadius: 6, padding: 0, cursor: "pointer" }}
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ ...inputStyle, width: 100 }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 8,
            background: headerColor,
            color: textColor,
            fontSize: 14,
          }}
        >
          Preview: this is how your review page header will look.
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Email preview</h3>
        <div style={{ ...hintStyle, marginBottom: 16 }}>
          This is roughly how your review request email will look, using sample data.
        </div>

        <div style={{ background: "#f6f6f7", borderRadius: 10, padding: 24 }}>
          <div style={{ maxWidth: 400, margin: "0 auto", background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #ececec" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f0f0f0" }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" style={{ maxHeight: logoSize }} />
              ) : (
                <div style={{ fontWeight: 700, color: "#111" }}>Your Store</div>
              )}
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>Subject</div>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
                {emailSubject.replace("{product}", "Sample Snowboard")}
              </div>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 20px" }}>
                {emailBody
                  .replace("{name}", "Priya")
                  .replace("{order}", "1042")
                  .replace("{product}", "Sample Snowboard")}
              </p>
              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "10px 26px",
                    background: headerColor,
                    color: "#fff",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Leave a Review
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Custom CSS</h3>
        <div style={{ ...hintStyle, marginBottom: 12 }}>
          Advanced — add your own CSS to further customize the review submission page.
        </div>
        <textarea
          rows={6}
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          placeholder=".simple-reviews-widget { font-family: Georgia, serif; }"
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, resize: "vertical" as const }}
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          padding: "12px 28px",
          background: "#000",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        Save settings
      </button>

      {fetcher.data?.success && (
        <span style={{ marginLeft: 14, color: "#0a0", fontWeight: 600 }}>✓ Saved</span>
      )}
    </div>
  );
}