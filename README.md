# Spark Vision Frontend

Standalone Next.js frontend for Spark Vision.

## Run

```bash
npm install
npm run dev
```

Default port: `3000` (fallback script uses `3001` or `3002` if occupied).

## Environment

Set `NEXT_PUBLIC_API_BASE_URL` to your backend origin (default `http://167.71.231.64:5000`).

All `/api/*` frontend calls are proxied to the backend through Next rewrites.

## Resumable machine valuation attachments

Asset uploads and all three report attachment tabs use a global IndexedDB outbox.
Images/PDFs and calculation Excel files are staged before processing; generated
pages and server receipts are checkpointed individually. Navigation does not
stop processing. Reloading or reopening the same browser profile resumes the
remaining work after signing in to the same account. Closing the browser pauses
conversion until reopening; clearing site storage removes unsubmitted files.
Wait for the initial preparation stage before refreshing.

The upload card remains visible across pages. Originals and converted pages are
retained locally until the backend confirms every image's project reference and
stored file. Originals above 25 MiB (or rejected by a proxy size limit) are not
retained on the server; their converted report images still upload normally.
Report export waits for pending attachment jobs, and checks for fresh attachments
before exporting. Failed jobs can be retried or their remaining files cancelled;
already saved images remain in the project.

Run `npm run test:mv-assets` and `npm run test:mv-attachments` for browser-based
reload, receipt, account-isolation, PDF conversion and multi-tab regression tests.

Asset cards listen for database change notifications. While the page is visible,
a small revision request every five seconds recovers missed notifications without
reloading unchanged cards. Direct changes to any `assets.images` category are
detected even if the image count and asset timestamp stay unchanged.
