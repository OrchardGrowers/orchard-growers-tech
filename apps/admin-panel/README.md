# Orchard Growers Admin Panel

This static admin panel lists Get Verified requests submitted from the main app.

Host this folder on the admin subdomain, for example:

```text
https://admin.efruitmandi.live
```

By default it calls the API at the same root domain without the `admin.` prefix:

```text
https://efruitmandi.live/api
```

## Admin roles

- Admin1: `SUPER_ADMIN`. Uses master login credentials assigned by the developer team through backend environment variables.
- Admin2: `ADMIN`. Can cross-check and manage users, growers, buyers, logistics profiles, and verification requests.
- Admin3: `EMPLOYEE`. Can cross-check and manage users, growers, buyers, logistics profiles, and verification requests.

Set these backend environment variables for the master login:

```text
MASTER_ADMIN_EMAIL=admin1@efruitmandi.live
MASTER_ADMIN_PASSWORD=change-this-password
```

Admin1 can create, terminate, restore, and delete Admin2/Admin3 accounts from the admin panel.

## Local testing

Run the services locally:

```text
Backend API: http://localhost:5000
Main frontend: http://localhost:3000
Admin panel: http://localhost:4173
```

For local Admin1 login, add the master credentials to `backend/.env`, restart the backend, then open `http://localhost:4173`:

```text
MASTER_ADMIN_EMAIL=admin1@efruitmandi.live
MASTER_ADMIN_PASSWORD=your-developer-team-password
```

The local admin panel automatically calls:

```text
http://localhost:5000/api
```

To override the API URL, set this before the script loads:

```html
<script>
  window.API_BASE_URL = "https://your-api-domain.com/api";
</script>
```
