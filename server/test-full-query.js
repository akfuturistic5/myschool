const { query } = require('./src/config/database');

async function testFullQuery() {
  try {
    console.log('Testing full student query for ID 16...');
    
    const result = await query(`
      SELECT
        s.id,
        s.admission_number,
        s.roll_number,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.place_of_birth,
        s.blood_group_id,
        s.religion_id,
        s.cast_id,
        s.mother_tongue_id,
        s.nationality,
        s.phone,
        s.email,
        s.address,
        s.user_id,
        s.academic_year_id,
        s.class_id,
        s.section_id,
        s.house_id,
        s.admission_date,
        s.previous_school,
        s.photo_url,
        s.is_transport_required,
        s.route_id,
        s.pickup_point_id,
        s.is_hostel_required,
        s.hostel_room_id,
        s.parent_id,
        s.guardian_id,
        s.is_active,
        s.created_at,
        c.class_name,
        sec.section_name,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        g.first_name as guardian_first_name,
        g.last_name as guardian_last_name,
        g.phone as guardian_phone,
        g.email as guardian_email,
        g.occupation as guardian_occupation,
        g.relation as guardian_relation,
        addr.current_address,
        addr.permanent_address
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN guardians g ON s.guardian_id = g.id
      LEFT JOIN addresses addr ON s.user_id = addr.user_id
      WHERE s.id = 16 AND s.is_active = true
    `);
    
    console.log('Full query result:', result.rows[0]);
    
    if (result.rows[0]) {
      console.log('✅ Full query successful!');
      console.log('   user_id:', result.rows[0].user_id);
      console.log('   current_address:', result.rows[0].current_address);
      console.log('   permanent_address:', result.rows[0].permanent_address);
    } else {
      console.log('❌ No results found');
    }
    
  } catch (error) {
    console.error('❌ Full query failed:', error);
  } finally {
    process.exit(0);
  }
}

testFullQuery();
