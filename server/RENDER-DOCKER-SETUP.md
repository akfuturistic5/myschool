# Render: Backend deploy (Node ya Docker)

**Create School** ab **pg_dump/psql** use nahi karta. Provisioning sirf `CREATE DATABASE ... TEMPLATE` se hota hai, isliye **Node** runtime se bhi kaam karega. Docker optional hai.

---

## Env vars (zaruri)

- `DATABASE_URL` → neondb (main app DB)
- `TENANT_ADMIN_DATABASE_URL` → neondb (same)
- `PROVISIONING_TEMPLATE_DB_NAME` → school_template
- `MASTER_DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, etc.
- `SCHOOL_LOGO_STORAGE_ROOT` → persistent disk path, e.g. `/var/data/myschool/school-logos`

**Note:** `PROVISIONING_SOURCE_DATABASE_URL` ab zaruri nahi (pg_dump remove ho chuka hai).

---

## Option A: Node Web Service

1. **New +** → **Web Service** → repo connect → **Root Directory** = `server`
2. **Environment** = Node (default). Build: `npm install`, Start: `npm start`
3. Persistent Disk attach karo:
   - Name: `myschool-uploads`
   - Mount Path: `/var/data`
   - Size: `1 GB` ya needed size
4. Env vars add karo (above), especially `SCHOOL_LOGO_STORAGE_ROOT=/var/data/myschool/school-logos`. Deploy.

---

## Option B: Docker Web Service

1. **New +** → **Web Service** → repo connect → **Root Directory** = `server`
2. **Environment** = Docker (Dockerfile detect hoga)
3. Persistent Disk attach karo:
   - Name: `myschool-uploads`
   - Mount Path: `/var/data`
   - Size: `1 GB` ya needed size
4. Env vars add karo, especially `SCHOOL_LOGO_STORAGE_ROOT=/var/data/myschool/school-logos`. Deploy.

---

## Verify

Deploy ke baad logo upload karke app restart/redeploy karke verify karo ki same logo UI aur Bonafide PDF dono me persist kar raha hai. Agar "template is in use" aaye to ensure karo `DATABASE_URL`/`TENANT_ADMIN_DATABASE_URL` sirf **neondb** pe point karte hon, **school_template** pe nahi.
