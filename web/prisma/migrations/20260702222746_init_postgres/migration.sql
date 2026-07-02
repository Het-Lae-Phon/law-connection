-- CreateTable
CREATE TABLE "Act" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "actType" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "year" INTEGER,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "Act_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" SERIAL NOT NULL,
    "actId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT,
    "contributor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GazetteEntry" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "volume" INTEGER NOT NULL,
    "issue" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'gazette',
    "pdfUrl" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "instrumentType" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAmendment" BOOLEAN NOT NULL DEFAULT false,
    "actId" INTEGER,
    "linkSource" TEXT,
    "verifyStatus" TEXT NOT NULL DEFAULT 'machine',

    CONSTRAINT "GazetteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentText" (
    "entryId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "DocumentText_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "entryId" INTEGER,
    "actId" INTEGER,
    "payload" TEXT,
    "comment" TEXT,
    "contributor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Act_slug_key" ON "Act"("slug");

-- CreateIndex
CREATE INDEX "Act_shortName_idx" ON "Act"("shortName");

-- CreateIndex
CREATE INDEX "Source_actId_idx" ON "Source"("actId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_actId_url_key" ON "Source"("actId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "GazetteEntry_pdfUrl_key" ON "GazetteEntry"("pdfUrl");

-- CreateIndex
CREATE INDEX "GazetteEntry_actId_idx" ON "GazetteEntry"("actId");

-- CreateIndex
CREATE INDEX "GazetteEntry_instrumentType_idx" ON "GazetteEntry"("instrumentType");

-- CreateIndex
CREATE INDEX "GazetteEntry_publishedAt_idx" ON "GazetteEntry"("publishedAt");

-- CreateIndex
CREATE INDEX "Contribution_status_idx" ON "Contribution"("status");

-- CreateIndex
CREATE INDEX "Contribution_entryId_idx" ON "Contribution"("entryId");

-- CreateIndex
CREATE INDEX "Contribution_actId_idx" ON "Contribution"("actId");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GazetteEntry" ADD CONSTRAINT "GazetteEntry_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentText" ADD CONSTRAINT "DocumentText_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GazetteEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GazetteEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act"("id") ON DELETE SET NULL ON UPDATE CASCADE;
