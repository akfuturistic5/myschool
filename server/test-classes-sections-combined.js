const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testClassesAndSectionsCombined() {
  try {
    console.log('🧪 Testing Classes and Sections Combined Data...\n');

    // Test 1: Get all classes
    console.log('1. Testing GET /api/classes');
    const allClassesResponse = await axios.get(`${BASE_URL}/classes`);
    console.log('✅ Status:', allClassesResponse.status);
    console.log('📊 Classes Response:', JSON.stringify(allClassesResponse.data, null, 2));
    console.log('');

    // Test 2: Get all sections
    console.log('2. Testing GET /api/sections');
    const allSectionsResponse = await axios.get(`${BASE_URL}/sections`);
    console.log('✅ Status:', allSectionsResponse.status);
    console.log('📊 Sections Response:', JSON.stringify(allSectionsResponse.data, null, 2));
    console.log('');

    // Test 3: Show the relationship
    console.log('3. Classes and Sections Relationship:');
    const classes = allClassesResponse.data.data || [];
    const sections = allSectionsResponse.data.data || [];
    
    classes.forEach(classItem => {
      console.log(`\n📚 Class: ${classItem.class_name} (ID: ${classItem.id})`);
      const classSections = sections.filter(section => section.class_id === classItem.id);
      
      if (classSections.length > 0) {
        classSections.forEach(section => {
          console.log(`  └─ Section: ${section.section_name} (Students: ${section.no_of_students})`);
        });
      } else {
        console.log(`  └─ No sections found`);
      }
    });

  } catch (error) {
    console.error('❌ Error testing endpoints:', error.response?.data || error.message);
  }
}

// Run the tests
testClassesAndSectionsCombined();
