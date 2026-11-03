/*
  Warnings:

  - A unique constraint covering the columns `[agentId,url]` on the table `WebhookSubscription` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Bug_description_trgm_idx";

-- DropIndex
DROP INDEX "Bug_title_trgm_idx";

-- DropIndex
DROP INDEX "Idea_title_trgm_idx";

-- CreateIndex
CREATE UNIQUE INDEX "WebhookSubscription_agentId_url_key" ON "WebhookSubscription"("agentId", "url");
