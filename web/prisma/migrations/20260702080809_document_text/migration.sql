-- CreateTable
CREATE TABLE "DocumentText" (
    "entryId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    CONSTRAINT "DocumentText_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GazetteEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
