# Render: Backend deploy (Node ya Docker)

**Create School** ab **pg_dump/psql** use nahi karta. Provisioning sirf `CREATE DATABASE ... TEMPLATE` se hota hai, isliye **Node** runtime se bhi kaam karega. Docker optional hai.

---

## Env vars (zaruri)

- `DATABASE_URL` → neondb (main app DB)
- `TENANT_ADMIN_DATABASE_URL` → neondb (same)
- `PROVISIONING_TEMPLATE_DB_NAME` → school_template
- `MASTER_DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, etc.

**Note:** `PROVISIONING_SOURCE_DATABASE_URL` ab zaruri nahi (pg_dump remove ho chuka hai).

---

## Option A: Node Web Service

1. **New +** → **Web Service** → repo connect → **Root Directory** = `server`
2. **Environment** = Node (default). Build: `npm install`, Start: `npm start`
3. Env vars add karo (above). Deploy.

---

## Option B: Docker Web Service

1. **New +** → **Web Service** → repo connect → **Root Directory** = `server`
2. **Environment** = Docker (Dockerfile detect hoga)
3. Env vars add karo. Deploy.

---

## Verify

Deploy ke baad **Create School** try karo. Agar "template is in use" aaye to ensure karo `DATABASE_URL`/`TENANT_ADMIN_DATABASE_URL` sirf **neondb** pe point karte hon, **school_template** pe nahi.
