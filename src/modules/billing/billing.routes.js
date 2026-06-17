'use strict';
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const billingController = require('./billing.controller');

const router = Router();

// Endpoint for clinic owners to retrieve active plan info and subscription status
router.get('/subscription', authenticate, billingController.getSubscription);

// Endpoint for clinic owners to buy/upgrade SaaS subscriptions
router.post('/create-checkout-session', authenticate, billingController.createCheckoutSession);

// Endpoint for Stripe event integration (Public webhook)
router.post('/webhook', billingController.handleWebhook);

// Patient Invoices
router.get('/invoices', authenticate, billingController.listInvoices);
router.post('/invoices', authenticate, billingController.createInvoice);
router.put('/invoices/:id', authenticate, billingController.updateInvoice);
router.delete('/invoices/:id', authenticate, billingController.deleteInvoice);

// Patient Payments
router.get('/payments', authenticate, billingController.listPayments);
router.post('/payments', authenticate, billingController.createPayment);
router.delete('/payments/:id', authenticate, billingController.deletePayment);

// Patient Claims
router.get('/claims', authenticate, billingController.listClaims);
router.post('/claims', authenticate, billingController.createClaim);
router.put('/claims/:id', authenticate, billingController.updateClaimStatus);
router.delete('/claims/:id', authenticate, billingController.deleteClaim);

// Patient Statements
router.get('/statements', authenticate, billingController.listStatements);
router.post('/statements', authenticate, billingController.createStatement);
router.delete('/statements/:id', authenticate, billingController.deleteStatement);

module.exports = router;
