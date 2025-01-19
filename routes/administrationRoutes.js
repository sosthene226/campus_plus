import express from 'express';
const router = express.Router();
import administrationController from '../controllers/administrationController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import administrationMiddleware from '../middlewares/administrationMiddleware.js';

// Middleware pour s'assurer que seul un administrateur peut accéder à ces routes
router.use(authMiddleware.verifierToken);
router.use(administrationMiddleware.verifierRoleAdministration);

// Routes pour les Informations
router.post('/informations', 
    administrationController.creerInformation
);

router.get('/informations', 
    administrationController.listerInformations
);

// Routes pour l'Emploi du Temps
router.post('/emploi-du-temps', 
    administrationController.uploaderEmploiDuTemps
);

router.get('/emploi-du-temps', 
    administrationController.listerEmploiDuTemps
);

// Routes pour les Groupes de Classe
router.get('/groupes-classe', 
    administrationController.listerGroupesClasse
);

router.post('/groupes-classe/:groupeId/message', 
    administrationController.envoyerMessageGroupe
);

router.put('/groupes-classe/:groupeId/membres', 
    administrationController.gererMembresGroupe
);
export default router;
