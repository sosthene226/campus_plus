import { supabase } from '../supabaseClient.js';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const genererToken = (etudiant) => {
  return jwt.sign(
    { 
      id: etudiant.id,
      email: etudiant.email,
      role: etudiant.role || 'etudiant'
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRATION }
  );
};

const authController = {
  inscription: async (req, res) => {
    try {
      console.log('Requête d\'inscription reçue :', req.body);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Erreurs de validation :', errors.array());
        return res.status(400).json({ 
          statut: 'erreur', 
          erreurs: errors.array() 
        });
      }

      const { data: emailExiste, error: emailError } = await supabase
        .from('etudiants')
        .select('*')
        .eq('email', req.body.email)
        .single();

      if (emailError && emailError.code !== 'PGRST116') {
        throw emailError;
      }

      if (emailExiste) {
        console.warn('Tentative d\'inscription avec un email existant :', req.body.email);
        return res.status(400).json({ 
          statut: 'erreur', 
          message: 'Un compte avec cet email existe déjà' 
        });
      }

      const motDePasseHache = await bcrypt.hash(req.body.motDePasse, 10);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: req.body.email,
        password: req.body.motDePasse
      });

      if (authError) throw authError;

      const { data: etudiantData, error: etudiantError } = await supabase
        .from('etudiants')
        .insert({
          id: authData.user.id,
          nom: req.body.nom,
          prenom: req.body.prenom,
          email: req.body.email,
          annee_etude: req.body.anneeEtude,
          filiere: req.body.filiere,
          mot_de_passe_hache: motDePasseHache
        })
        .select();

      if (etudiantError) throw etudiantError;

      const token = genererToken(authData.user);

      res.status(201).json({
        statut: 'succès',
        message: 'Inscription réussie',
        token,
        etudiant: etudiantData[0]
      });

    } catch (error) {
      console.error('Erreur lors de l\'inscription :', error);
      res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur lors de l\'inscription',
        details: error.message
      });
    }
  },

  connexion: async (req, res) => {
    try {
      const { email, motDePasse } = req.body;
      console.log('🔐 Tentative de connexion :', {
        email,
        passwordLength: motDePasse.length
      });

      // Vérification de l'utilisateur dans la base de données
      const { data: etudiant, error: etudiantError } = await supabase
        .from('etudiants')
        .select('*')
        .eq('email', email)
        .single();

      if (etudiantError || !etudiant) {
        console.error('❌ Utilisateur non trouvé :', {
          error: etudiantError,
          email: email
        });
        return res.status(404).json({ 
          statut: 'erreur', 
          message: 'Utilisateur non trouvé',
          details: etudiantError?.message
        });
      }

      // Authentification via Supabase avec gestion d'erreur détaillée
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: motDePasse
      });

      if (authError) {
        console.error('❌ Erreur d\'authentification :', {
          error: authError,
          email: email,
          errorType: authError.name
        });
        return res.status(401).json({ 
          statut: 'erreur', 
          message: 'Identifiants invalides',
          details: {
            code: authError.code,
            message: authError.message
          }
        });
      }

      // Génération de token personnalisé avec plus de détails
      const token = jwt.sign(
        { 
          id: etudiant.id,
          email: etudiant.email,
          role: etudiant.role || 'etudiant',
          timestamp: Date.now()
        }, 
        process.env.JWT_SECRET, 
        { 
          expiresIn: '1h',
          algorithm: 'HS256'
        }
      );

      console.log('✅ Connexion réussie pour :', email);

      res.status(200).json({
        statut: 'succès',
        message: 'Connexion réussie',
        token,
        utilisateur: {
          id: etudiant.id,
          email: etudiant.email,
          nom: etudiant.nom,
          prenom: etudiant.prenom,
          role: etudiant.role || 'etudiant'
        }
      });

    } catch (error) {
      console.error('🚨 Erreur serveur lors de la connexion :', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur lors de la connexion',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  },

  protegerRoute: async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        console.warn('Aucun token fourni');
        return res.status(401).json({ 
          statut: 'erreur', 
          message: 'Non autorisé : token manquant' 
        });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token décodé :', decoded);

        // Vérifier l'existence de l'utilisateur
        const { data: etudiant, error } = await supabase
          .from('etudiants')
          .select('*')
          .eq('id', decoded.id)
          .single();

        if (error || !etudiant) {
          console.warn('Utilisateur non trouvé pour le token');
          return res.status(401).json({ 
            statut: 'erreur', 
            message: 'Non autorisé : utilisateur invalide' 
          });
        }

        req.etudiant = etudiant;
        next();

      } catch (verificationError) {
        console.error('Erreur de vérification du token :', verificationError);
        return res.status(401).json({ 
          statut: 'erreur', 
          message: 'Non autorisé : token invalide',
          details: verificationError.message
        });
      }
    } catch (error) {
      console.error('Erreur middleware protegerRoute :', error);
      res.status(500).json({ 
        statut: 'erreur', 
        message: 'Erreur serveur' 
      });
    }
  }
};

export default authController;