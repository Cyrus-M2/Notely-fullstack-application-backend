-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferences" JSONB DEFAULT '{}',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "shared_entries" (
    "id" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note_id" TEXT NOT NULL,
    "shared_by_id" TEXT NOT NULL,
    "shared_with_id" TEXT NOT NULL,

    CONSTRAINT "shared_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shared_entries" ADD CONSTRAINT "shared_entries_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_entries" ADD CONSTRAINT "shared_entries_shared_by_id_fkey" FOREIGN KEY ("shared_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_entries" ADD CONSTRAINT "shared_entries_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
