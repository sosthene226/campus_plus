import express from 'express';
import { body, query, param } from 'express-validator';
import multer from 'multer';
import bibliothequeController from '../controllers/bibliothequeController.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Configuration de multer
const upload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/bibliotheque/');
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});

// Route pour téléverser un document
router.post('/', 
    authController.protegerRoute,
    upload.single('fichier'), // Middleware multer pour gérer le fichier
    [
        body('nom')
            .trim()
            .notEmpty().withMessage('Le nom du document est obligatoire')
            .isLength({ max: 100 }).withMessage('Le nom ne doit pas dépasser 100 caractères'),
        body('matiere')
            .trim()
            .notEmpty().withMessage('La matière est obligatoire'),
        body('anneeEtude')
            .isIn(['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat']).withMessage('Année d\'étude invalide'),
        body('confidentialite')
            .optional()
            .isIn(['prive', 'partage_groupe', 'public']).withMessage('Confidentialité invalide')
    ],
    bibliothequeController.televerserDocument
);

// Route pour lister les documents
router.get('/', 
    authController.protegerRoute,
    [
        query('matiere')
            .optional()
            .trim(),
        query('anneeEtude')
            .optional()
            .isIn(['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat']).withMessage('Année d\'étude invalide'),
        query('confidentialite')
            .optional()
            .isIn(['prive', 'partage_groupe', 'public']).withMessage('Confidentialité invalide'),
        query('recherche')
            .optional()
            .trim()
    ],
    bibliothequeController.listerDocuments
);

// Route pour télécharger un document
router.get('/telecharger/:id', 
    authController.protegerRoute,
    [
        param('id')
            .isMongoId().withMessage('ID de document invalide')
    ],
    bibliothequeController.telechargerDocument
);

// Route pour supprimer un document
router.delete('/:id', 
    authController.protegerRoute,
    [
        param('id')
            .isMongoId().withMessage('ID de document invalide')
    ],
    bibliothequeController.supprimerDocument
);

// Route pour recherche avancée
router.post('/recherche', 
    authController.protegerRoute,
    [
        body('motsCles')
            .optional()
            .isArray().withMessage('Mots-clés doivent être un tableau'),
        body('matieres')
            .optional()
            .isArray().withMessage('Matières doivent être un tableau'),
        body('anneeEtudes')
            .optional()
            .isArray().withMessage('Années d\'étude doivent être un tableau'),
        body('tags')
            .optional()
            .isArray().withMessage('Tags doivent être un tableau'),
        body('confidentialite')
            .optional()
            .isIn(['prive', 'partage_groupe', 'public']).withMessage('Confidentialité invalide')
    ],
    bibliothequeController.rechercheAvancee
);

export default router;