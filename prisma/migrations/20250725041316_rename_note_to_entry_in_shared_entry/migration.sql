/*
  Warnings:

  - You are about to drop the column `note_id` on the `shared_entries` table. All the data in the column will be lost.
  - Added the required column `entry_id` to the `shared_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "shared_entries" DROP CONSTRAINT "shared_entries_note_id_fkey";

-- AlterTable
ALTER TABLE "shared_entries" DROP COLUMN "note_id",
ADD COLUMN     "entry_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "shared_entries" ADD CONSTRAINT "shared_entries_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
