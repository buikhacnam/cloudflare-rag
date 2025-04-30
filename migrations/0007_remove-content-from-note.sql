-- CreateTable
CREATE TABLE "VectorEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vectorId" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "metadata" JSONB
);
INSERT INTO "new_Note" ("id", "metadata", "title") SELECT "id", "metadata", "title" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
