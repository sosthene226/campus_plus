import { supabase } from '../supabaseClient.js';
import { validationResult } from 'express-validator';

const evenementController = {
  creerEvenement: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          statut: 'erreur',
          erreurs: errors.array()
        });
      }

      const { 
        titre, 
        description, 
        dateDebut, 
        dateFin, 
        lieu, 
        type 
      } = req.body;

      const { data, error } = await supabase
        .from('evenements')
        .insert({
          titre,
          description,
          date_debut: dateDebut,
          date_fin: dateFin,
          lieu,
          type,
          cree_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la création de l\'événement',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Événement créé',
        evenement: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la création de l\'événement',
        details: error.message
      });
    }
  },

  listerEvenements: async (req, res) => {
    try {
      const { type, dateDebut, dateFin } = req.query;

      let query = supabase.from('evenements').select('*');

      if (type) query = query.eq('type', type);
      if (dateDebut) query = query.gte('date_debut', dateDebut);
      if (dateFin) query = query.lte('date_fin', dateFin);

      const { data: evenements, error } = await query;

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la récupération des événements',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        evenements
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la récupération des événements',
        details: error.message
      });
    }
  },

  detailsEvenement: async (req, res) => {
    try {
      const { id } = req.params;

      const { data: evenement, error } = await supabase
        .from('evenements')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Événement non trouvé',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        evenement
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la récupération des détails de l\'événement',
        details: error.message
      });
    }
  },

  mettreAJourEvenement: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          statut: 'erreur',
          erreurs: errors.array()
        });
      }

      const { id } = req.params;
      const { 
        titre, 
        description, 
        dateDebut, 
        dateFin, 
        lieu, 
        type 
      } = req.body;

      const { data, error } = await supabase
        .from('evenements')
        .update({
          titre,
          description,
          date_debut: dateDebut,
          date_fin: dateFin,
          lieu,
          type
        })
        .eq('id', id)
        .eq('cree_par', req.etudiant.id)
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la mise à jour de l\'événement',
          details: error.message
        });
      }

      if (data.length === 0) {
        return res.status(403).json({
          statut: 'erreur',
          message: 'Vous n\'êtes pas autorisé à modifier cet événement'
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Événement mis à jour',
        evenement: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la mise à jour de l\'événement',
        details: error.message
      });
    }
  },

  supprimerEvenement: async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('evenements')
        .delete()
        .eq('id', id)
        .eq('cree_par', req.etudiant.id);

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la suppression de l\'événement',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Événement supprimé'
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la suppression de l\'événement',
        details: error.message
      });
    }
  },

  genererRappels: async (req, res) => {
    try {
      // Récupérer les événements à venir dans les 7 prochains jours
      const dateAujourdhui = new Date();
      const dateSemaine = new Date(dateAujourdhui);
      dateSemaine.setDate(dateAujourdhui.getDate() + 7);

      const { data: rappels, error } = await supabase
        .from('evenements')
        .select('*')
        .gte('date_debut', dateAujourdhui.toISOString())
        .lte('date_debut', dateSemaine.toISOString())
        .eq('cree_par', req.etudiant.id);

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la génération des rappels',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        rappels
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la génération des rappels',
        details: error.message
      });
    }
  }
};

export default evenementController;