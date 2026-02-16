# Deployment Guide: Auth & Tracking

## 1. Environment Variables

Required:
- `MONGO_URL_SCRAPPING`
- `MONGO_DBNAME_SCRAPPING`

Strongly recommended:
- `AUTH_SECRET`
- `SUPER_ADMIN_USERNAME` (default `admin000`)
- `SUPER_ADMIN_PASSWORD` (default `admin000`)
- `REDIS_URL` (optional, enables Redis cache for active session reads)

Optional tuning:
- `SESSION_TIMEOUT_MINUTES` (default: `30`)
- `GUEST_ATTEMPT_LIMIT_DEFAULT` (default: `5`)
- `REGISTRATION_REQUIRED_DEFAULT` (default: `true`)
- `DATA_RETENTION_DAYS_DEFAULT` (default: `180`)
- `TRACKING_ENABLED_DEFAULT` (default: `true`)
- `REMEMBER_ME_DAYS` (default: `30`)

## 2. Run Migration

```bash
npm run migrate:auth-tracking
```

This creates indexes, seeds admin config, and creates super admin if missing.

## 3. Validate Build

```bash
npm run typecheck
npm run test:auth-tracking
```

## 4. Start App

```bash
npm run build
npm run start
```

## 5. First Login

- Username: `admin000` (or `SUPER_ADMIN_USERNAME`)
- Password: `SUPER_ADMIN_PASSWORD` (default fallback is `admin000`)

Immediately rotate the super admin password in production.

## 6. Post-Deploy Checklist

- Verify `/api/auth/me` returns session snapshot.
- Verify guest attempt decrement from evaluation endpoints.
- Verify registration unlocks continued access.
- Verify `/admin` dashboard loads analytics and user/activity tables.
- Verify config updates apply and persist.
- Verify CSV/Excel/PDF activity exports.
- Verify HTTPS and secure cookies in production environment.

