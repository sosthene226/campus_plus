import { supabase } from '../supabaseClient.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const profilController = {
  obtenirProfil: async (req, res) => {
    try {
      const { data: etudiant, error } = await supabase
        .from('etudiants')
        .select('*')
        .eq('id', req.etudiant.id)
        .single();

      if (error || !etudiant) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Profil non trouvé'
        });
      }

      res.status(200).json({
        statut: 'succès',
        donnees: { etudiant }
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la récupération du profil',
        details: error.message
      });
    }
  },

  mettreAJourProfil: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          statut: 'erreur',
          erreurs: errors.array()
        });
      }

      const { nom, prenom, anneeEtude, filiere } = req.body;

      const { data, error } = await supabase
        .from('etudiants')
        .update({
          nom,
          prenom,
          annee_etude: anneeEtude,
          filiere
        })
        .eq('id', req.etudiant.id)
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la mise à jour du profil',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Profil mis à jour avec succès',
        donnees: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la mise à jour du profil',
        details: error.message
      });
    }
  },

  changerMotDePasse: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          statut: 'erreur',
          erreurs: errors.array()
        });
      }

      const { ancienMotDePasse, nouveauMotDePasse } = req.body;

      // Vérifier l'ancien mot de passe
      const { data: etudiant, error: fetchError } = await supabase
        .from('etudiants')
        .select('mot_de_passe_hache')
        .eq('id', req.etudiant.id)
        .single();

      if (fetchError || !etudiant) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Utilisateur non trouvé'
        });
      }

      const motDePasseCorrect = await bcrypt.compare(
        ancienMotDePasse, 
        etudiant.mot_de_passe_hache
      );

      if (!motDePasseCorrect) {
        return res.status(400).json({
          statut: 'erreur',
          message: 'Ancien mot de passe incorrect'
        });
      }

      // Hacher le nouveau mot de passe
      const nouveauMotDePasseHache = await bcrypt.hash(nouveauMotDePasse, 10);

      // Mettre à jour le mot de passe
      const { error } = await supabase
        .from('etudiants')
        .update({ mot_de_passe_hache: nouveauMotDePasseHache })
        .eq('id', req.etudiant.id);

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors du changement de mot de passe',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Mot de passe changé avec succès'
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors du changement de mot de passe',
        details: error.message
      });
    }
  }
};

export default profilController;