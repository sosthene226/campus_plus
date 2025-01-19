import express from 'express';
import { body, param } from 'express-validator';
import abonnementController from '../controllers/abonnementController.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Vérifier la période d'essai
router.get('/essai', 
    authController.protegerRoute,
    abonnementController.verifierPeriodeEssai
);

// Initialiser un paiement
router.post('/initialiser-paiement', 
    authController.protegerRoute,
    [
        body('typeAbonnement')
            .isIn(['mensuel', 'trimestriel', 'annuel'])
            .withMessage('Type d\'abonnement invalide'),
        body('methodePaiement')
            .isIn(['orange_money', 'moov_money', 'telecel_money'])
            .withMessage('Méthode de paiement non supportée'),
        body('phoneNumber')
            .isMobilePhone('any')
            .withMessage('Numéro de téléphone invalide')
    ],
    abonnementController.initialiserPaiement
);

// Confirmer un paiement
router.post('/confirmer-paiement', 
    authController.protegerRoute,
    [
        body('transactionId')
            .notEmpty()
            .withMessage('ID de transaction requis'),
        body('otp')
            .isLength({ min: 6, max: 6 })
            .withMessage('Code OTP invalide')
    ],
    abonnementController.confirmerPaiement
);

// Consulter l'abonnement actuel
router.get('/consulter', 
    authController.protegerRoute,
    abonnementController.consulterAbonnement
);

// Résilier l'abonnement
router.post('/resilier', 
    authController.protegerRoute,
    abonnementController.resilierAbonnement
);

export default router;