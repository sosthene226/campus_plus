const Abonnement = require('../models/Abonnement');
const moment = require('moment');

module.exports = async (req, res, next) => {
    try {
        // Vérifier si l'étudiant est authentifié
        if (!req.etudiant) {
            return res.status(401).json({ message: 'Non authentifié' });
        }

        // Rechercher le dernier abonnement de l'étudiant
        const abonnement = await Abonnement.findOne({ 
            etudiant: req.etudiant._id 
        }).sort({ dateDebut: -1 });

        // Si aucun abonnement n'existe, rediriger vers la souscription
        if (!abonnement) {
            return res.status(403).json({ 
                message: 'Aucun abonnement trouvé',
                action: 'souscrire'
            });
        }

        // Vérifier si la période d'essai est active
        if (abonnement.estEnPeriodeEssai()) {
            req.etudiant.abonnementActif = true;
            await req.etudiant.save();
            return next();
        }

        // Vérifier si l'abonnement est actif
        if (abonnement.estActif()) {
            req.etudiant.abonnementActif = true;
            req.etudiant.derniereVerificationAbonnement = new Date();
            await req.etudiant.save();
            return next();
        }

        // L'abonnement a expiré
        req.etudiant.abonnementActif = false;
        await req.etudiant.save();

        return res.status(403).json({ 
            message: 'Votre abonnement a expiré',
            action: 'souscrire'
        });
    } catch (error) {
        console.error('Erreur de vérification d\'abonnement', error);
        res.status(500).json({ 
            message: 'Erreur de vérification d\'abonnement', 
            error: error.message 
        });
    }
};
