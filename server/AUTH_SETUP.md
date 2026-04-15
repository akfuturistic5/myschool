# Authentication Setup

## Login Logic

- **Password = Phone Number** – User ka `phone` column ka value hi uska password hai
- **password_hash column** – `phone` ka bcrypt hash store hota hai
- **Login** – Username/Phone aur Password (phone number) se login

## Database - Manual Queries (if required)

### 1. Add password_hash column (if not exists)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
```

### 2. Existing users ke liye password_hash populate karein

Har user ke `phone` value ka hash generate karke `password_hash` mein store karein.

**Option A – Node script se (recommended):**

Server folder mein ye script run karein:

```javascript
// run-hash-phone.js
const { query } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function updateHashPasswords() {
  const res = await query('SELECT id, phone FROM users WHERE phone IS NOT NULL');
  for (const row of res.rows) {
    const hash = bcrypt.hashSync(row.phone.toString(), 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, row.id]);
    console.log('Updated user id:', row.id);
  }
}
updateHashPasswords().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
```

```bash
node run-hash-phone.js
```

**Option B – Manual (ek user ke liye):**

1. Phone number ka hash generate karein:
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('9876501111', 10));"
```

2. Output hash ko use karein:
```sql
UPDATE users SET password_hash = 'YOUR_GENERATED_HASH' WHERE phone = '9876501111';
```

### 3. Future user creation

Jab naya user create ho, `phone` set karte waqt `password_hash` bhi set karein:
`password_hash = bcrypt(phone)`
