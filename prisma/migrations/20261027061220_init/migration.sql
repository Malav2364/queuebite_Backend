-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('STAFF', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('WAITING', 'CALLED', 'SEATED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('BUDGET', 'MODERATE', 'EXPENSIVE', 'FINE_DINING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxWaitMinutes" INTEGER,
    "preferredPartySize" INTEGER DEFAULT 2,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCuisinePreference" (
    "id" TEXT NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,

    CONSTRAINT "UserCuisinePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDietaryPreference" (
    "id" TEXT NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "UserDietaryPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuisine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cuisine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "priceRange" "PriceRange" NOT NULL DEFAULT 'MODERATE',
    "coverImageUrl" TEXT,
    "logoUrl" TEXT,
    "isQueueOpen" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantLocation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RestaurantLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOperatingSettings" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "minPartySize" INTEGER NOT NULL DEFAULT 1,
    "maxPartySize" INTEGER NOT NULL DEFAULT 12,
    "estimatedMinutesPerParty" INTEGER NOT NULL DEFAULT 15,
    "callTimeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "maxActiveQueueEntries" INTEGER NOT NULL DEFAULT 50,
    "autoCallNextParty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RestaurantOperatingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantHours" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RestaurantHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantCuisine" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,

    CONSTRAINT "RestaurantCuisine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantPhoto" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantStaffMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantStaffMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isSpicy" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "minCapacity" INTEGER NOT NULL DEFAULT 1,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'WAITING',
    "queueNumber" INTEGER NOT NULL,
    "estimatedWaitMinutes" INTEGER,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "seatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "noShowAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEvent" (
    "id" TEXT NOT NULL,
    "queueEntryId" TEXT NOT NULL,
    "fromStatus" "QueueEntryStatus",
    "toStatus" "QueueEntryStatus" NOT NULL,
    "triggeredBy" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAssignment" (
    "id" TEXT NOT NULL,
    "queueEntryId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freedAt" TIMESTAMP(3),

    CONSTRAINT "TableAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedRestaurant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCuisinePreference_preferenceId_cuisineId_key" ON "UserCuisinePreference"("preferenceId", "cuisineId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDietaryPreference_preferenceId_tag_key" ON "UserDietaryPreference"("preferenceId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "Cuisine_name_key" ON "Cuisine"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Cuisine_slug_key" ON "Cuisine"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_name_idx" ON "Restaurant"("name");

-- CreateIndex
CREATE INDEX "Restaurant_isQueueOpen_idx" ON "Restaurant"("isQueueOpen");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantLocation_restaurantId_key" ON "RestaurantLocation"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantLocation_latitude_longitude_idx" ON "RestaurantLocation"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "RestaurantLocation_city_idx" ON "RestaurantLocation"("city");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOperatingSettings_restaurantId_key" ON "RestaurantOperatingSettings"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantHours_restaurantId_dayOfWeek_key" ON "RestaurantHours"("restaurantId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantCuisine_restaurantId_cuisineId_key" ON "RestaurantCuisine"("restaurantId", "cuisineId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantStaffMembership_userId_restaurantId_key" ON "RestaurantStaffMembership"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantTable_restaurantId_status_idx" ON "RestaurantTable"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_restaurantId_tableNumber_key" ON "RestaurantTable"("restaurantId", "tableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_idempotencyKey_key" ON "QueueEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "QueueEntry_restaurantId_status_idx" ON "QueueEntry"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_userId_status_idx" ON "QueueEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_restaurantId_joinedAt_idx" ON "QueueEntry"("restaurantId", "joinedAt");

-- CreateIndex
CREATE INDEX "QueueEvent_queueEntryId_createdAt_idx" ON "QueueEvent"("queueEntryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TableAssignment_queueEntryId_key" ON "TableAssignment"("queueEntryId");

-- CreateIndex
CREATE INDEX "TableAssignment_tableId_idx" ON "TableAssignment"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedRestaurant_userId_restaurantId_key" ON "SavedRestaurant"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCuisinePreference" ADD CONSTRAINT "UserCuisinePreference_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "UserPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCuisinePreference" ADD CONSTRAINT "UserCuisinePreference_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDietaryPreference" ADD CONSTRAINT "UserDietaryPreference_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "UserPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantLocation" ADD CONSTRAINT "RestaurantLocation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOperatingSettings" ADD CONSTRAINT "RestaurantOperatingSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantHours" ADD CONSTRAINT "RestaurantHours_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantCuisine" ADD CONSTRAINT "RestaurantCuisine_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantCuisine" ADD CONSTRAINT "RestaurantCuisine_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPhoto" ADD CONSTRAINT "RestaurantPhoto_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantStaffMembership" ADD CONSTRAINT "RestaurantStaffMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantStaffMembership" ADD CONSTRAINT "RestaurantStaffMembership_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRestaurant" ADD CONSTRAINT "SavedRestaurant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRestaurant" ADD CONSTRAINT "SavedRestaurant_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
