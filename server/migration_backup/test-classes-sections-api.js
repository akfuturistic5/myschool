const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testClassesAndSectionsEndpoints() {
  try {
    console.log('🧪 Testing Classes and Sections Endpoints...\n');

    // Test 1: Get all classes
    console.log('1. Testing GET /api/classes');
    const allClassesResponse = await axios.get(`${BASE_URL}/classes`);
    console.log('✅ Status:', allClassesResponse.status);
    console.log('📊 Response:', JSON.stringify(allClassesResponse.data, null, 2));
    console.log('');

    // Test 2: Get class by ID (using first class's ID)
    if (allClassesResponse.data.data && allClassesResponse.data.data.length > 0) {
      const firstClassId = allClassesResponse.data.data[0].id;
      console.log(`2. Testing GET /api/classes/${firstClassId}`);
      const classByIdResponse = await axios.get(`${BASE_URL}/classes/${firstClassId}`);
      console.log('✅ Status:', classByIdResponse.status);
      console.log('📊 Response:', JSON.stringify(classByIdResponse.data, null, 2));
      console.log('');

      // Test 3: Get classes by academic year (using first class's academic_year_id)
      const firstClassAcademicYearId = allClassesResponse.data.data[0].academic_year_id;
      if (firstClassAcademicYearId) {
        console.log(`3. Testing GET /api/classes/academic-year/${firstClassAcademicYearId}`);
        const classesByAcademicYearResponse = await axios.get(`${BASE_URL}/classes/academic-year/${firstClassAcademicYearId}`);
        console.log('✅ Status:', classesByAcademicYearResponse.status);
        console.log('📊 Response:', JSON.stringify(classesByAcademicYearResponse.data, null, 2));
        console.log('');
      }
    }

    // Test 4: Get all sections
    console.log('4. Testing GET /api/sections');
    const allSectionsResponse = await axios.get(`${BASE_URL}/sections`);
    console.log('✅ Status:', allSectionsResponse.status);
    console.log('📊 Response:', JSON.stringify(allSectionsResponse.data, null, 2));
    console.log('');

    // Test 5: Get section by ID (using first section's ID)
    if (allSectionsResponse.data.data && allSectionsResponse.data.data.length > 0) {
      const firstSectionId = allSectionsResponse.data.data[0].id;
      console.log(`5. Testing GET /api/sections/${firstSectionId}`);
      const sectionByIdResponse = await axios.get(`${BASE_URL}/sections/${firstSectionId}`);
      console.log('✅ Status:', sectionByIdResponse.status);
      console.log('📊 Response:', JSON.stringify(sectionByIdResponse.data, null, 2));
      console.log('');

      // Test 6: Get sections by class (using first section's class_id)
      const firstSectionClassId = allSectionsResponse.data.data[0].class_id;
      if (firstSectionClassId) {
        console.log(`6. Testing GET /api/sections/class/${firstSectionClassId}`);
        const sectionsByClassResponse = await axios.get(`${BASE_URL}/sections/class/${firstSectionClassId}`);
        console.log('✅ Status:', sectionsByClassResponse.status);
        console.log('📊 Response:', JSON.stringify(sectionsByClassResponse.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error testing endpoints:', error.response?.data || error.message);
  }
}

// Run the tests
testClassesAndSectionsEndpoints();
