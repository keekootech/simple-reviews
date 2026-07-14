-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 7,
    "emailSubject" TEXT NOT NULL DEFAULT 'How was your {product}?',
    "emailBody" TEXT NOT NULL DEFAULT 'Hi {name}, thanks for your recent order #{order}! We''d love to hear what you think of your {product}. Would you leave a quick review?',
    "logoUrl" TEXT,
    "logoSize" INTEGER NOT NULL DEFAULT 50,
    "headerColor" TEXT NOT NULL DEFAULT '#000000',
    "textColor" TEXT NOT NULL DEFAULT '#333333',
    "customCss" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("customCss", "delayDays", "emailBody", "emailSubject", "headerColor", "id", "logoUrl", "shop", "textColor", "updatedAt") SELECT "customCss", "delayDays", "emailBody", "emailSubject", "headerColor", "id", "logoUrl", "shop", "textColor", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
