-- CreateTable
CREATE TABLE "MessageTemp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SessionTemp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL
);
