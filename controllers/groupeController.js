import { supabase } from '../supabaseClient.js'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import { validationResult } from 'express-validator'
import * as Sentry from "@sentry/node";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/groupes/')
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`)
    }
})

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const extensionsAutorisees = [
            '.pdf', '.doc', '.docx', '.txt', 
            '.jpg', '.jpeg', '.png', '.gif', 
            '.mp4', '.avi', '.mp3', '.wav'
        ]
        const extension = path.extname(file.originalname).toLowerCase()
        const tailleFichier = parseInt(req.headers['content-length'])

        if (extensionsAutorisees.includes(extension)) {
            if (tailleFichier <= 50 * 1024 * 1024) { // 50 Mo max
                cb(null, true)
            } else {
                cb(new Error('Taille du fichier trop grande'), false)
            }
        } else {
            cb(new Error('Type de fichier non autorisé'), false)
        }
    }
})

const groupeController = {
    creerGroupe: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "creer_groupe"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    statut: 'erreur', 
                    erreurs: errors.array() 
                });
            }

            const { 
                nom, 
                description, 
                matieres, 
                anneeEtude, 
                confidentialite 
            } = req.body;

            const { data, error } = await supabase
                .from('groupes')
                .insert({
                    nom,
                    description,
                    matieres: JSON.stringify(matieres),
                    annee_etude: anneeEtude,
                    confidentialite: confidentialite || 'prive',
                    cree_par: req.etudiant.id
                })
                .select();

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la création du groupe',
                    details: error.message
                });
            }

            // Ajouter le créateur comme membre du groupe
            const { error: membreError } = await supabase
                .from('membres_groupe')
                .insert({
                    groupe_id: data[0].id,
                    etudiant_id: req.etudiant.id,
                    role: 'admin'
                });

            if (membreError) {
                Sentry.captureException(membreError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', membreError.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de l\'ajout du membre',
                    details: membreError.message
                });
            }

            transaction.setData('groupe_id', data[0].id);
            transaction.setStatus('success');
            
            res.status(201).json({
                statut: 'succès',
                message: 'Groupe créé avec succès',
                groupe: data[0]
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la création du groupe',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    rejoindreGroupe: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "rejoindre_groupe"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    statut: 'erreur', 
                    erreurs: errors.array() 
                });
            }

            const { id } = req.params;
            const utilisateurId = req.etudiant.id;

            // Vérifier si le groupe existe
            const { data: groupe, error: groupeError } = await supabase
                .from('groupes')
                .select('*')
                .eq('id', id)
                .single();

            if (groupeError || !groupe) {
                Sentry.captureException(groupeError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', groupeError.message);
                
                return res.status(404).json({
                    statut: 'erreur',
                    message: 'Groupe non trouvé'
                });
            }

            // Vérifier si l'utilisateur est déjà membre
            const { data: existingMember, error: memberError } = await supabase
                .from('membres_groupe')
                .select('*')
                .eq('groupe_id', id)
                .eq('etudiant_id', utilisateurId)
                .single();

            if (memberError) {
                Sentry.captureException(memberError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', memberError.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la vérification de l\'adhésion',
                    details: memberError.message
                });
            }

            if (existingMember) {
                return res.status(400).json({
                    statut: 'erreur',
                    message: 'Vous êtes déjà membre de ce groupe'
                });
            }

            // Vérifier les conditions de confidentialité
            if (groupe.confidentialite === 'prive') {
                return res.status(403).json({
                    statut: 'erreur',
                    message: 'Ce groupe est privé et nécessite une invitation'
                });
            }

            // Ajouter l'utilisateur comme membre
            const { data, error } = await supabase
                .from('membres_groupe')
                .insert({
                    groupe_id: id,
                    etudiant_id: utilisateurId,
                    role: 'membre'
                })
                .select();

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la participation au groupe',
                    details: error.message
                });
            }

            transaction.setData('groupe_id', id);
            transaction.setStatus('success');
            
            res.status(200).json({
                statut: 'succès',
                message: 'Participation au groupe réussie',
                membre: data[0]
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la participation au groupe',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    envoyerMessage: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "envoyer_message"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    statut: 'erreur', 
                    erreurs: errors.array() 
                });
            }

            const { id } = req.params;
            const { contenu } = req.body;
            const utilisateurId = req.etudiant.id;

            // Vérifier si l'utilisateur est membre du groupe
            const { data: membre, error: membreError } = await supabase
                .from('membres_groupe')
                .select('*')
                .eq('groupe_id', id)
                .eq('etudiant_id', utilisateurId)
                .single();

            if (membreError || !membre) {
                Sentry.captureException(membreError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', membreError.message);
                
                return res.status(403).json({
                    statut: 'erreur',
                    message: 'Vous n\'êtes pas membre de ce groupe'
                });
            }

            const { data, error } = await supabase
                .from('messages_groupe')
                .insert({
                    groupe_id: id,
                    etudiant_id: utilisateurId,
                    contenu
                })
                .select();

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de l\'envoi du message',
                    details: error.message
                });
            }

            transaction.setData('groupe_id', id);
            transaction.setStatus('success');
            
            res.status(201).json({
                statut: 'succès',
                message: 'Message envoyé avec succès',
                messageEnvoye: data[0]
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de l\'envoi du message',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    partagerDocument: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "partager_document"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const { id } = req.params;
            const fichier = req.file;
            const utilisateurId = req.etudiant.id;

            if (!fichier) {
                return res.status(400).json({
                    statut: 'erreur',
                    message: 'Aucun fichier téléchargé'
                });
            }

            // Vérifier si l'utilisateur est membre du groupe
            const { data: membre, error: membreError } = await supabase
                .from('membres_groupe')
                .select('*')
                .eq('groupe_id', id)
                .eq('etudiant_id', utilisateurId)
                .single();

            if (membreError || !membre) {
                Sentry.captureException(membreError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', membreError.message);
                
                return res.status(403).json({
                    statut: 'erreur',
                    message: 'Vous n\'êtes pas membre de ce groupe'
                });
            }

            // Télécharger le fichier sur Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('groupes')
                .upload(`documents/${fichier.filename}`, fichier);

            if (uploadError) {
                Sentry.captureException(uploadError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', uploadError.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors du téléchargement du fichier',
                    details: uploadError.message
                });
            }

            // Enregistrer les métadonnées du document
            const { data, error } = await supabase
                .from('documents_groupe')
                .insert({
                    groupe_id: id,
                    nom: fichier.originalname,
                    chemin_fichier: uploadData.path,
                    type_fichier: fichier.mimetype,
                    taille_fichier: fichier.size,
                    partage_par: utilisateurId
                })
                .select();

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de l\'enregistrement du document',
                    details: error.message
                });
            }

            transaction.setData('groupe_id', id);
            transaction.setStatus('success');
            
            res.status(201).json({
                statut: 'succès',
                message: 'Document partagé avec succès',
                document: data[0]
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors du partage du document',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    listerGroupes: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "lister_groupes"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const { matieres, anneeEtude, confidentialite } = req.query;

            let query = supabase.from('groupes').select('*');

            if (matieres) {
                query = query.contains('matieres', matieres);
            }

            if (anneeEtude) {
                query = query.eq('annee_etude', anneeEtude);
            }

            if (confidentialite) {
                query = query.eq('confidentialite', confidentialite);
            }

            const { data: groupes, error } = await query;

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la récupération des groupes',
                    details: error.message
                });
            }

            transaction.setStatus('success');
            
            res.status(200).json({
                statut: 'succès',
                groupes
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la récupération des groupes',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    supprimerGroupe: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "supprimer_groupe"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const { id } = req.params;
            const utilisateurId = req.etudiant.id;

            // Vérifier si l'utilisateur est l'administrateur du groupe
            const { data: groupe, error: groupeError } = await supabase
                .from('groupes')
                .select('*')
                .eq('id', id)
                .eq('cree_par', utilisateurId)
                .single();

            if (groupeError || !groupe) {
                Sentry.captureException(groupeError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', groupeError.message);
                
                return res.status(403).json({
                    statut: 'erreur',
                    message: 'Vous n\'êtes pas autorisé à supprimer ce groupe'
                });
            }

            // Supprimer tous les documents du groupe
            const { error: documentsError } = await supabase
                .from('documents_groupe')
                .delete()
                .eq('groupe_id', id);

            if (documentsError) {
                Sentry.captureException(documentsError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', documentsError.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la suppression des documents du groupe',
                    details: documentsError.message
                });
            }

            // Supprimer tous les messages du groupe
            const { error: messagesError } = await supabase
                .from('messages_groupe')
                .delete()
                .eq('groupe_id', id);

            if (messagesError) {
                Sentry.captureException(messagesError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', messagesError.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la suppression des messages du groupe',
                    details: messagesError.message
                });
            }

            // Supprimer tous les membres du groupe
            const { error: membresError } = await supabase
                .from('membres_groupe')
                .delete()
                .eq('groupe_id', id);

            if (membresError) {
                Sentry.captureException(membresError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', membresError.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la suppression des membres du groupe',
                    details: membresError.message
                });
            }

            // Supprimer le groupe
            const { error } = await supabase
                .from('groupes')
                .delete()
                .eq('id', id);

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la suppression du groupe',
                    details: error.message
                });
            }

            transaction.setStatus('success');
            
            res.status(200).json({
                statut: 'succès',
                message: 'Groupe supprimé avec succès'
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la suppression du groupe',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    creerNoteCollaborative: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "creer_note_collaborative"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    statut: 'erreur', 
                    erreurs: errors.array() 
                });
            }

            const { groupeId } = req.params;
            const { titre, contenu } = req.body;
            const utilisateurId = req.etudiant.id;

            // Vérifier si l'utilisateur est membre du groupe
            const { data: membre, error: membreError } = await supabase
                .from('membres_groupe')
                .select('*')
                .eq('groupe_id', groupeId)
                .eq('etudiant_id', utilisateurId)
                .single();

            if (membreError || !membre) {
                Sentry.captureException(membreError);
                
                transaction.setStatus('error');
                transaction.setData('error_message', membreError.message);
                
                return res.status(403).json({
                    statut: 'erreur',
                    message: 'Vous n\'êtes pas membre de ce groupe'
                });
            }

            // Créer la note collaborative
            const { data, error } = await supabase
                .from('notes_collaboratives')
                .insert({
                    groupe_id: groupeId,
                    titre,
                    contenu,
                    cree_par: utilisateurId
                })
                .select();

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la création de la note collaborative',
                    details: error.message
                });
            }

            transaction.setStatus('success');
            
            res.status(201).json({
                statut: 'succès',
                message: 'Note collaborative créée avec succès',
                note: data[0]
            });
        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la création de la note collaborative',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },

    mettreAJourNoteCollaborative: async (req, res) => {
        const transaction = Sentry.startTransaction({name: "mettre_a_jour_note_collaborative"});
        
        try {
            Sentry.configureScope(scope => {
                scope.setSpan(transaction);
                scope.setUser({ 
                    id: req.etudiant?.id, 
                    email: req.etudiant?.email 
                });
            });

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    statut: 'erreur', 
                    erreurs: errors.array() 
                });
            }

            const { groupeId, noteId } = req.params;
            const { contenu } = req.body;
            const utilisateurId = req.etudiant.id;

            // Mise à jour de la note collaborative
            const { data, error } = await supabase
                .from('notes_collaboratives')
                .update({ 
                    contenu: contenu,
                    modifie_le: new Date().toISOString()
                })
                .eq('id', noteId)
                .eq('groupe_id', groupeId)
                .eq('cree_par', utilisateurId)
                .select();

            if (error) {
                Sentry.captureException(error);
                
                transaction.setStatus('error');
                transaction.setData('error_message', error.message);
                
                return res.status(500).json({
                    statut: 'erreur',
                    message: 'Erreur lors de la mise à jour de la note collaborative',
                    details: error.message
                });
            }

            // Vérifier si une note a été mise à jour
            if (data.length === 0) {
                return res.status(404).json({
                    statut: 'erreur',
                    message: 'Note collaborative non trouvée ou vous n\'avez pas les droits de modification'
                });
            }

            transaction.setStatus('success');
            
            res.status(200).json({
                statut: 'succès',
                message: 'Note collaborative mise à jour avec succès',
                note: data[0]
            });

        } catch (error) {
            Sentry.captureException(error);
            
            transaction.setStatus('error');
            transaction.setData('error_message', error.message);
            
            res.status(500).json({
                statut: 'erreur',
                message: 'Erreur lors de la mise à jour de la note collaborative',
                details: error.message
            });
        } finally {
            transaction.finish();
        }
    },
};

export default groupeController;