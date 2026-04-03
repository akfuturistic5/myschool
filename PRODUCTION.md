# Production setup (Render)

Use this checklist so the app works when you open the **production links**.

**Runtime API URL:** The frontend loads `public/config.json` in production. That file contains `apiUrl` pointing at your backend (e.g. `https://myschool-backend-myyn.onrender.com/api`). So login works even if you didn’t set `VITE_API_URL` at build time. If you use a different backend URL, edit `client/public/config.json` and redeploy the Static Site.

**CORS:** The backend restricts to CORS_ORIGIN in production (set frontend URL or only localhost is allowed), so you don’t need to set `CORS_ORIGIN` for login to work. You can still set it to restrict which sites can call your API.

---

## 1. Web Service (Backend) – Environment

In Render → your **Web Service** → **Environment**, set:

| Key | Value | Notes |
|-----|--------|--------|
| `DATABASE_URL` | *(Internal Database URL from Render Postgres)* | Required. Use the **Internal** URL. |
| `JWT_SECRET` | *(strong random string)* | Required. |
| `NODE_ENV` | `production` | Required. |
| `CORS_ORIGIN` | `https://my-school-dsps.onrender.com` | **ज़रूरी।** आपका Static Site URL (no trailing slash)। Set न करने पर production में सिर्फ localhost allow होगा और login/data fail होंगे। |

If you have more than one frontend URL, set:

`CORS_ORIGIN=https://site1.onrender.com,https://site2.onrender.com`

---

## 2. Static Site (Frontend) – Environment

In Render → your **Static Site** → **Environment**, set:

| Key | Value | Notes |
|-----|--------|--------|
| `VITE_API_URL` | `https://YOUR-WEB-SERVICE-URL.onrender.com/api` | Optional at build time. The app uses `public/config.json` in production for the API URL; set this if you want the build to use a different URL. |

Replace `YOUR-WEB-SERVICE-URL` with your actual Web Service host (e.g. `myschool-abc123` → `https://myschool-abc123.onrender.com/api`).

After changing env, run **Manual Deploy** on the Static Site (build must run again to pick up `VITE_API_URL`).

---

## 3. After changing env

- **Web Service:** Save → **Manual Deploy** (or wait for auto deploy).
- **Static Site:** Save → **Manual Deploy** (so the new build uses `VITE_API_URL`).

---

## 4. Quick test

1. Open your **Static Site** URL in the browser.
2. Log in (or sign up if applicable).
3. If you see CORS or “Failed to fetch” errors, check:
   - `client/public/config.json` has `apiUrl` set to your Web Service URL + `/api`, and you redeployed the Static Site after changing it.
   - Web Service में `CORS_ORIGIN=https://my-school-dsps.onrender.com` (या आपका frontend URL) set है और redeploy हो चुका है।
