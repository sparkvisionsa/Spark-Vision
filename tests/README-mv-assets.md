# Asset images and resumable uploads

Run `npm run test:mv-assets` in the frontend and `npm run test:asset-upload-resume` in the backend.

The frontend tests run the actual upload queue in Chromium with IndexedDB, a local HTTP fixture, reloads, account changes, and two tabs. They verify that completed files are not resent, the same token is reused after an unacknowledged save, folder receipts survive reload, and stored blobs are removed after completion. The backend test uses an isolated MongoDB instance and mocked object storage to verify concurrent retries against both supported image schemas. It does not access application data or DigitalOcean.

Deploy the backend changes together with (or before) the frontend: `uploadKeys` enable safe retries. Existing callers without upload keys keep their current behavior.

Files and the folder plan are committed to IndexedDB before sending. Navigation within the app leaves the queue running. Reloading resumes the remaining files for the same signed-in account and company; an interrupted file is retried in full with the same idempotency key. Closing the browser pauses transmission until the application opens again. Resume requires the same browser profile and origin with its site data intact. The preparation card remains visible until local persistence completes and guards reload during that brief step. Storage/quota failures are reported instead of starting a non-resumable upload.

Manual UI checks:

- Open an asset's parent folder in a fresh session: the cover and server image count appear without opening the asset.
- Inspect a regular folder containing assets with and without photos: both counts appear on its card; videos are excluded.
- Update an asset in another session: Socket.IO invalidation refreshes the cards and open asset table. An unfinished text edit is preserved.
- Upload a nested folder, switch workflow tabs, then reload: the global progress card remains or returns and completed images are not duplicated.
