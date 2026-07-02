-- CreateTable
CREATE TABLE "Contribution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "entryId" INTEGER,
    "actId" INTEGER,
    "payload" TEXT,
    "comment" TEXT,
    "contributor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "Contribution_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GazetteEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contribution_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GazetteEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "volume" INTEGER NOT NULL,
    "issue" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "instrumentType" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAmendment" BOOLEAN NOT NULL DEFAULT false,
    "actId" INTEGER,
    "linkSource" TEXT,
    "verifyStatus" TEXT NOT NULL DEFAULT 'machine',
    CONSTRAINT "GazetteEntry_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GazetteEntry" ("actId", "category", "id", "instrumentType", "isAmendment", "isPrimary", "issue", "page", "pdfUrl", "publishedAt", "title", "volume") SELECT "actId", "category", "id", "instrumentType", "isAmendment", "isPrimary", "issue", "page", "pdfUrl", "publishedAt", "title", "volume" FROM "GazetteEntry";
DROP TABLE "GazetteEntry";
ALTER TABLE "new_GazetteEntry" RENAME TO "GazetteEntry";
CREATE UNIQUE INDEX "GazetteEntry_pdfUrl_key" ON "GazetteEntry"("pdfUrl");
CREATE INDEX "GazetteEntry_actId_idx" ON "GazetteEntry"("actId");
CREATE INDEX "GazetteEntry_instrumentType_idx" ON "GazetteEntry"("instrumentType");
CREATE INDEX "GazetteEntry_publishedAt_idx" ON "GazetteEntry"("publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Contribution_status_idx" ON "Contribution"("status");

-- CreateIndex
CREATE INDEX "Contribution_entryId_idx" ON "Contribution"("entryId");

-- CreateIndex
CREATE INDEX "Contribution_actId_idx" ON "Contribution"("actId");
