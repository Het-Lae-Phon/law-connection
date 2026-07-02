-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GazetteEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "volume" INTEGER NOT NULL,
    "issue" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'gazette',
    "pdfUrl" TEXT NOT NULL,
    "instrumentType" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAmendment" BOOLEAN NOT NULL DEFAULT false,
    "actId" INTEGER,
    "linkSource" TEXT,
    "verifyStatus" TEXT NOT NULL DEFAULT 'machine',
    CONSTRAINT "GazetteEntry_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GazetteEntry" ("actId", "category", "id", "instrumentType", "isAmendment", "isPrimary", "issue", "linkSource", "page", "pdfUrl", "publishedAt", "title", "verifyStatus", "volume") SELECT "actId", "category", "id", "instrumentType", "isAmendment", "isPrimary", "issue", "linkSource", "page", "pdfUrl", "publishedAt", "title", "verifyStatus", "volume" FROM "GazetteEntry";
DROP TABLE "GazetteEntry";
ALTER TABLE "new_GazetteEntry" RENAME TO "GazetteEntry";
CREATE UNIQUE INDEX "GazetteEntry_pdfUrl_key" ON "GazetteEntry"("pdfUrl");
CREATE INDEX "GazetteEntry_actId_idx" ON "GazetteEntry"("actId");
CREATE INDEX "GazetteEntry_instrumentType_idx" ON "GazetteEntry"("instrumentType");
CREATE INDEX "GazetteEntry_publishedAt_idx" ON "GazetteEntry"("publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
