const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testTeacherEndpoints() {
  try {
    console.log('🧪 Testing Teacher Endpoints...\n');

    // Test 1: Get all teachers
    console.log('1. Testing GET /api/teachers');
    const allTeachersResponse = await axios.get(`${BASE_URL}/teachers`);
    console.log('✅ Status:', allTeachersResponse.status);
    console.log('📊 Response:', JSON.stringify(allTeachersResponse.data, null, 2));
    console.log('');

    // Test 2: Get teacher by ID (using first teacher's ID)
    if (allTeachersResponse.data.data && allTeachersResponse.data.data.length > 0) {
      const firstTeacherId = allTeachersResponse.data.data[0].id;
      console.log(`2. Testing GET /api/teachers/${firstTeacherId}`);
      const teacherByIdResponse = await axios.get(`${BASE_URL}/teachers/${firstTeacherId}`);
      console.log('✅ Status:', teacherByIdResponse.status);
      console.log('📊 Response:', JSON.stringify(teacherByIdResponse.data, null, 2));
      console.log('');

      // Test 3: Get teachers by class (using first teacher's class_id)
      const firstTeacherClassId = allTeachersResponse.data.data[0].class_id;
      if (firstTeacherClassId) {
        console.log(`3. Testing GET /api/teachers/class/${firstTeacherClassId}`);
        const teachersByClassResponse = await axios.get(`${BASE_URL}/teachers/class/${firstTeacherClassId}`);
        console.log('✅ Status:', teachersByClassResponse.status);
        console.log('📊 Response:', JSON.stringify(teachersByClassResponse.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error testing teacher endpoints:', error.response?.data || error.message);
  }
}

// Run the tests
testTeacherEndpoints();
