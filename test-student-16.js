const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testStudent16() {
  try {
    console.log('🧪 Testing Student ID 16 Address Relationship...\n');

    // Test 1: Get student 16
    console.log('1️⃣ Testing GET /api/students/16');
    try {
      const studentResponse = await axios.get(`${BASE_URL}/students/16`);
      console.log('✅ Student 16 fetched successfully');
      console.log(`   Student: ${studentResponse.data.data.first_name} ${studentResponse.data.data.last_name}`);
      console.log(`   User ID: ${studentResponse.data.data.user_id}`);
      console.log(`   Current Address: ${studentResponse.data.data.current_address || 'Not set'}`);
      console.log(`   Permanent Address: ${studentResponse.data.data.permanent_address || 'Not set'}`);
      
      if (studentResponse.data.data.current_address && studentResponse.data.data.permanent_address) {
        console.log('✅ Address data is properly linked!');
      } else {
        console.log('⚠️  Address data is missing - check if address exists for this user_id');
      }
    } catch (error) {
      console.log('❌ Failed to fetch student 16:', error.response?.data || error.message);
    }

    // Test 2: Get all students to see the pattern
    console.log('\n2️⃣ Testing GET /api/students (to see all students)');
    try {
      const studentsResponse = await axios.get(`${BASE_URL}/students`);
      console.log('✅ Students fetched successfully');
      console.log(`   Total students: ${studentsResponse.data.count}`);
      
      // Find students with address data
      const studentsWithAddress = studentsResponse.data.data.filter(s => s.current_address && s.permanent_address);
      console.log(`   Students with address data: ${studentsWithAddress.length}`);
      
      if (studentsWithAddress.length > 0) {
        console.log('   Sample students with addresses:');
        studentsWithAddress.slice(0, 3).forEach((student, index) => {
          console.log(`     ${index + 1}. ${student.first_name} ${student.last_name} (User ID: ${student.user_id})`);
          console.log(`        Current: ${student.current_address}`);
          console.log(`        Permanent: ${student.permanent_address}`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to fetch students:', error.response?.data || error.message);
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server is running');
    await testStudent16();
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   cd server && npm start');
  }
}

checkServer();
