# Application Sections - Verification Checklist

This document helps verify that all application sections are working correctly with real data and proper user isolation.

## ✅ Pre-Verification Checklist

- [ ] Database tables are created (run migration if not done)
- [ ] Server is running (`npm start` or `npm run dev`)
- [ ] You have at least 2 user accounts to test isolation
- [ ] JWT tokens are working (can login and get token)

## 🔍 Manual Testing Steps

### 1. Database Verification

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('chats', 'calls', 'calendar_events', 'emails', 'todos', 'notes', 'files')
ORDER BY table_name;

-- Verify user_id column exists in all tables
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('chats', 'calls', 'calendar_events', 'emails', 'todos', 'notes', 'files')
AND column_name = 'user_id'
ORDER BY table_name;
```

### 2. API Endpoint Testing

#### Test with Postman or curl:

**Get Chats:**
```bash
curl -X GET http://localhost:5000/api/chats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Calls:**
```bash
curl -X GET http://localhost:5000/api/calls \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Calendar Events:**
```bash
curl -X GET http://localhost:5000/api/calendar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Emails:**
```bash
curl -X GET "http://localhost:5000/api/emails?folder=inbox" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Todos:**
```bash
curl -X GET http://localhost:5000/api/todos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Notes:**
```bash
curl -X GET http://localhost:5000/api/notes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Files:**
```bash
curl -X GET http://localhost:5000/api/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. User Data Isolation Testing

**Critical Test:** Verify that User A cannot see User B's data.

1. **Login as User A** and get token A
2. **Login as User B** and get token B
3. **Create data as User A** (e.g., create a todo)
4. **Try to access User A's data as User B** - should return empty array or 404
5. **Verify User A can only see their own data**

**Example Test:**
```bash
# Create todo as User A
curl -X POST http://localhost:5000/api/todos \
  -H "Authorization: Bearer TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"title": "User A Todo", "content": "This is User A todo"}'

# Try to get todos as User B - should NOT see User A's todo
curl -X GET http://localhost:5000/api/todos \
  -H "Authorization: Bearer TOKEN_B"

# Verify User B's response doesn't contain User A's todo ID
```

### 4. Frontend Testing

1. **Login to the application**
2. **Navigate to each section:**
   - Chat (`/application/chat`)
   - Call (`/application/audio-call`)
   - Calendar (`/application/calendar`)
   - Email (`/application/email`)
   - To Do (`/application/todo`)
   - Notes (`/application/notes`)
   - File Manager (`/application/file-manager`)

3. **Verify:**
   - Data loads without errors
   - Loading states work correctly
   - Error handling works (try with invalid token)
   - Only current user's data is displayed
   - No dummy/placeholder data is shown

### 5. Database Query Verification

**Verify user_id filtering in database:**

```sql
-- Check that all records have user_id
SELECT 
    'chats' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id
FROM chats
UNION ALL
SELECT 'calls', COUNT(*), COUNT(user_id) FROM calls
UNION ALL
SELECT 'calendar_events', COUNT(*), COUNT(user_id) FROM calendar_events
UNION ALL
SELECT 'emails', COUNT(*), COUNT(user_id) FROM emails
UNION ALL
SELECT 'todos', COUNT(*), COUNT(user_id) FROM todos
UNION ALL
SELECT 'notes', COUNT(*), COUNT(user_id) FROM notes
UNION ALL
SELECT 'files', COUNT(*), COUNT(user_id) FROM files;

-- Verify no NULL user_ids exist
SELECT 
    'chats' as table_name,
    COUNT(*) as null_user_ids
FROM chats WHERE user_id IS NULL
UNION ALL
SELECT 'calls', COUNT(*) FROM calls WHERE user_id IS NULL
UNION ALL
SELECT 'calendar_events', COUNT(*) FROM calendar_events WHERE user_id IS NULL
UNION ALL
SELECT 'emails', COUNT(*) FROM emails WHERE user_id IS NULL
UNION ALL
SELECT 'todos', COUNT(*) FROM todos WHERE user_id IS NULL
UNION ALL
SELECT 'notes', COUNT(*) FROM notes WHERE user_id IS NULL
UNION ALL
SELECT 'files', COUNT(*) FROM files WHERE user_id IS NULL;
```

**Expected Result:** All counts should be 0 (no NULL user_ids)

### 6. Automated Testing

Run the test script:

```bash
# Set your tokens
export USER1_TOKEN="your_user1_jwt_token"
export USER2_TOKEN="your_user2_jwt_token"

# Run tests
node test-application-endpoints.js
```

## 🚨 Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution:** Check that:
- JWT token is valid and not expired
- Token is sent in Authorization header: `Bearer <token>`
- Server JWT_SECRET matches

### Issue: Empty arrays returned
**Solution:** 
- Check if user has data in database
- Verify user_id in database matches authenticated user
- Check API logs for errors

### Issue: User A sees User B's data
**Critical Security Issue!**
**Solution:**
- Verify controllers filter by `req.user.id`
- Check database queries include `WHERE user_id = $1`
- Test with different user tokens

### Issue: Frontend shows dummy data
**Solution:**
- Verify hooks are imported correctly
- Check API calls are being made (Network tab)
- Ensure components use hooks instead of dummy data imports

## ✅ Final Verification

- [ ] All 7 sections load real data from database
- [ ] User A cannot see User B's data
- [ ] All CRUD operations work (Create, Read, Update, Delete)
- [ ] Loading states display correctly
- [ ] Error handling works
- [ ] No console errors in browser
- [ ] No dummy/placeholder data visible

## 📝 Notes

- All endpoints require JWT authentication
- User data is automatically filtered by `user_id` from JWT token
- Sample data is inserted only for existing users in the database
- Foreign keys ensure data integrity (CASCADE deletes)

## 🎯 Success Criteria

✅ **All tests pass**
✅ **User data isolation verified**
✅ **No security vulnerabilities**
✅ **Frontend displays real data**
✅ **No dummy data visible**
