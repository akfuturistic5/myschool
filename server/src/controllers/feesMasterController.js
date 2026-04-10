const { query } = require('../config/database');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

const getFeesMaster = async (req, res) => {
    try {
        const academicYearId = req.query.academic_year_id;
        if (!academicYearId) {
            return res.status(400).json({ status: 'ERROR', message: 'academic_year_id is required' });
        }

        const result = await query(
            `SELECT fm.*, fg.name as fees_group_name, ft.name as fees_type_name
             FROM fees_master fm
             JOIN fees_groups fg ON fm.fees_group_id = fg.id
             JOIN fees_types ft ON fm.fees_type_id = ft.id
             WHERE fm.academic_year_id = $1
             ORDER BY fg.name ASC, ft.name ASC`,
            [academicYearId]
        );

        res.status(200).json({
            status: 'SUCCESS',
            data: result.rows
        });
    } catch (error) {
        console.error('Error in getFeesMaster:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const createFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { fees_group_id, fees_type_id, amount, academic_year_id, status, due_date, fine_type, fine_amount, fine_percentage } = req.body;
        if (!fees_group_id || !fees_type_id || amount === undefined || !academic_year_id) {
            return res.status(400).json({ status: 'ERROR', message: 'fees_group_id, fees_type_id, amount, and academic_year_id are required' });
        }

        const result = await query(
            'INSERT INTO fees_master (fees_group_id, fees_type_id, amount, academic_year_id, status, due_date, fine_type, fine_amount, fine_percentage) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [fees_group_id, fees_type_id, amount, academic_year_id, status || 'Active', due_date || null, fine_type || 'None', fine_amount || 0, fine_percentage || 0]
        );

        res.status(201).json({
            status: 'SUCCESS',
            message: 'Fees master entry created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ status: 'ERROR', message: 'This Fees Type is already mapped to this Fees Group for this Academic Year' });
        }
        console.error('Error in createFeesMaster:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const updateFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;
        const { amount, status, due_date, fine_type, fine_amount, fine_percentage } = req.body;

        const result = await query(
            'UPDATE fees_master SET amount = $1, status = $2, due_date = $3, fine_type = $4, fine_amount = $5, fine_percentage = $6, modified_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
            [amount, status || 'Active', due_date || null, fine_type || 'None', fine_amount || 0, fine_percentage || 0, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Fees master entry not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees master entry updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in updateFeesMaster:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const deleteFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;

        // Check if master entry is assigned
        const checkAssign = await query('SELECT id FROM fees_assign_details WHERE fees_master_id = $1 LIMIT 1', [id]);
        if (checkAssign.rowCount > 0) {
            return res.status(400).json({ status: 'ERROR', message: 'Cannot delete Fees Master entry that is already assigned to students' });
        }

        const result = await query('DELETE FROM fees_master WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Fees master entry not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees master entry deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteFeesMaster:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

module.exports = {
    getFeesMaster,
    createFeesMaster,
    updateFeesMaster,
    deleteFeesMaster
};
