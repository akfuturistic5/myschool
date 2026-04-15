const fetch = require('node-fetch');

async function testStudentsAPI() {
  try {
    console.log('Testing students API...');
    const response = await fetch('http://localhost:5000/api/students');
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.data && data.data.length > 0) {
      console.log('\nFirst student data:');
      const firstStudent = data.data[0];
      Object.entries(firstStudent).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testStudentsAPI();
