const { query } = require('../config/database');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

const getFeesGroups = async (req, res) => {
    try {
        const academicYearId = req.query.academic_year_id;
        if (!academicYearId) {
            return res.status(400).json({ status: 'ERROR', message: 'academic_year_id is required' });
        }

        const result = await query(
            'SELECT * FROM fees_groups WHERE academic_year_id = $1 ORDER BY name ASC',
            [academicYearId]
        );

        res.status(200).json({
            status: 'SUCCESS',
            data: result.rows
        });
    } catch (error) {
        console.error('Error in getFeesGroups:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const createFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { name, description, academic_year_id, status } = req.body;
        if (!name || !academic_year_id) {
            return res.status(400).json({ status: 'ERROR', message: 'Name and academic_year_id are required' });
        }

        const result = await query(
            'INSERT INTO fees_groups (name, description, academic_year_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, description, academic_year_id, status || 'Active']
        );

        res.status(201).json({
            status: 'SUCCESS',
            message: 'Fees group created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in createFeesGroup:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const updateFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;
        const { name, description, status } = req.body;

        const result = await query(
            'UPDATE fees_groups SET name = $1, description = $2, status = $3, modified_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name, description, status || 'Active', id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Fees group not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees group updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in updateFeesGroup:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const deleteFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;

        // Check if group is assigned
        const checkAssign = await query('SELECT id FROM fees_assign WHERE fees_group_id = $1 LIMIT 1', [id]);
        if (checkAssign.rowCount > 0) {
            return res.status(400).json({ status: 'ERROR', message: 'Cannot delete group that is already assigned to students' });
        }

        const result = await query('DELETE FROM fees_groups WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Fees group not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees group deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteFeesGroup:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

module.exports = {
    getFeesGroups,
    createFeesGroup,
    updateFeesGroup,
    deleteFeesGroup
};
