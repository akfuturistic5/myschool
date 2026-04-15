# User Accounts for Students, Parents, Guardians

## Problem
- Students, Parents, and Guardians were created without linked user accounts (user_id = null)
- They could not login to the application

## Solution Applied

### 1. Migration: Add user_id to parents and guardians
```bash
node run-add-user-id-migration.js
```

### 2. Fix users id sequence (if needed)
If you get "duplicate key value violates unique constraint users_pkey":
```bash
node fix-users-sequence.js
```

### 3. Restart the server
After code changes, restart the API server:
```bash
npm start
```

## Behavior

**When adding a new student:**
- Student gets a user account (username = admission_number, password = phone)
- Parent gets a user account (username = father/mother email or par_studentId_phone, password = phone)
- Guardian gets a user account (username = email or phone, password = phone)

**When adding a guardian separately:**
- Guardian gets a user account automatically

**When adding a parent separately:**
- Parent gets a user account automatically

## Default Passwords
- Student: phone number (or admission_number if no phone)
- Parent: phone number (or 123456)
- Guardian: phone number (or 123456)

Users can login with username (admission_number/email/phone) and password (phone).
