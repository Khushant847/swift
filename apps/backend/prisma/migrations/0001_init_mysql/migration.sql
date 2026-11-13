-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(60) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'content_editor',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `mfaSecret` VARCHAR(64) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailOtp` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(100) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailOtp_adminId_consumed_expiresAt_idx`(`adminId`, `consumed`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NavigationLink` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `url` VARCHAR(300) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `location` VARCHAR(16) NOT NULL DEFAULT 'header',
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `NavigationLink_location_position_idx`(`location`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeroBanner` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NULL,
    `subtitle` VARCHAR(300) NULL,
    `ctaLabel` VARCHAR(60) NULL,
    `ctaUrl` VARCHAR(300) NULL,
    `mediaUrl` VARCHAR(512) NOT NULL,
    `mediaType` VARCHAR(16) NOT NULL DEFAULT 'image',
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `intervalSeconds` INTEGER NOT NULL DEFAULT 5000,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HeroBanner_displayOrder_idx`(`displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhyChooseUs` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` VARCHAR(600) NOT NULL,
    `icon` VARCHAR(60) NOT NULL DEFAULT 'BadgeCheck',
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `shortDesc` VARCHAR(300) NULL,
    `description` TEXT NOT NULL,
    `imageUrl` VARCHAR(512) NULL,
    `specs` TEXT NULL,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_category_idx`(`category`),
    INDEX `Product_isActive_createdAt_idx`(`isActive`, `createdAt`),
    INDEX `Product_isFeatured_isActive_idx`(`isFeatured`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyInfo` (
    `id` VARCHAR(191) NOT NULL,
    `keyName` VARCHAR(60) NOT NULL,
    `keyValue` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompanyInfo_keyName_key`(`keyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UpcomingProduct` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `teaserDesc` VARCHAR(1000) NOT NULL,
    `expectedLaunch` VARCHAR(80) NOT NULL DEFAULT 'Coming soon',
    `imageUrl` VARCHAR(512) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GalleryMedia` (
    `id` VARCHAR(191) NOT NULL,
    `mediaUrl` VARCHAR(512) NOT NULL,
    `mediaType` VARCHAR(16) NOT NULL DEFAULT 'image',
    `categoryTag` VARCHAR(60) NOT NULL DEFAULT 'Office',
    `caption` VARCHAR(200) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GalleryMedia_categoryTag_idx`(`categoryTag`),
    INDEX `GalleryMedia_uploadedAt_idx`(`uploadedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `authorName` VARCHAR(120) NOT NULL,
    `rating` INTEGER NOT NULL DEFAULT 5,
    `text` VARCHAR(2000) NOT NULL,
    `profilePhotoUrl` VARCHAR(512) NULL,
    `source` VARCHAR(16) NOT NULL DEFAULT 'manual',
    `googleReviewId` VARCHAR(191) NULL,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `reviewTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Review_googleReviewId_key`(`googleReviewId`),
    INDEX `Review_isHidden_isFeatured_reviewTime_idx`(`isHidden`, `isFeatured`, `reviewTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enquiry` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `companyName` VARCHAR(160) NULL,
    `subject` VARCHAR(200) NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'new',
    `notes` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Enquiry_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Enquiry_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Media` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `folder` VARCHAR(60) NOT NULL DEFAULT 'general',
    `tags` VARCHAR(300) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Media_folder_idx`(`folder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` VARCHAR(191) NOT NULL,
    `keyName` VARCHAR(60) NOT NULL,
    `keyValue` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Setting_keyName_key`(`keyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `adminEmail` VARCHAR(191) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `entity` VARCHAR(40) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_idx`(`entity`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

