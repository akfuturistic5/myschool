const { query } = require('../config/database');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

const getFeesTypes = async (req, res) => {
    try {
        const { academic_year_id } = req.query;
        
        const result = await query(`
            SELECT ft.*, 
                   COALESCE(STRING_AGG(DISTINCT fg.name, ', '), '') as group_names,
                   COALESCE(ARRAY_AGG(DISTINCT fg.id) FILTER (WHERE fg.id IS NOT NULL), '{}') as group_ids
            FROM fees_types ft
            LEFT JOIN fees_master fm ON ft.id = fm.fees_type_id ${academic_year_id ? 'AND fm.academic_year_id = $1' : ''}
            LEFT JOIN fees_groups fg ON fm.fees_group_id = fg.id
            GROUP BY ft.id
            ORDER BY ft.name ASC
        `, academic_year_id ? [academic_year_id] : []);
        
        res.status(200).json({
            status: 'SUCCESS',
            data: result.rows
        });
    } catch (error) {
        console.error('Error in getFeesTypes:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const createFeesType = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { name, code, description, status } = req.body;
        if (!name) {
            return res.status(400).json({ status: 'ERROR', message: 'Name is required' });
        }

        const result = await query(
            'INSERT INTO fees_types (name, code, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, code, description, status || 'Active']
        );

        res.status(201).json({
            status: 'SUCCESS',
            message: 'Fees type created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in createFeesType:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const updateFeesType = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;
        const { name, code, description, status } = req.body;

        const result = await query(
            'UPDATE fees_types SET name = $1, code = $2, description = $3, status = $4, modified_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
            [name, code, description, status || 'Active', id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Fees type not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees type updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in updateFeesType:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const deleteFeesType = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const { id } = req.params;

        // Check if type is used in master
        const checkMaster = await query('SELECT id FROM fees_master WHERE fees_type_id = $1 LIMIT 1', [id]);
        if (checkMaster.rowCount > 0) {
            return res.status(400).json({ status: 'ERROR', message: 'Cannot delete type that is linked to a Fees Master entry' });
        }

        const result = await query('DELETE FROM fees_types WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Fees type not found' });
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees type deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteFeesType:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

module.exports = {
    getFeesTypes,
    createFeesType,
    updateFeesType,
    deleteFeesType
};
