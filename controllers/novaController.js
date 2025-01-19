import { supabase } from '../supabaseClient.js';
import { validationResult } from 'express-validator';

const novaController = {
  creerNova: async (req, res) => {
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
        categorie, 
        objectifs, 
        competencesRequises 
      } = req.body;

      const { data, error } = await supabase
        .from('novas')
        .insert({
          titre,
          description,
          categorie,
          objectifs: JSON.stringify(objectifs),
          competences_requises: JSON.stringify(competencesRequises),
          cree_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la création du Nova',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Nova créé avec succès',
        nova: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la création du Nova',
        details: error.message
      });
    }
  },

  listerNovas: async (req, res) => {
    try {
      const { categorie, recherche } = req.query;

      let query = supabase.from('novas').select('*');

      if (categorie) query = query.eq('categorie', categorie);
      if (recherche) {
        query = query.or(
          `titre.ilike.%${recherche}%,description.ilike.%${recherche}%`
        );
      }

      const { data: novas, error } = await query;

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la récupération des Novas',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        novas
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la récupération des Novas',
        details: error.message
      });
    }
  },

  rejoindreNova: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { id } = req.params;

      // Vérifier si le Nova existe
      const { data: nova, error: novaError } = await supabase
        .from('novas')
        .select('*')
        .eq('id', id)
        .single();

      if (novaError || !nova) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Nova non trouvé'
        });
      }

      // Vérifier si l'étudiant est déjà membre
      const { data: existingMember, error: memberError } = await supabase
        .from('nova_membres')
        .select('*')
        .eq('nova_id', id)
        .eq('etudiant_id', req.etudiant.id)
        .single();

      if (memberError) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la vérification de l\'adhésion',
          details: memberError.message
        });
      }

      if (existingMember) {
        return res.status(400).json({
          statut: 'erreur',
          message: 'Vous êtes déjà membre de ce Nova'
        });
      }

      // Ajouter l'étudiant comme membre
      const { data, error } = await supabase
        .from('nova_membres')
        .insert({
          nova_id: id,
          etudiant_id: req.etudiant.id,
          role: 'membre'
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la participation au Nova',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Participation au Nova réussie',
        membre: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la participation au Nova',
        details: error.message
      });
    }
  },

  quitterNova: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { id } = req.params;

      // Vérifier si le Nova existe
      const { data: nova, error: novaError } = await supabase
        .from('novas')
        .select('*')
        .eq('id', id)
        .single();

      if (novaError || !nova) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Nova non trouvé'
        });
      }

      // Supprimer l'étudiant des membres
      const { error } = await supabase
        .from('nova_membres')
        .delete()
        .eq('nova_id', id)
        .eq('etudiant_id', req.etudiant.id);

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la sortie du Nova',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Sortie du Nova réussie'
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la sortie du Nova',
        details: error.message
      });
    }
  },

  detailsNova: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { id } = req.params;

      // Récupérer les détails du Nova
      const { data: nova, error: novaError } = await supabase
        .from('novas')
        .select(`
          *,
          nova_membres (
            etudiant_id,
            role
          )
        `)
        .eq('id', id)
        .single();

      if (novaError || !nova) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Nova non trouvé'
        });
      }

      // Vérifier si l'étudiant est membre
      const estMembre = nova.nova_membres.some(
        membre => membre.etudiant_id === req.etudiant.id
      );

      // Préparer la réponse
      const novaDetails = {
        ...nova,
        membres: nova.nova_membres.length,
        estMembre
      };

      res.status(200).json({
        statut: 'succès',
        nova: novaDetails
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la récupération des détails du Nova',
        details: error.message
      });
    }
  },

  genererFicheRevision: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { matiere, difficulte, documentIds } = req.body;

      // Logique de génération de fiche de révision
      // À implémenter selon vos besoins spécifiques
      const { data, error } = await supabase
        .from('nova_ressources')
        .insert({
          type: 'fiche_revision',
          matiere,
          difficulte,
          documents_sources: documentIds,
          cree_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la génération de la fiche de révision',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Fiche de révision générée avec succès',
        ressource: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la génération de la fiche de révision',
        details: error.message
      });
    }
  },

  genererQuiz: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { matiere, difficulte, documentIds } = req.body;

      // Logique de génération de quiz
      // À implémenter selon vos besoins spécifiques
      const { data, error } = await supabase
        .from('nova_ressources')
        .insert({
          type: 'quiz',
          matiere,
          difficulte,
          documents_sources: documentIds,
          cree_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la génération du quiz',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Quiz généré avec succès',
        ressource: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la génération du quiz',
        details: error.message
      });
    }
  },

  conversationChat: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { message, contexte } = req.body;

      // Logique de conversation avec le chatbot
      // À implémenter selon vos besoins spécifiques
      const { data, error } = await supabase
        .from('nova_conversations')
        .insert({
          message,
          contexte: JSON.stringify(contexte),
          cree_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la conversation avec le chatbot',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Message envoyé avec succès',
        conversation: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la conversation avec le chatbot',
        details: error.message
      });
    }
  },

  genererCasPratique: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { filiere, anneeEtude, niveauDifficulte, documentIds } = req.body;

      // Logique de génération de cas pratique
      // À implémenter selon vos besoins spécifiques
      const { data, error } = await supabase
        .from('nova_ressources')
        .insert({
          type: 'cas_pratique',
          filiere,
          annee_etude: anneeEtude,
          niveau_difficulte: niveauDifficulte,
          documents_sources: documentIds,
          cree_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la génération du cas pratique',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Cas pratique généré avec succès',
        ressource: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la génération du cas pratique',
        details: error.message
      });
    }
  }
};

export default novaController;