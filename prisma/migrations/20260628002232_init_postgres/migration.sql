-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSettings" (
    "shop" TEXT NOT NULL,
    "logoUrl" TEXT,
    "accentColor" TEXT,
    "fontFamily" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "headingColor" TEXT,
    "buttonBgColor" TEXT,
    "buttonTextColor" TEXT,
    "headingFontFamily" TEXT,
    "borderRadiusScale" TEXT,
    "buttonStyle" TEXT,
    "linkColor" TEXT,
    "borderColor" TEXT,
    "headingFontWeight" TEXT,
    "bodyFontWeight" TEXT,
    "typeScale" TEXT,
    "pageMaxWidth" TEXT,
    "sectionSpacing" TEXT,
    "customFontUrl" TEXT,
    "customCss" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSettings_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" SERIAL NOT NULL,
    "storyHandle" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgentClass" TEXT NOT NULL,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanEvent_storyHandle_timestamp_idx" ON "ScanEvent"("storyHandle", "timestamp");

-- CreateIndex
CREATE INDEX "ScanEvent_shop_timestamp_idx" ON "ScanEvent"("shop", "timestamp");
