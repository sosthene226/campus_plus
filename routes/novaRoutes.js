import express from 'express';
import { body, param } from 'express-validator';
import novaController from '../controllers/novaController.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Liste exhaustive des filières
const FILIERES = [
    // Sciences Juridiques
    'droit', 'droit_public', 'droit_prive', 'droit_international', 
    'droit_des_affaires', 'droit_du_travail',

    // Sciences de Gestion
    'gestion', 'management', 'ressources_humaines', 'finance', 
    'comptabilite', 'marketing', 'commerce_international', 
    'entrepreneuriat', 'gestion_de_projet',

    // Sciences et Technologies
    'informatique', 'cybersecurite', 'reseaux', 'intelligence_artificielle', 
    'developpement_logiciel', 'science_des_donnees', 'robotique', 
    'systemes_embarques', 'cloud_computing',

    // Sciences Médicales et Santé
    'medecine', 'pharmacie', 'odontologie', 'psychologie', 
    'infirmier', 'sage_femme', 'nutrition', 'kinesitherapie', 
    'radiologie', 'urgences_medicales',

    // Sciences Humaines et Sociales
    'sociologie', 'anthropologie', 'philosophie', 'histoire', 
    'sciences_politiques', 'relations_internationales', 
    'communication', 'journalisme',

    // Sciences Économiques
    'economie', 'economie_internationale', 'econometrie', 
    'economie_du_developpement', 'analyse_financiere',

    // Sciences de l'Ingénieur
    'ingenierie_civile', 'genie_mecanique', 'genie_electrique', 
    'genie_chimique', 'genie_environnemental', 'aeronautique', 
    'energie_renouvelable',

    // Arts et Culture
    'arts_plastiques', 'design', 'musique', 'cinema', 
    'theatre', 'arts_graphiques', 'architecture',

    // Sciences Naturelles
    'biologie', 'chimie', 'physique', 'mathematiques', 
    'geologie', 'astronomie', 'environnement',

    // Éducation
    'sciences_de_l_education', 'pedagogie', 'formation_professionnelle',

    // Agriculture et Environnement
    'agronomie', 'veterinaire', 'foresterie', 'environnement', 
    'ecologie', 'gestion_des_ressources_naturelles',

    // Langues et Littérature
    'langues_etrangeres', 'traduction', 'litterature', 
    'linguistique', 'langues_anciennes',

    // Sport et Performance
    'sciences_du_sport', 'entrainement_sportif', 'nutrition_sportive', 
    'physiologie', 'management_sportif'
];

// Route pour générer une fiche de révision
router.post('/fiche-revision', 
    authController.protegerRoute,
    [
        body('matiere')
            .trim()
            .notEmpty().withMessage('La matière est obligatoire'),
        body('difficulte')
            .isIn(['debutant', 'intermediaire', 'avance']).withMessage('Difficulté invalide'),
        body('documentIds')
            .isArray({ min: 1 }).withMessage('Au moins un document source est requis')
    ],
    novaController.genererFicheRevision
);

// Route pour générer un quiz
router.post('/quiz', 
    authController.protegerRoute,
    [
        body('matiere')
            .trim()
            .notEmpty().withMessage('La matière est obligatoire'),
        body('difficulte')
            .isIn(['debutant', 'intermediaire', 'avance']).withMessage('Difficulté invalide'),
        body('documentIds')
            .isArray({ min: 1 }).withMessage('Au moins un document source est requis')
    ],
    novaController.genererQuiz
);

// Route pour le chatbot conversationnel
router.post('/chat', 
    authController.protegerRoute,
    [
        body('message')
            .trim()
            .notEmpty().withMessage('Le message est obligatoire'),
        body('contexte.documentIds')
            .optional()
            .isArray().withMessage('Les IDs de documents doivent être un tableau'),
        body('contexte.matiere')
            .optional()
            .trim()
    ],
    novaController.conversationChat
);

// Route pour générer un cas pratique
router.post('/cas-pratique', 
    authController.protegerRoute,
    [
        body('filiere')
            .trim()
            .notEmpty().withMessage('La filière est obligatoire')
            .custom((value) => {
                if (!FILIERES.includes(value)) {
                    throw new Error('Filière non supportée');
                }
                return true;
            }),
        body('anneeEtude')
            .isInt({ min: 1, max: 5 })
            .withMessage('Année d\'étude invalide'),
        body('niveauDifficulte')
            .optional()
            .isIn(['debutant', 'intermediaire', 'avance'])
            .withMessage('Niveau de difficulté invalide'),
        body('documentIds')
            .optional()
            .isArray().withMessage('Les IDs de documents doivent être un tableau')
    ],
    novaController.genererCasPratique
);

// Route pour récupérer une ressource NOVA générée
router.get('/ressource/:id', 
    authController.protegerRoute,
    [
        param('id')
            .isMongoId().withMessage('ID de ressource invalide')
    ],
    async (req, res) => {
        try {
            const ressource = await NovaRessource.findOne({
                _id: req.params.id,
                etudiant: req.etudiant._id
            });

            if (!ressource) {
                return res.status(404).json({
                    statut: 'erreur',
                    message: 'Ressource non trouvée'
                });
            }

            res.status(200).json({
                statut: 'succès',
                donnees: { ressource }
            });
        } catch (erreur) {
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la récupération de la ressource',
                details: erreur.message
            });
        }
    }
);

// Route pour lister les ressources NOVA
router.get('/ressources', 
    authController.protegerRoute,
    async (req, res) => {
        try {
            const { type, matiere } = req.query;

            const filtre = { etudiant: req.etudiant._id };
            if (type) filtre.type = type;
            if (matiere) filtre.matiere = matiere;

            const ressources = await NovaRessource.find(filtre)
                .sort({ 'metadonnees.dateCreation': -1 });

            res.status(200).json({
                statut: 'succès',
                donnees: {
                    ressources,
                    total: ressources.length
                }
            });
        } catch (erreur) {
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la récupération des ressources',
                details: erreur.message
            });
        }
    }
);

export default router;
