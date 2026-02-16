# Spark Vision Auth & Tracking API

## Authentication

### `POST /api/auth/register`
- Body:
```json
{
  "username": "string",
  "password": "string",
  "email": "string (optional)",
  "phone": "string (optional)"
}
```
- Returns: `{ user, guestAccess }`

### `POST /api/auth/login`
- Body:
```json
{
  "username": "string",
  "password": "string",
  "rememberMe": true
}
```
- Returns: `{ user, profile, guestAccess }`

### `POST /api/auth/logout`
- Returns: `{ success: true }`

### `GET /api/auth/me`
- Returns active session snapshot:
```json
{
  "user": {},
  "profile": {},
  "guestAccess": {},
  "session": {},
  "config": {},
  "csrfToken": "..."
}
```

## Tracking

### `POST /api/track/session`
- Body:
```json
{
  "eventType": "start | heartbeat | end",
  "pageUrl": "https://...",
  "referrer": "https://...",
  "localBackupId": "string",
  "activeMs": 1000,
  "idleMs": 500,
  "durationMs": 5000,
  "fingerprint": {
    "canvas": "...",
    "webgl": "...",
    "audio": "...",
    "timezone": "...",
    "platform": "...",
    "language": "...",
    "screenResolution": "..."
  }
}
```
- Returns session snapshot + guest access + config.

### `POST /api/track/action`
- Body (single or batch):
```json
{
  "actions": [
    {
      "actionType": "search | export | button_click | ...",
      "actionDetails": {},
      "pageUrl": "https://...",
      "route": "/path",
      "timestamp": "2026-02-12T12:00:00.000Z"
    }
  ]
}
```
- Returns: `{ inserted, guestAccess }`

## User Profile

### `GET /api/user/profile`
- Auth required.
- Returns `{ user, profile }`

### `PATCH /api/user/profile`
- Auth + CSRF required (`x-csrf-token`).
- Body:
```json
{
  "email": "string | null",
  "phone": "string | null",
  "additionalInfo": {}
}
```

## Admin

All admin endpoints require a signed session for role `super_admin` and CSRF token for mutating methods.

### `GET /api/admin/users`
- Returns registered + guest entries with session/attempt metrics.

### `PATCH /api/admin/users`
- Body:
```json
{
  "action": "block | unblock | force_logout",
  "targetType": "user | identity",
  "targetId": "string",
  "reason": "optional"
}
```

### `GET /api/admin/analytics`
- Returns overview, engagement, conversion, geo/device/browser stats, peak usage, and feature usage.

### `GET /api/admin/config`
- Returns current system config.

### `PUT /api/admin/config`
- Body:
```json
{
  "guestAttemptLimit": 5,
  "registrationRequired": true,
  "sessionTimeoutMinutes": 30,
  "dataRetentionDays": 180,
  "enableTracking": true
}
```

### `GET /api/admin/activities`
- Query params:
  - `actionType`
  - `userIdentifier`
  - `dateFrom`
  - `dateTo`
  - `page`
  - `limit`
  - `format=json|csv|excel|pdf`

