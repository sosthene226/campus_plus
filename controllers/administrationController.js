import { supabase } from '../supabaseClient.js';
import { validationResult } from 'express-validator';

export const listerEtudiants = async (req, res) => {
  try {
    const { 
      filiere, 
      anneeEtude, 
      recherche 
    } = req.query;

    let query = supabase.from('etudiants').select('*');

    if (filiere) query = query.eq('filiere', filiere);
    if (anneeEtude) query = query.eq('annee_etude', anneeEtude);
    if (recherche) {
      query = query.or(
        `nom.ilike.%${recherche}%,prenom.ilike.%${recherche}%,email.ilike.%${recherche}%`
      );
    }

    const { data: etudiants, error } = await query;

    if (error) throw error;

    res.status(200).json({
      statut: 'succès',
      etudiants
    });
  } catch (error) {
    res.status(500).json({
      statut: 'erreur',
      message: 'Erreur lors de la récupération des étudiants',
      details: error.message
    });
  }
};

export const supprimerEtudiant = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier les permissions d'administration
    if (req.etudiant.role !== 'admin') {
      return res.status(403).json({
        statut: 'erreur',
        message: 'Accès non autorisé'
      });
    }

    // Supprimer l'étudiant de Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(id);

    if (authError) throw authError;

    // Supprimer l'entrée de la table etudiants
    const { error } = await supabase
      .from('etudiants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      statut: 'succès',
      message: 'Étudiant supprimé avec succès'
    });
  } catch (error) {
    res.status(500).json({
      statut: 'erreur',
      message: 'Erreur lors de la suppression de l\'étudiant',
      details: error.message
    });
  }
};

export const modifierRoleEtudiant = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Vérifier les permissions d'administration
    if (req.etudiant.role !== 'admin') {
      return res.status(403).json({
        statut: 'erreur',
        message: 'Accès non autorisé'
      });
    }

    const { data, error } = await supabase
      .from('etudiants')
      .update({ role })
      .eq('id', id)
      .select();

    if (error) throw error;

    res.status(200).json({
      statut: 'succès',
      message: 'Rôle de l\'étudiant mis à jour',
      etudiant: data[0]
    });
  } catch (error) {
    res.status(500).json({
      statut: 'erreur',
      message: 'Erreur lors de la modification du rôle',
      details: error.message
    });
  }
};

export const genererRapportUtilisation = async (req, res) => {
  try {
    // Vérifier les permissions d'administration
    if (req.etudiant.role !== 'admin') {
      return res.status(403).json({
        statut: 'erreur',
        message: 'Accès non autorisé'
      });
    }

    // Récupérer des statistiques d'utilisation
    const { count: totalEtudiants, error: etudiantError } = await supabase
      .from('etudiants')
      .select('*', { count: 'exact' });

    const { count: totalGroupes, error: groupeError } = await supabase
      .from('groupes')
      .select('*', { count: 'exact' });

    const { count: totalDocuments, error: documentError } = await supabase
      .from('documents')
      .select('*', { count: 'exact' });

    if (etudiantError || groupeError || documentError) {
      throw new Error('Erreur lors de la génération du rapport');
    }

    res.status(200).json({
      statut: 'succès',
      rapport: {
        totalEtudiants,
        totalGroupes,
        totalDocuments
      }
    });
  } catch (error) {
    res.status(500).json({
      statut: 'erreur',
      message: 'Erreur lors de la génération du rapport',
      details: error.message
    });
  }
};