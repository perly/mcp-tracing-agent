-- CreateIndex
CREATE UNIQUE INDEX "Event_traceId_service_timestamp_rawLine_key" ON "Event"("traceId", "service", "timestamp", "rawLine");
