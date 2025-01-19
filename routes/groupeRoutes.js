import express from 'express';
import { body, param } from 'express-validator';
import groupeController from '../controllers/groupeController.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Créer un groupe
router.post('/creer', 
    authController.protegerRoute,
    [
        body('nom')
            .trim()
            .notEmpty().withMessage('Le nom du groupe est requis')
            .isLength({ min: 3, max: 50 }).withMessage('Le nom doit faire entre 3 et 50 caractères'),
        body('type')
            .isIn(['etude', 'classe', 'projet']).withMessage('Type de groupe invalide'),
        body('matiere')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage('Matière invalide'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage('Description trop longue')
    ],
    groupeController.creerGroupe
);

// Rejoindre un groupe
router.post('/rejoindre/:groupeId', 
    authController.protegerRoute,
    [
        param('groupeId')
            .isMongoId().withMessage('ID de groupe invalide')
    ],
    groupeController.rejoindreGroupe
);

// Lister les groupes de l'étudiant
router.get('/mes-groupes', 
    authController.protegerRoute,
    groupeController.listerGroupes
);

// Supprimer un groupe
router.delete('/:groupeId', 
    authController.protegerRoute,
    [
        param('groupeId')
            .isMongoId().withMessage('ID de groupe invalide')
    ],
    groupeController.supprimerGroupe
);

// Envoyer un message dans un groupe
router.post('/:groupeId/messages', 
    authController.protegerRoute,
    [
        param('groupeId')
            .isMongoId().withMessage('ID de groupe invalide'),
        body('contenu')
            .trim()
            .notEmpty().withMessage('Le message ne peut pas être vide')
            .isLength({ max: 1000 }).withMessage('Message trop long')
    ],
    groupeController.envoyerMessage
);

// Partager un document
router.post('/:groupeId/documents', 
    authController.protegerRoute,
    [
        param('groupeId')
            .isMongoId().withMessage('ID de groupe invalide')
    ],
    groupeController.partagerDocument
);

// Créer une note collaborative
router.post('/:groupeId/notes', 
    authController.protegerRoute,
    [
        param('groupeId')
            .isMongoId().withMessage('ID de groupe invalide'),
        body('titre')
            .trim()
            .notEmpty().withMessage('Le titre est requis')
            .isLength({ min: 3, max: 100 }).withMessage('Titre invalide'),
        body('contenu')
            .optional()
            .trim()
    ],
    groupeController.creerNoteCollaborative
);

// Mettre à jour une note collaborative
router.put('/:groupeId/notes/:noteId', 
    authController.protegerRoute,
    [
        param('groupeId')
            .isMongoId().withMessage('ID de groupe invalide'),
        param('noteId')
            .isMongoId().withMessage('ID de note invalide'),
        body('contenu')
            .trim()
            .notEmpty().withMessage('Le contenu ne peut pas être vide')
    ],
    groupeController.mettreAJourNoteCollaborative
);

export default router;
