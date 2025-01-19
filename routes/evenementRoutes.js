import express from 'express';
import { body, query, param } from 'express-validator';
import evenementController from '../controllers/evenementController.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Route pour créer un événement
router.post('/', 
    authController.protegerRoute,
    [
        body('titre')
            .trim()
            .notEmpty().withMessage('Le titre est obligatoire')
            .isLength({ max: 100 }).withMessage('Le titre ne doit pas dépasser 100 caractères'),
        body('type')
            .isIn(['cours', 'examen', 'devoir', 'autre']).withMessage('Type d\'événement invalide'),
        body('dateDebut')
            .isISO8601().withMessage('Date de début invalide')
            .toDate(),
        body('dateFin')
            .optional()
            .isISO8601().withMessage('Date de fin invalide')
            .toDate(),
        body('priorite')
            .optional()
            .isIn(['basse', 'normale', 'haute', 'critique']).withMessage('Priorité invalide')
    ],
    evenementController.creerEvenement
);

// Route pour lister les événements
router.get('/', 
    authController.protegerRoute,
    [
        query('debut')
            .optional()
            .isISO8601().withMessage('Date de début invalide'),
        query('fin')
            .optional()
            .isISO8601().withMessage('Date de fin invalide'),
        query('type')
            .optional()
            .isIn(['cours', 'examen', 'devoir', 'autre']).withMessage('Type d\'événement invalide')
    ],
    evenementController.listerEvenements
);

// Route pour modifier un événement
router.patch('/:id', 
    authController.protegerRoute,
    [
        param('id')
            .isMongoId().withMessage('ID d\'événement invalide'),
        body('titre')
            .optional()
            .trim()
            .notEmpty().withMessage('Le titre est obligatoire')
            .isLength({ max: 100 }).withMessage('Le titre ne doit pas dépasser 100 caractères'),
        body('type')
            .optional()
            .isIn(['cours', 'examen', 'devoir', 'autre']).withMessage('Type d\'événement invalide'),
        body('dateDebut')
            .optional()
            .isISO8601().withMessage('Date de début invalide')
            .toDate(),
        body('dateFin')
            .optional()
            .isISO8601().withMessage('Date de fin invalide')
            .toDate(),
        body('priorite')
            .optional()
            .isIn(['basse', 'normale', 'haute', 'critique']).withMessage('Priorité invalide')
    ],
    evenementController.mettreAJourEvenement
);

// Route pour supprimer un événement
router.delete('/:id', 
    authController.protegerRoute,
    [
        param('id')
            .isMongoId().withMessage('ID d\'événement invalide')
    ],
    evenementController.supprimerEvenement
);

// Route pour générer les rappels
router.get('/rappels', 
    authController.protegerRoute,
    evenementController.genererRappels
);

export default router;