# Problem Table (समस्या तालिका)

## 📊 Quick Reference Table

| # | Problem (समस्या) | Location (स्थान) | Severity (गंभीरता) | Status (स्थिति) | Fix (समाधान) |
|---|-------------------|------------------|---------------------|------------------|---------------|
| 1 | API Service Method Bug | `client/src/core/services/apiService.js:25` | 🔴 Critical | ⚠️ Needs Fix | `method: options.method \|\| 'GET'` use करें |
| 2 | Religion Column Name Inconsistency | `server/src/controllers/studentController.js:380-402` | 🔴 Critical | ⚠️ Needs Fix | DB में correct column name check करें (`religion_id` या `reigion_id`) |
| 3 | Hostel Table Name Inconsistency | `server/src/controllers/studentController.js:435-550` | 🔴 Critical | ⚠️ Needs Fix | DB में actual table name check करें (`hostel_room` या `hostel_rooms`) |
| 4 | Password Security - Plain Text | `server/src/controllers/authController.js:74-77` | 🔴 Critical | ⚠️ Needs Fix | `bcrypt.compare()` use करें, `password_hash` column check करें |
| 5 | Multiple Fallback Queries | `server/src/controllers/studentController.js` | 🟡 Medium | ⚠️ Needs Cleanup | Schema fix के बाद fallback queries remove करें |
| 6 | Console.log in Production | Multiple controller files | 🟡 Medium | ⚠️ Needs Cleanup | Proper logging library use करें |
| 7 | Database Connection | `server/src/config/database.js` | ✅ Working | ✅ OK | No issues |
| 8 | CORS Configuration | `server/server.js:50-53` | ✅ Working | ✅ OK | Properly configured |
| 9 | Error Handling | `server/server.js:116-119` | ✅ Working | ✅ OK | Properly implemented |
| 10 | Protected Routes | `client/src/core/components/ProtectedRoute.tsx` | ✅ Working | ✅ OK | Properly implemented |
| 11 | Redux Store | `client/src/core/data/redux/store.tsx` | ✅ Working | ✅ OK | Properly configured |
| 12 | Authentication Flow | `client/src/core/data/redux/authSlice.ts` | ✅ Working | ✅ OK | Properly implemented |

---

## 🔴 Critical Problems Details (गंभीर समस्याएं विस्तार से)

### Problem #1: API Service Method Bug
**File:** `client/src/core/services/apiService.js`  
**Line:** 25  
**Issue:** `method: 'GET'` hardcoded है, लेकिन `...options` बाद में आता है तो override हो जाएगा। फिर भी code confusing है।  
**Current:**
```javascript
const response = await fetch(url, {
  method: 'GET',  // Hardcoded
  headers,
  mode: 'cors',
  credentials: 'omit',
  ...options,  // Override करेगा
});
```
**Fix:**
```javascript
const response = await fetch(url, {
  method: options.method || 'GET',  // Default GET, override हो सकता है
  headers,
  mode: 'cors',
  credentials: 'omit',
  ...options,
});
```
**Impact:** POST/PUT requests technically काम करेंगे, लेकिन code clarity के लिए fix करें।

---

### Problem #2: Religion Column Name Inconsistency
**File:** `server/src/controllers/studentController.js`  
**Lines:** 380-402  
**Issue:** Code में `religion_id` और `reigion_id` दोनों try कर रहा है (typo handling)।  
**Current Behavior:**
- पहले `religion_id` try करता है
- Error आने पर `reigion_id` try करता है
**Fix:** Database में actual column name check करें:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name LIKE '%religion%';
```
फिर सिर्फ correct column name use करें।

---

### Problem #3: Hostel Table Name Inconsistency  
**File:** `server/src/controllers/studentController.js`  
**Lines:** 435-550  
**Issue:** Multiple table names try कर रहा है:
- `hostel_room`
- `hostel_rooms`  
- `hostel`
- `hostels`
**Fix:** Database में actual table name check करें:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%hostel%';
```
फिर सिर्फ correct table name use करें।

---

### Problem #4: Password Security Issue
**File:** `server/src/controllers/authController.js`  
**Lines:** 74-77  
**Issue:** Password directly phone number से compare हो रहा है (no hashing)।  
**Current:**
```javascript
if (enteredPassword !== storedPhone) {
  return errorResponse(res, 401, 'Invalid username or password');
}
```
**Security Risk:** Database leak होने पर सभी passwords (phone numbers) visible होंगे।  
**Fix:**
```javascript
const bcrypt = require('bcryptjs');

// Password verify करें
const isValidPassword = await bcrypt.compare(enteredPassword, user.password_hash);
if (!isValidPassword) {
  return errorResponse(res, 401, 'Invalid username or password');
}
```
**Note:** Database में `password_hash` column होना चाहिए जो bcrypt hash store करे।

---

## 🟡 Medium Priority Problems

### Problem #5: Multiple Fallback Queries
**File:** `server/src/controllers/studentController.js`  
**Issue:** Schema inconsistencies के कारण multiple fallback queries हैं।  
**Impact:** 
- Code complexity बढ़ती है
- Performance थोड़ा affect हो सकता है
- Maintenance difficult हो जाता है
**Fix:** Schema fix के बाद fallback queries remove करें।

---

### Problem #6: Console.log in Production
**Files:** Multiple controller files  
**Issue:** Production code में `console.log` statements हैं।  
**Impact:** 
- Performance थोड़ा affect हो सकता है
- Logs clutter हो सकते हैं
**Fix:** Proper logging library use करें (winston/morgan):
```javascript
const logger = require('./utils/logger');

// Development में
if (process.env.NODE_ENV === 'development') {
  logger.debug('Debug message');
}

// Production में
logger.info('Info message');
logger.error('Error message');
```

---

## ✅ Working Well (सही काम कर रहा है)

### Database Connection ✅
- Connection pool properly configured
- Error handling implemented
- Connection timeout set

### CORS Configuration ✅  
- Properly configured for localhost:3000 and localhost:5173
- Credentials enabled

### Error Handling ✅
- Global error handler implemented
- Internal error details not leaked
- Proper error responses

### Authentication Flow ✅
- Login working
- Token storage working
- Session expiry handling working
- Protected routes working

### Frontend State Management ✅
- Redux store properly configured
- Auth slice working
- Token persistence working

---

## 🎯 Priority Fix Order (सुधार की प्राथमिकता)

1. **🔴 Critical - Fix Immediately:**
   - Problem #4: Password Security (सबसे important - security issue)
   - Problem #2: Religion Column Name (Database consistency)
   - Problem #3: Hostel Table Name (Database consistency)
   - Problem #1: API Service Method (Code clarity)

2. **🟡 Medium - Fix Soon:**
   - Problem #5: Remove Fallback Queries (Schema fix के बाद)
   - Problem #6: Logging Cleanup

---

## 📝 Testing Checklist (टेस्टिंग)

### Critical Tests:
- [ ] Test POST request (create student) - API Service fix के बाद
- [ ] Test PUT request (update student) - API Service fix के बाद  
- [ ] Test login with password hashing - Security fix के बाद
- [ ] Test student fetch with religion data - Schema fix के बाद
- [ ] Test student fetch with hostel data - Schema fix के बाद

### General Tests:
- [ ] Test authentication flow
- [ ] Test protected routes
- [ ] Test error handling
- [ ] Test database connections

---

## 🔧 How to Fix (कैसे ठीक करें)

### Step 1: Database Schema Check
```sql
-- Religion column check
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name LIKE '%religion%';

-- Hostel tables check
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%hostel%';
```

### Step 2: Fix Code Based on Actual Schema
- Correct column/table names use करें
- Fallback queries remove करें

### Step 3: Implement Password Hashing
- `bcrypt` install करें (already installed)
- Login में `bcrypt.compare()` use करें
- User creation में `bcrypt.hash()` use करें

### Step 4: Clean Up Code
- API Service method fix करें
- Console.log statements remove करें या logger use करें

---

**Last Updated:** $(date)  
**Report Version:** 1.0
