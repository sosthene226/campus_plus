import { supabase } from '../supabaseClient.js';
import { validationResult } from 'express-validator';

const abonnementController = {
  creerAbonnement: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { type, duree, prix } = req.body;

      const { data, error } = await supabase
        .from('abonnements')
        .insert({
          type,
          duree,
          prix,
        });

      if (error) {
        return res.status(500).json({ 
          statut: 'erreur', 
          message: 'Erreur lors de la création de l\'abonnement' 
        });
      }

      return res.status(201).json({ 
        statut: 'succès', 
        message: 'Abonnement créé avec succès',
        donnees: data 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  },
  
  verifierPeriodeEssai: async (req, res) => {
    try {
      const userId = req.user.id;

      const { data, error } = await supabase
        .from('utilisateurs')
        .select('periode_essai, date_debut_essai')
        .eq('id', userId)
        .single();

      if (error) {
        return res.status(500).json({ 
          statut: 'erreur', 
          message: 'Erreur lors de la vérification de la période d\'essai' 
        });
      }

      if (!data.periode_essai) {
        return res.status(200).json({ 
          statut: 'succès', 
          message: 'Aucune période d\'essai active' 
        });
      }

      const dateDebutEssai = new Date(data.date_debut_essai);
      const dateActuelle = new Date();
      const dureeEssai = 7; // 7 jours

      const differenceJours = Math.floor((dateActuelle - dateDebutEssai) / (1000 * 60 * 60 * 24));

      if (differenceJours > dureeEssai) {
        await supabase
          .from('utilisateurs')
          .update({ periode_essai: false })
          .eq('id', userId);

        return res.status(200).json({ 
          statut: 'expiré', 
          message: 'La période d\'essai a expiré' 
        });
      }

      return res.status(200).json({ 
        statut: 'actif', 
        message: 'Période d\'essai toujours active',
        joursRestants: dureeEssai - differenceJours 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  },
  
  initialiserPaiement: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { typeAbonnement, methodePaiement, phoneNumber } = req.body;
      const userId = req.user.id;

      const { data, error } = await supabase
        .from('paiements')
        .insert({
          utilisateur_id: userId,
          type_abonnement: typeAbonnement,
          methode_paiement: methodePaiement,
          numero_telephone: phoneNumber,
          statut: 'en_attente'
        })
        .select();

      if (error) {
        return res.status(500).json({ 
          statut: 'erreur', 
          message: 'Erreur lors de l\'initialisation du paiement' 
        });
      }

      return res.status(201).json({ 
        statut: 'succès', 
        message: 'Paiement initialisé avec succès',
        transactionId: data[0].id 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  },
  
  confirmerPaiement: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { transactionId, otp } = req.body;
      const userId = req.user.id;

      // Vérifier l'OTP (à implémenter selon votre logique)
      const otpValide = await verifierOTP(userId, otp);

      if (!otpValide) {
        return res.status(400).json({ 
          statut: 'erreur', 
          message: 'OTP invalide' 
        });
      }

      const { data, error } = await supabase
        .from('paiements')
        .update({ statut: 'confirme' })
        .eq('id', transactionId)
        .eq('utilisateur_id', userId);

      if (error) {
        return res.status(500).json({ 
          statut: 'erreur', 
          message: 'Erreur lors de la confirmation du paiement' 
        });
      }

      return res.status(200).json({ 
        statut: 'succès', 
        message: 'Paiement confirmé avec succès' 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  },
  
  consulterAbonnement: async (req, res) => {
    try {
      const userId = req.user.id;

      const { data, error } = await supabase
        .from('abonnements')
        .select('*')
        .eq('utilisateur_id', userId)
        .single();

      if (error) {
        return res.status(500).json({ 
          statut: 'erreur', 
          message: 'Erreur lors de la consultation de l\'abonnement' 
        });
      }

      if (!data) {
        return res.status(404).json({ 
          statut: 'erreur', 
          message: 'Aucun abonnement trouvé' 
        });
      }

      return res.status(200).json({ 
        statut: 'succès', 
        abonnement: data 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  },
  
  resilierAbonnement: async (req, res) => {
    try {
      const userId = req.user.id;

      const { data, error } = await supabase
        .from('abonnements')
        .delete()
        .eq('utilisateur_id', userId);

      if (error) {
        return res.status(500).json({ 
          statut: 'erreur', 
          message: 'Erreur lors de la résiliation de l\'abonnement' 
        });
      }

      return res.status(200).json({ 
        statut: 'succès', 
        message: 'Abonnement résilié avec succès' 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  }
};

export default abonnementController;