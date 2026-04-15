const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testEndpoints() {
  try {
    console.log('🧪 Testing Updated Endpoints...\n');

    // Test 1: Get all addresses
    console.log('1️⃣ Testing GET /api/addresses');
    try {
      const addressesResponse = await axios.get(`${BASE_URL}/addresses`);
      console.log('✅ Addresses fetched successfully');
      console.log(`   Count: ${addressesResponse.data.count}`);
      console.log(`   Sample data:`, addressesResponse.data.data[0] || 'No addresses found');
    } catch (error) {
      console.log('❌ Failed to fetch addresses:', error.response?.data || error.message);
    }

    // Test 2: Get address by ID
    console.log('\n2️⃣ Testing GET /api/addresses/1');
    try {
      const addressResponse = await axios.get(`${BASE_URL}/addresses/1`);
      console.log('✅ Address fetched successfully');
      console.log(`   Address ID: ${addressResponse.data.data.id}`);
      console.log(`   Current Address: ${addressResponse.data.data.current_address}`);
      console.log(`   Permanent Address: ${addressResponse.data.data.permanent_address}`);
    } catch (error) {
      console.log('❌ Failed to fetch address:', error.response?.data || error.message);
    }

    // Test 3: Get all students (should now include address_id and address data)
    console.log('\n3️⃣ Testing GET /api/students (updated with address_id)');
    try {
      const studentsResponse = await axios.get(`${BASE_URL}/students`);
      console.log('✅ Students fetched successfully');
      console.log(`   Count: ${studentsResponse.data.count}`);
      
             const sampleStudent = studentsResponse.data.data[0];
       if (sampleStudent) {
         console.log(`   Sample student: ${sampleStudent.first_name} ${sampleStudent.last_name}`);
         console.log(`   User ID: ${sampleStudent.user_id}`);
         console.log(`   Current Address: ${sampleStudent.current_address || 'Not set'}`);
         console.log(`   Permanent Address: ${sampleStudent.permanent_address || 'Not set'}`);
       }
    } catch (error) {
      console.log('❌ Failed to fetch students:', error.response?.data || error.message);
    }

    // Test 4: Get student by ID
    console.log('\n4️⃣ Testing GET /api/students/2');
    try {
      const studentResponse = await axios.get(`${BASE_URL}/students/2`);
             console.log('✅ Student fetched successfully');
       console.log(`   Student: ${studentResponse.data.data.first_name} ${studentResponse.data.data.last_name}`);
       console.log(`   User ID: ${studentResponse.data.data.user_id}`);
       console.log(`   Current Address: ${studentResponse.data.data.current_address || 'Not set'}`);
       console.log(`   Permanent Address: ${studentResponse.data.data.permanent_address || 'Not set'}`);
    } catch (error) {
      console.log('❌ Failed to fetch student:', error.response?.data || error.message);
    }

    // Test 5: Create a new address
    console.log('\n5️⃣ Testing POST /api/addresses');
    try {
      const newAddress = {
        current_address: '123 Test Street, Test City',
        permanent_address: '456 Test Avenue, Test City',
        user_id: 1,
        role_id: 3,
        person_id: null
      };
      
      const createAddressResponse = await axios.post(`${BASE_URL}/addresses`, newAddress);
      console.log('✅ Address created successfully');
      console.log(`   New Address ID: ${createAddressResponse.data.data.id}`);
      console.log(`   Current Address: ${createAddressResponse.data.data.current_address}`);
      
      // Clean up - delete the test address
      await axios.delete(`${BASE_URL}/addresses/${createAddressResponse.data.data.id}`);
      console.log('   ✅ Test address cleaned up');
    } catch (error) {
      console.log('❌ Failed to create address:', error.response?.data || error.message);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server is running');
    await testEndpoints();
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   cd server && npm start');
  }
}

checkServer();
