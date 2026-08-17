-- CreateTable
CREATE TABLE "KnownPerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "photoUrl" TEXT,
    "notes" TEXT,
    "faceDescriptor" TEXT,
    "lastRecognized" DATETIME,
    "recognitionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT NOT NULL DEFAULT '{}',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userName" TEXT NOT NULL,
    "profileName" TEXT NOT NULL DEFAULT 'default',
    "fontSize" TEXT NOT NULL DEFAULT 'normal',
    "contrast" TEXT NOT NULL DEFAULT 'normal',
    "cursorSize" TEXT NOT NULL DEFAULT 'normal',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "gestureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "customSettings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "signLanguageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pathGuidanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alzheimerPhase" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'user',
    "voiceLocale" TEXT NOT NULL DEFAULT 'en-US'
);
INSERT INTO "new_UserProfile" ("contrast", "createdAt", "cursorSize", "customSettings", "fontSize", "gestureEnabled", "id", "profileName", "theme", "updatedAt", "userName", "voiceEnabled") SELECT "contrast", "createdAt", "cursorSize", "customSettings", "fontSize", "gestureEnabled", "id", "profileName", "theme", "updatedAt", "userName", "voiceEnabled" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_userName_key" ON "UserProfile"("userName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
