# Auth-Gated App Testing Playbook (Joy Automart B2B)

## Step 1: Create Test User & Session (workshop role with approved KYC)
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
var workshopId = 'ws-test-' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'workshop.test.' + Date.now() + '@example.com',
  name: 'Test Workshop',
  picture: '',
  role: 'workshop',
  created_at: new Date().toISOString()
});
db.workshops.insertOne({
  workshop_id: workshopId,
  user_id: userId,
  company_name: 'Test Auto Repair',
  contact_phone: '+8801712345678',
  address: 'Dhaka, Bangladesh',
  city: 'Dhaka',
  trade_license_no: 'TL-12345',
  kyc_status: 'approved',
  kyc_remark: '',
  credit_limit: 100000,
  credit_used: 0,
  documents: [],
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
print('Workshop ID: ' + workshopId);
"
```

## Admin test user
Same as above but with role='admin' and skip workshop creation.

## Step 2: Test API
```
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -X GET "$URL/api/products"
curl -X GET "$URL/api/workshop/me" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser cookie set
```
await page.context.add_cookies([{
    "name": "session_token", "value": "$TOKEN",
    "domain": "your-app.com", "path": "/",
    "httpOnly": True, "secure": True, "sameSite": "None"
}])
```

## Routes
- /              Landing
- /dashboard     Workshop dashboard
- /products      Catalog
- /cart          Checkout
- /orders        Orders list
- /orders/:id    Order detail
- /profile       Profile + KYC
- /admin         Admin console
- /admin/workshops, /admin/workshops/:id
- /admin/orders, /admin/orders/:id
- /admin/products
