import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import authController from '../controllers/authController.js';

const router = express.Router();

// Limiteur spécifique pour les routes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limiter à 5 tentatives
  message: 'Trop de tentatives de connexion, veuillez réessayer plus tard'
});

// Middleware de validation des résultats
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      statut: 'erreur', 
      errors: errors.array() 
    });
  }
  next();
};

// Middleware de débogage global pour la route d'authentification
router.use((req, res, next) => {
  console.log('🔍 Requête reçue sur /api/auth :', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    contentType: req.get('Content-Type'),
    body: req.body
  });
  
  // Définir explicitement les méthodes autorisées
  res.header('Allow', 'POST');
  res.header('Access-Control-Allow-Methods', 'POST');
  
  next();
});

// Gestion explicite des méthodes non autorisées
router.use((req, res, next) => {
  // Autoriser uniquement les requêtes POST
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    console.error(`❌ Méthode non autorisée : ${req.method}`);
    return res.status(405).json({
      statut: 'erreur',
      message: 'Méthode non autorisée',
      methodesAutorisees: ['POST']
    });
  }
  next();
});

router.post('/inscription', [
  // Validation des champs
  body('nom')
    .trim()
    .isLength({ min: 2 }).withMessage('Le nom doit faire au moins 2 caractères')
    .escape(),
  body('prenom')
    .trim()
    .isLength({ min: 2 }).withMessage('Le prénom doit faire au moins 2 caractères')
    .escape(),
  body('email')
    .trim()
    .isEmail().withMessage('Email invalide')
    .normalizeEmail(),
  body('motDePasse')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
  body('anneeEtude')
    .isIn(['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat']).withMessage('Année d\'étude invalide'),
  body('filiere')
    .trim()
    .notEmpty().withMessage('La filière est obligatoire')
    .escape(),
  validateRequest
],validateRequest, authController.inscription);

// Route de connexion avec validation renforcée et logs
router.post('/connexion', [
  authLimiter,
  // Validation de l'email
  body('email')
    .trim()
    .isEmail().withMessage('Email invalide')
    .normalizeEmail(),
  
  // Validation du mot de passe
  body('motDePasse')
    .trim()
    .notEmpty().withMessage('Mot de passe requis')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères'),
  
  // Middleware de validation
  validateRequest
], (req, res, next) => {
  console.log(' Requête de connexion détaillée :', {
    email: req.body.email,
    passwordLength: req.body.motDePasse?.length,
    headers: req.headers
  });
  next();
}, authController.connexion);

export default router;
