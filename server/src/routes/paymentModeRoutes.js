const express = require('express');
const router = express.Router();
const { 
    listPaymentModes, 
    getPaymentMode, 
    createPaymentMode, 
    updatePaymentMode, 
    deletePaymentMode 
} = require('../controllers/paymentModeController');
// Routes are globally protected by protectApi in server.js

router.get('/', listPaymentModes);
router.get('/:id', getPaymentMode);
router.post('/', createPaymentMode);
router.put('/:id', updatePaymentMode);
router.delete('/:id', deletePaymentMode);

module.exports = router;
