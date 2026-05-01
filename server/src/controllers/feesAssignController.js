const { query, pool } = require('../config/database');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

const assignFees = async (req, res) => {
    const client = await pool.connect();
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { student_ids, fees_master_ids, academic_year_id } = req.body;
        if (!fees_master_ids || !Array.isArray(fees_master_ids) || !student_ids || !Array.isArray(student_ids) || !academic_year_id) {
            return res.status(400).json({ status: 'ERROR', message: 'student_ids, fees_master_ids and academic_year_id are required' });
        }

        await client.query('BEGIN');

        for (const studentId of student_ids) {
            // Group the master fees by their group_id to ensure we handle the assign header correctly
            const masterFeesInfo = await client.query(
                'SELECT id, fees_group_id, amount FROM fees_master WHERE id = ANY($1)',
                [fees_master_ids]
            );

            for (const master of masterFeesInfo.rows) {
                // Check if Fees Assign header exists for this student, group, and year
                let assignHeader = await client.query(
                    'SELECT id FROM fees_assign WHERE student_id = $1 AND fees_group_id = $2 AND academic_year_id = $3',
                    [studentId, master.fees_group_id, academic_year_id]
                );

                let assignId;
                if (assignHeader.rowCount === 0) {
                    // Create new header
                    // We need to know which class the student belongs to for historical reporting
                    const studentInfo = await client.query('SELECT class_id FROM students WHERE id = $1', [studentId]);
                    const classId = studentInfo.rows[0]?.class_id;

                    const newHeader = await client.query(
                        'INSERT INTO fees_assign (student_id, class_id, fees_group_id, academic_year_id) VALUES ($1, $2, $3, $4) RETURNING id',
                        [studentId, classId || null, master.fees_group_id, academic_year_id]
                    );
                    assignId = newHeader.rows[0].id;
                } else {
                    assignId = assignHeader.rows[0].id;
                }

                // Check if this specific master entry is already in details
                const checkDetail = await client.query(
                    'SELECT id FROM fees_assign_details WHERE fees_assign_id = $1 AND fees_master_id = $2',
                    [assignId, master.id]
                );

                if (checkDetail.rowCount === 0) {
                    await client.query(
                        'INSERT INTO fees_assign_details (fees_assign_id, fees_master_id, amount, academic_year_id) VALUES ($1, $2, $3, $4)',
                        [assignId, master.id, master.amount, academic_year_id]
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.status(200).json({
            status: 'SUCCESS',
            message: `Fees assigned successfully to ${student_ids.length} students`
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error in assignFees:', error);

        if (error.code === '23505') {
            return res.status(409).json({ 
                status: 'ERROR', 
                message: 'This fee group has already been assigned to one or more selected students for this academic year.' 
            });
        }

        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
};

const deleteFeesAssignment = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;

        // Note: CASCADE should ideally handle fees_assign_details deletion in the schema.
        // If not, we should delete them manually first.
        // Assuming CASCADE is set.
        const result = await query('DELETE FROM fees_assign WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Assignment not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees assignment deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteFeesAssignment:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const getFeesAssignments = async (req, res) => {
    try {
        const academicYearId = parseInt(req.query.academic_year_id, 10);
        const classId = req.query.class_id;

        if (isNaN(academicYearId)) {
            return res.status(400).json({ status: 'ERROR', message: 'academic_year_id is required and must be a number' });
        }

        let whereClause = 'WHERE fa.academic_year_id = $1';
        let params = [academicYearId];

        if (classId && classId !== 'All') {
            whereClause += ' AND fa.class_id = $2';
            params.push(parseInt(classId, 10));
        }

        const result = await query(
            `WITH detail_paid AS (
                SELECT
                    fcd.fees_assign_details_id,
                    COALESCE(SUM(fcd.paid_amount::numeric), 0) AS paid_amount
                FROM fees_collect_details fcd
                GROUP BY fcd.fees_assign_details_id
            ),
            detail_status AS (
                SELECT
                    fa.id AS fees_assign_id,
                    fad.id AS fees_assign_details_id,
                    fm.fees_type_id,
                    COALESCE(fad.amount::numeric, 0) AS assigned_amount,
                    COALESCE(dp.paid_amount, 0) AS paid_amount,
                    GREATEST(COALESCE(fad.amount::numeric, 0) - COALESCE(dp.paid_amount, 0), 0) AS pending_amount
                FROM fees_assign fa
                INNER JOIN fees_assign_details fad ON fad.fees_assign_id = fa.id
                LEFT JOIN detail_paid dp ON dp.fees_assign_details_id = fad.id
                LEFT JOIN fees_master fm ON fm.id = fad.fees_master_id
                ${whereClause}
            ),
            assign_rollup AS (
                SELECT
                    ds.fees_assign_id,
                    COALESCE(SUM(ds.assigned_amount), 0) AS total_assigned_amount,
                    COALESCE(SUM(ds.paid_amount), 0) AS total_paid_amount,
                    COALESCE(SUM(ds.pending_amount), 0) AS total_pending_amount,
                    STRING_AGG(DISTINCT ft.name, ', ' ORDER BY ft.name)
                        FILTER (WHERE ds.pending_amount > 0) AS pending_fees_type_name
                FROM detail_status ds
                LEFT JOIN fees_types ft ON ft.id = ds.fees_type_id
                GROUP BY ds.fees_assign_id
            )
            SELECT
                fa.*,
                COALESCE(s.first_name || ' ' || COALESCE(s.last_name, ''), 'Unknown Student') as student_name,
                s.admission_number,
                COALESCE(c.class_name, 'No Class') as class_name,
                s.section_id,
                COALESCE(sec.section_name, '-') as section_name,
                COALESCE(fg.name, 'Unknown Group') as fees_group_name,
                COALESCE(s.gender, 'All') as gender,
                COALESCE(cast_t.cast_name, 'All') as category,
                COALESCE(ar.total_pending_amount, 0) AS total_amount,
                COALESCE(ar.total_assigned_amount, 0) AS total_assigned_amount,
                COALESCE(ar.total_paid_amount, 0) AS total_paid_amount,
                COALESCE(ar.pending_fees_type_name, 'Unknown Type') AS fees_type_name
            FROM fees_assign fa
            INNER JOIN assign_rollup ar ON ar.fees_assign_id = fa.id
            LEFT JOIN students s ON fa.student_id = s.id
            LEFT JOIN classes c ON fa.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            LEFT JOIN fees_groups fg ON fa.fees_group_id = fg.id
            LEFT JOIN casts cast_t ON s.cast_id = cast_t.id
            WHERE ar.total_pending_amount > 0
            ORDER BY c.class_name ASC, s.first_name ASC`,
            params
        );

        res.status(200).json({
            status: 'SUCCESS',
            data: result.rows
        });
    } catch (error) {
        console.error('Error in getFeesAssignments:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            message: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    assignFees,
    getFeesAssignments,
    deleteFeesAssignment
};
