-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VectorEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "doc_id" TEXT NOT NULL,
    "vector_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VectorEntry" ("created_at", "id") SELECT "created_at", "id" FROM "VectorEntry";
DROP TABLE "VectorEntry";
ALTER TABLE "new_VectorEntry" RENAME TO "VectorEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
