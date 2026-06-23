-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storyHandle" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgentClass" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ScanEvent_storyHandle_timestamp_idx" ON "ScanEvent"("storyHandle", "timestamp");

-- CreateIndex
CREATE INDEX "ScanEvent_shop_timestamp_idx" ON "ScanEvent"("shop", "timestamp");
