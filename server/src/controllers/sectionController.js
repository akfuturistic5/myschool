const { query } = require('../config/database');

const getAllSections = async (req, res) => {
  try {
    // First, check what's actually in the database
    console.log('=== CHECKING RAW DATABASE VALUES ===');
    const rawCheck = await query(`
      SELECT id, section_name, is_active, pg_typeof(is_active) as data_type
      FROM sections
      ORDER BY id ASC
    `);
    console.log('Direct query from sections table:');
    rawCheck.rows.forEach((row, idx) => {
      console.log(`  Row ${idx + 1}: id=${row.id}, section_name='${row.section_name}', is_active=${row.is_active} (${typeof row.is_active}), data_type=${row.data_type}`);
    });
    
    // Query WITHOUT CAST first to see raw values
    const resultWithoutCast = await query(`
      SELECT
        s.id,
        s.section_name,
        s.is_active as is_active_raw,
        pg_typeof(s.is_active) as is_active_type
      FROM sections s
      ORDER BY s.id ASC
    `);
    console.log('=== VALUES WITHOUT CAST ===');
    resultWithoutCast.rows.forEach((row, idx) => {
      console.log(`  Row ${idx + 1}: id=${row.id}, section='${row.section_name}', is_active_raw=${row.is_active_raw} (${typeof row.is_active_raw}), pg_type=${row.is_active_type}`);
    });
    
    // Use explicit CAST to ensure boolean type
    const result = await query(`
      SELECT
        s.id,
        s.section_name,
        s.class_id,
        s.section_teacher_id,
        s.max_students,
        s.room_number,
        s.description,
        s.is_active as is_active_no_cast,
        CAST(s.is_active AS BOOLEAN) as is_active,
        s.created_at,
        s.no_of_students,
        c.class_name,
        c.class_code,
        st.first_name as teacher_first_name,
        st.last_name as teacher_last_name
      FROM sections s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN staff st ON s.section_teacher_id = st.id
      ORDER BY c.class_name ASC, s.section_name ASC
    `);
    
    console.log(`=== TOTAL ROWS RETURNED: ${result.rows.length} ===`);
    console.log('=== RAW DATABASE RESULTS (ALL ROWS) ===');
    result.rows.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, {
        id: row.id,
        section_name: row.section_name,
        is_active_no_cast: row.is_active_no_cast,
        is_active_no_cast_type: typeof row.is_active_no_cast,
        is_active: row.is_active,
        is_active_type: typeof row.is_active,
        is_active_value: JSON.stringify(row.is_active),
        is_true: row.is_active === true,
        is_false: row.is_active === false,
        strict_equality_true: row.is_active === true,
        strict_equality_false: row.is_active === false,
        truthy: !!row.is_active,
        falsy: !row.is_active
      });
    });
    
    // Normalize is_active to proper boolean values
    console.log('=== STARTING NORMALIZATION ===');
    const normalizedRows = result.rows.map((row, rowIdx) => {
      const rawValue = row.is_active;
      
      console.log(`Normalizing Row ${rowIdx + 1} (id=${row.id}, section=${row.section_name}):`);
      console.log(`  Raw value:`, rawValue, `(type: ${typeof rawValue})`);
      console.log(`  Strict true check:`, rawValue === true);
      console.log(`  Strict false check:`, rawValue === false);
      
      // Convert to boolean - handle all possible formats
      let isActive = false;
      
      // Check if it's already a boolean true
      if (rawValue === true) {
        isActive = true;
        console.log(`  → Detected boolean TRUE`);
      }
      // Check if it's already a boolean false
      else if (rawValue === false) {
        isActive = false;
        console.log(`  → Detected boolean FALSE`);
      }
      // Handle string representations
      else if (typeof rawValue === 'string') {
        const lowerVal = rawValue.toLowerCase().trim();
        if (lowerVal === 'true' || lowerVal === 't' || lowerVal === '1') {
          isActive = true;
        } else if (lowerVal === 'false' || lowerVal === 'f' || lowerVal === '0') {
          isActive = false;
        } else {
          console.warn(`⚠️ Unknown string value for is_active: "${rawValue}"`);
          isActive = false;
        }
      }
      // Handle numeric values
      else if (typeof rawValue === 'number') {
        isActive = rawValue === 1 || rawValue > 0;
      }
      // Handle null/undefined
      else if (rawValue === null || rawValue === undefined) {
        isActive = false;
      }
      // Default to false for any other type
      else {
        console.warn(`⚠️ Unexpected type for is_active: ${typeof rawValue}, value: ${JSON.stringify(rawValue)}`);
        isActive = false;
      }
      
      // Create new object with normalized boolean
      const normalizedRow = {
        id: row.id,
        section_name: row.section_name,
        class_id: row.class_id,
        section_teacher_id: row.section_teacher_id,
        max_students: row.max_students,
        room_number: row.room_number,
        description: row.description,
        is_active: isActive, // Explicitly set as boolean
        created_at: row.created_at,
        no_of_students: row.no_of_students,
        class_name: row.class_name,
        class_code: row.class_code,
        teacher_first_name: row.teacher_first_name,
        teacher_last_name: row.teacher_last_name
      };
      
      console.log(`  → Final normalized value:`, isActive, `(type: ${typeof isActive})`);
      
      return normalizedRow;
    });
    
    console.log('=== NORMALIZED RESULTS (ALL ROWS) ===');
    normalizedRows.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, {
        id: row.id,
        section_name: row.section_name,
        is_active: row.is_active,
        is_active_type: typeof row.is_active,
        is_true: row.is_active === true,
        is_false: row.is_active === false,
        strict_equality_true: row.is_active === true,
        strict_equality_false: row.is_active === false
      });
    });
    
    // Log final JSON that will be sent
    console.log('=== FINAL JSON RESPONSE (first 3) ===');
    const sampleResponse = normalizedRows.slice(0, 3).map(row => ({
      id: row.id,
      section_name: row.section_name,
      is_active: row.is_active
    }));
    console.log(JSON.stringify(sampleResponse, null, 2));
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Sections fetched successfully',
      data: normalizedRows,
      count: normalizedRows.length
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch sections',
    });
  }
};

const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        s.id,
        s.section_name,
        s.class_id,
        s.section_teacher_id,
        s.max_students,
        s.room_number,
        s.description,
        s.is_active,
        s.created_at,
        s.no_of_students,
        c.class_name,
        c.class_code,
        st.first_name as teacher_first_name,
        st.last_name as teacher_last_name
      FROM sections s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN staff st ON s.section_teacher_id = st.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Section not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Section fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching section:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch section',
    });
  }
};

const getSectionsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await query(`
      SELECT
        s.id,
        s.section_name,
        s.class_id,
        s.section_teacher_id,
        s.max_students,
        s.room_number,
        s.description,
        s.is_active,
        s.created_at,
        s.no_of_students,
        c.class_name,
        c.class_code,
        st.first_name as teacher_first_name,
        st.last_name as teacher_last_name
      FROM sections s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN staff st ON s.section_teacher_id = st.id
      WHERE s.class_id = $1 AND s.is_active = true
      ORDER BY s.section_name ASC
    `, [classId]);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Sections fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching sections by class:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch sections',
    });
  }
};

const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { section_name, no_of_students, is_active } = req.body;

    // Validate required fields
    if (!section_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Section name is required'
      });
    }

    // Convert is_active to boolean if it's a string
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    } else {
      isActiveBoolean = false;
    }

    const noOfStudents = no_of_students != null ? parseInt(no_of_students, 10) : null;

    // Update with modified_at column (as per database schema)
    const result = await query(`
      UPDATE sections SET
        section_name = $1,
        no_of_students = $2,
        is_active = $3,
        modified_at = NOW()
      WHERE id = $4
      RETURNING id, section_name, is_active, no_of_students, created_at, modified_at
    `, [section_name, noOfStudents, isActiveBoolean, id]);

    if (result.rows.length === 0) {
      console.error(`Section not found with id: ${id}`);
      return res.status(404).json({
        status: 'ERROR',
        message: 'Section not found'
      });
    }

    console.log('Section updated successfully:', {
      id: result.rows[0].id,
      section_name: result.rows[0].section_name,
      is_active: result.rows[0].is_active,
      is_active_type: typeof result.rows[0].is_active
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Section updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('=== ERROR UPDATING SECTION ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update section' : `Failed to update section: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = {
  getAllSections,
  getSectionById,
  getSectionsByClass,
  updateSection
};
