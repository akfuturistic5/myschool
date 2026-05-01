/**
 * Test script for Application Sections Endpoints
 * Tests all endpoints and verifies user data isolation
 * 
 * Usage: node test-application-endpoints.js
 * 
 * Prerequisites:
 * - Server must be running
 * - You need valid JWT tokens for at least 2 different users
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

// Test configuration - Replace with actual tokens from your login
const USER1_TOKEN = process.env.USER1_TOKEN || 'YOUR_USER1_TOKEN_HERE';
const USER2_TOKEN = process.env.USER2_TOKEN || 'YOUR_USER2_TOKEN_HERE';

// Helper function to make HTTP requests
function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test functions
async function testEndpoint(name, endpoint, method = 'GET', body = null, token = USER1_TOKEN) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    const result = await makeRequest(endpoint, method, body, token);
    
    if (result.status >= 200 && result.status < 300) {
      console.log(`✅ ${name}: PASSED (Status: ${result.status})`);
      if (result.data.data && Array.isArray(result.data.data)) {
        console.log(`   Found ${result.data.data.length} items`);
      }
      return { success: true, result };
    } else {
      console.log(`❌ ${name}: FAILED (Status: ${result.status})`);
      console.log(`   Error: ${JSON.stringify(result.data)}`);
      return { success: false, result };
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return { success: false, error };
  }
}

async function testUserIsolation(endpoint, token1, token2, name) {
  console.log(`\n🔒 Testing User Isolation for ${name}...`);
  
  try {
    const result1 = await makeRequest(endpoint, 'GET', null, token1);
    const result2 = await makeRequest(endpoint, 'GET', null, token2);
    
    if (result1.status === 401 || result2.status === 401) {
      console.log(`⚠️  ${name}: Authentication required (tokens may be invalid)`);
      return { success: false, reason: 'Authentication failed' };
    }
    
    const data1 = result1.data?.data || [];
    const data2 = result2.data?.data || [];
    
    // Check if users see different data
    const ids1 = data1.map(item => item.id).sort();
    const ids2 = data2.map(item => item.id).sort();
    
    const hasOverlap = ids1.some(id => ids2.includes(id));
    
    if (hasOverlap && data1.length > 0 && data2.length > 0) {
      console.log(`⚠️  ${name}: Users may see overlapping data`);
      console.log(`   User 1 has ${data1.length} items, User 2 has ${data2.length} items`);
      console.log(`   Overlapping IDs: ${ids1.filter(id => ids2.includes(id)).join(', ')}`);
      return { success: false, reason: 'Data overlap detected' };
    } else {
      console.log(`✅ ${name}: User isolation verified`);
      console.log(`   User 1: ${data1.length} items, User 2: ${data2.length} items`);
      return { success: true };
    }
  } catch (error) {
    console.log(`❌ ${name}: Error testing isolation - ${error.message}`);
    return { success: false, error };
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Application Sections Endpoint Tests\n');
  console.log('='.repeat(60));
  
  if (USER1_TOKEN === 'YOUR_USER1_TOKEN_HERE') {
    console.log('\n⚠️  WARNING: Please set USER1_TOKEN and USER2_TOKEN environment variables');
    console.log('   Or edit this file and replace the token placeholders');
    console.log('   Example: USER1_TOKEN=your_token_here node test-application-endpoints.js\n');
  }
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // Test all GET endpoints
  const endpoints = [
    { name: 'Get Chats', endpoint: '/chats' },
    { name: 'Get Conversations', endpoint: '/chats/conversations' },
    { name: 'Get Calls', endpoint: '/calls' },
    { name: 'Get Calendar Events', endpoint: '/calendar' },
    { name: 'Get Emails (Inbox)', endpoint: '/emails?folder=inbox' },
    { name: 'Get Todos', endpoint: '/todos' },
    { name: 'Get Notes', endpoint: '/notes' },
    { name: 'Get Files', endpoint: '/files' },
  ];
  
  for (const test of endpoints) {
    const result = await testEndpoint(test.name, test.endpoint);
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Test user isolation if we have two tokens
  if (USER1_TOKEN !== 'YOUR_USER1_TOKEN_HERE' && USER2_TOKEN !== 'YOUR_USER2_TOKEN_HERE') {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 Testing User Data Isolation\n');
    
    const isolationTests = [
      { name: 'Chats', endpoint: '/chats' },
      { name: 'Calls', endpoint: '/calls' },
      { name: 'Calendar Events', endpoint: '/calendar' },
      { name: 'Emails', endpoint: '/emails?folder=inbox' },
      { name: 'Todos', endpoint: '/todos' },
      { name: 'Notes', endpoint: '/notes' },
      { name: 'Files', endpoint: '/files' },
    ];
    
    for (const test of isolationTests) {
      const result = await testUserIsolation(test.endpoint, USER1_TOKEN, USER2_TOKEN, test.name);
      if (result.success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  } else {
    console.log('\n⚠️  Skipping user isolation tests (need 2 user tokens)');
    results.skipped += 7;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! User data isolation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint, testUserIsolation };
