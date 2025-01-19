import { supabase } from '../supabaseClient.js';
import { validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';

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

const bibliothequeController = {
  televerserDocument: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { nom, matiere, anneeEtude, confidentialite } = req.body;
      const fichier = req.file;

      if (!fichier) {
        return res.status(400).json({
          statut: 'erreur',
          message: 'Aucun fichier téléchargé'
        });
      }

      // Télécharger le fichier sur Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bibliotheque')
        .upload(`documents/${fichier.filename}`, fichier);

      if (uploadError) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors du téléchargement du fichier',
          details: uploadError.message
        });
      }

      // Insérer les métadonnées du document dans la base de données
      const { data, error } = await supabase
        .from('documents')
        .insert({
          nom,
          matiere,
          annee_etude: anneeEtude,
          confidentialite: confidentialite || 'prive',
          chemin_fichier: uploadData.path,
          ajoute_par: req.etudiant.id
        })
        .select();

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de l\'ajout du document',
          details: error.message
        });
      }

      res.status(201).json({
        statut: 'succès',
        message: 'Document ajouté avec succès',
        document: data[0]
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de l\'ajout du document',
        details: error.message
      });
    }
  },

  listerDocuments: async (req, res) => {
    try {
      const { matiere, anneeEtude, confidentialite, recherche } = req.query;

      let query = supabase.from('documents').select('*');

      if (matiere) query = query.eq('matiere', matiere);
      if (anneeEtude) query = query.eq('annee_etude', anneeEtude);
      if (confidentialite) query = query.eq('confidentialite', confidentialite);
      if (recherche) {
        query = query.or(
          `nom.ilike.%${recherche}%`
        );
      }

      const { data: documents, error } = await query;

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la récupération des documents',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        documents
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la récupération des documents',
        details: error.message
      });
    }
  },

  telechargerDocument: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { id } = req.params;

      const { data: document, error: documentError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (documentError) {
        return res.status(404).json({
          statut: 'erreur',
          message: 'Document non trouvé',
          details: documentError.message
        });
      }

      // Vérifier les permissions de téléchargement
      if (
        document.confidentialite === 'prive' && 
        document.ajoute_par !== req.etudiant.id
      ) {
        return res.status(403).json({
          statut: 'erreur',
          message: 'Vous n\'êtes pas autorisé à télécharger ce document'
        });
      }

      // Récupérer l'URL de téléchargement
      const { data: { publicUrl }, error: urlError } = supabase.storage
        .from('bibliotheque')
        .getPublicUrl(document.chemin_fichier);

      if (urlError) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la génération de l\'URL de téléchargement',
          details: urlError.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        url: publicUrl
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors du téléchargement du document',
        details: error.message
      });
    }
  },

  supprimerDocument: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { id } = req.params;

      // Vérifier l'existence et les permissions
      const { data: document, error: documentError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .eq('ajoute_par', req.etudiant.id)
        .single();

      if (documentError || !document) {
        return res.status(403).json({
          statut: 'erreur',
          message: 'Vous n\'êtes pas autorisé à supprimer ce document'
        });
      }

      // Supprimer le fichier du stockage
      const { error: storageError } = await supabase.storage
        .from('bibliotheque')
        .remove([document.chemin_fichier]);

      if (storageError) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la suppression du fichier',
          details: storageError.message
        });
      }

      // Supprimer les métadonnées de la base de données
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la suppression du document',
          details: deleteError.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        message: 'Document supprimé avec succès'
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la suppression du document',
        details: error.message
      });
    }
  },

  rechercheAvancee: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { 
        motsCles, 
        matieres, 
        anneeEtudes, 
        tags, 
        confidentialite 
      } = req.body;

      let query = supabase.from('documents').select('*');

      // Filtres optionnels
      if (motsCles && motsCles.length > 0) {
        query = query.or(
          motsCles.map(mot => `nom.ilike.%${mot}%`).join(',')
        );
      }

      if (matieres && matieres.length > 0) {
        query = query.in('matiere', matieres);
      }

      if (anneeEtudes && anneeEtudes.length > 0) {
        query = query.in('annee_etude', anneeEtudes);
      }

      // Hypothèse : ajout d'une colonne 'tags' dans la table 'documents'
      if (tags && tags.length > 0) {
        query = query.or(
          tags.map(tag => `tags.ilike.%${tag}%`).join(',')
        );
      }

      if (confidentialite) {
        query = query.eq('confidentialite', confidentialite);
      }

      const { data: documents, error } = await query;

      if (error) {
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors de la recherche de documents',
          details: error.message
        });
      }

      res.status(200).json({
        statut: 'succès',
        documents
      });
    } catch (error) {
      res.status(500).json({
        statut: 'erreur',
        message: 'Erreur lors de la recherche de documents',
        details: error.message
      });
    }
  }
};

export default bibliothequeController;