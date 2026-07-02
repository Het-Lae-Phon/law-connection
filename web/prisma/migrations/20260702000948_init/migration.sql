-- CreateTable
CREATE TABLE "Act" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "actType" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "year" INTEGER,
    "fullName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "GazetteEntry" (
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
    CONSTRAINT "GazetteEntry_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Act_slug_key" ON "Act"("slug");

-- CreateIndex
CREATE INDEX "Act_shortName_idx" ON "Act"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "GazetteEntry_pdfUrl_key" ON "GazetteEntry"("pdfUrl");

-- CreateIndex
CREATE INDEX "GazetteEntry_actId_idx" ON "GazetteEntry"("actId");

-- CreateIndex
CREATE INDEX "GazetteEntry_instrumentType_idx" ON "GazetteEntry"("instrumentType");

-- CreateIndex
CREATE INDEX "GazetteEntry_publishedAt_idx" ON "GazetteEntry"("publishedAt");
