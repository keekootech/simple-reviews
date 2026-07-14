/*
  Warnings:

  - The required column `reviewToken` was added to the `ReviewRequest` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sendAfter" DATETIME NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "reviewToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ReviewRequest" ("createdAt", "customerEmail", "customerName", "id", "orderId", "orderNumber", "productName", "sendAfter", "sent", "shop") SELECT "createdAt", "customerEmail", "customerName", "id", "orderId", "orderNumber", "productName", "sendAfter", "sent", "shop" FROM "ReviewRequest";
DROP TABLE "ReviewRequest";
ALTER TABLE "new_ReviewRequest" RENAME TO "ReviewRequest";
CREATE UNIQUE INDEX "ReviewRequest_reviewToken_key" ON "ReviewRequest"("reviewToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
