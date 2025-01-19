import express from 'express';
import { body } from 'express-validator';
import profilController from '../controllers/profilController.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Route pour récupérer le profil
router.get('/me', 
    authController.protegerRoute, 
    profilController.obtenirProfil
);

// Route pour mettre à jour le profil
router.patch('/me', 
    authController.protegerRoute,
    [
        body('nom')
            .optional()
            .trim()
            .isLength({ min: 2 }).withMessage('Le nom doit faire au moins 2 caractères'),
        body('prenom')
            .optional()
            .trim()
            .isLength({ min: 2 }).withMessage('Le prénom doit faire au moins 2 caractères'),
        body('email')
            .optional()
            .trim()
            .isEmail().withMessage('Email invalide'),
        body('anneeEtude')
            .optional()
            .isIn(['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat']).withMessage('Année d\'étude invalide'),
        body('filiere')
            .optional()
            .trim()
            .notEmpty().withMessage('La filière est obligatoire')
    ],
    profilController.mettreAJourProfil
);

export default router;