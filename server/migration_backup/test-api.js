const express = require('express');
const { query } = require('./src/config/database');

const app = express();
const PORT = 5001;

app.use(express.json());

// Test endpoint
app.get('/api/test-student/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Testing student query for ID:', id);
    
    const result = await query(`
      SELECT
        s.id,
        s.user_id,
        addr.current_address,
        addr.permanent_address
      FROM students s
      LEFT JOIN addresses addr ON s.user_id = addr.user_id
      WHERE s.id = $1 AND s.is_active = true
    `, [id]);
    
    console.log('Query result:', result.rows[0]);
    
    res.json({
      status: 'SUCCESS',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
