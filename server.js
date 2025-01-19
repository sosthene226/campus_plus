import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import cron from 'node-cron';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import 'winston-daily-rotate-file';
import multer from 'multer';
import { fileURLToPath } from 'url';

// Configuration des logs
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const productionTransports = [
  new winston.transports.DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
  }),
  new winston.transports.Console({
    format: winston.format.simple()
  })
];

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: logFormat,
  transports: process.env.NODE_ENV === 'production' 
    ? productionTransports 
    : [new winston.transports.Console()]
});

// Charger les variables d'environnement
dotenv.config();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Résoudre __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuration Multer pour les uploads
const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 10485760 // 10 Mo par défaut
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'), false);
    }
  }
});

// Middleware de gestion des erreurs Multer
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          statut: 'erreur',
          message: 'Le fichier est trop volumineux. Taille maximale : 10 Mo'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          statut: 'erreur',
          message: 'Trop de fichiers téléchargés'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          statut: 'erreur',
          message: 'Fichier inattendu'
        });
      default:
        return res.status(500).json({
          statut: 'erreur',
          message: 'Erreur lors du téléchargement du fichier'
        });
    }
  } else if (err) {
    return res.status(500).json({
      statut: 'erreur',
      message: err.message || 'Erreur inconnue lors du téléchargement'
    });
  }
  next();
};

// Middleware de limitation des requêtes
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Trop de requêtes, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false
});

// Middlewares de sécurité
app.use(helmet());
app.use(apiLimiter);

// Middlewares existants
app.use(cors({
  origin: process.env.CORS_ORIGIN
}));
app.use(express.json());

// Configuration CORS
app.use(cors({
  origin: ['http://localhost:3333', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour parser JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ajout de logs de débogage pour toutes les routes
app.use((req, res, next) => {
  console.log(`🔍 Requête reçue : ${req.method} ${req.path}`);
  console.log('📋 En-têtes :', req.headers);
  console.log('🔑 Corps de la requête :', req.body);
  next();
});

// Route d'authentification
app.post('/api/auth/connexion', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Authentification via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      logger.error('Erreur de connexion :', error);
      return res.status(401).json({
        statut: 'erreur',
        message: 'Identifiants invalides',
        details: error.message
      });
    }

    // Récupérer les informations supplémentaires de l'utilisateur
    const { data: utilisateur, error: utilisateurError } = await supabase
      .from('etudiants')
      .select('*')
      .eq('email', email)
      .single();

    if (utilisateurError) {
      logger.warn('Utilisateur non trouvé dans la base :', utilisateurError);
      return res.status(404).json({
        statut: 'erreur',
        message: 'Profil utilisateur non trouvé'
      });
    }

    // Réponse de connexion réussie
    res.status(200).json({
      statut: 'succès',
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role
      },
      token: data.session.access_token
    });

  } catch (erreurGlobale) {
    logger.error('Erreur globale de connexion :', erreurGlobale);
    res.status(500).json({
      statut: 'erreur',
      message: 'Erreur serveur lors de la connexion'
    });
  }
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importation des routes (suppression des doublons)
import authRoutes from './routes/authRoutes.js';
import profilRoutes from './routes/profilRoutes.js';
import evenementRoutes from './routes/evenementRoutes.js';
import bibliothequeRoutes from './routes/bibliothequeRoutes.js';
import novaRoutes from './routes/novaRoutes.js';
import groupeRoutes from './routes/groupeRoutes.js';
import abonnementRoutes from './routes/abonnementRoutes.js';

// Configuration des routes
app.use('/api/auth', authRoutes);
app.use('/api/profil', profilRoutes);
app.use('/api/evenements', evenementRoutes);
app.use('/api/bibliotheque', bibliothequeRoutes);
app.use('/api/nova', novaRoutes);
app.use('/api/groupes', groupeRoutes);
app.use('/api/abonnement', abonnementRoutes);

// Route d'upload de fichier avec gestion des erreurs
app.post('/api/upload', 
  (req, res, next) => {
    uploadMiddleware.single('file')(req, res, (err) => {
      if (err) {
        return multerErrorHandler(err, req, res, next);
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          message: 'Aucun fichier téléchargé ou fichier invalide' 
        });
      }
      
      res.json({ 
        message: 'Fichier téléchargé avec succès', 
        filename: req.file.filename 
      });
    });
  }
);

// Route par défaut pour servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vérification de la connexion Supabase
async function verifierConnexionSupabase() {
  try {
    const { data, error } = await supabase
      .from('etudiants')
      .select('*', { count: 'exact' });

    if (error) {
      console.error('❌ Erreur de connexion à Supabase:', error);
      logger.error('Échec de connexion à Supabase', { 
        errorName: error.name,
        errorMessage: error.message
      });
      throw error;
    }

    console.log('✅ Connexion à Supabase réussie');
    logger.info('Connexion à Supabase établie avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de Supabase:', error);
  }
}

// Configuration des tâches planifiées
try {
  const { default: notificationService } = await import('./services/notificationService.js');
  cron.schedule('0 * * * *', () => {
    notificationService.verifierRappels();
  });
} catch (erreur) {
  console.error('Erreur lors de la configuration des tâches planifiées :', erreur);
}

// Configuration WebSocket
import WebSocketService from './services/websocketService.js';
const httpServer = http.createServer(app);
const websocketServer = new WebSocketService(httpServer);

// Gestion des routes non trouvées avec logs détaillés
app.use((req, res, next) => {
  console.error(`❌ Route non trouvée : ${req.method} ${req.path}`);
  console.error('🔍 Routes disponibles :', 
    app._router.stack
      .filter(r => r.route)
      .map(r => Object.keys(r.route.methods).map(method => `${method.toUpperCase()} ${r.route.path}`))
  );
  res.status(404).json({
    statut: 'erreur',
    message: 'Route non trouvée',
    details: {
      method: req.method,
      path: req.path
    }
  });
});

// Middleware global de gestion des erreurs
app.use((err, req, res, next) => {
  // Log de l'erreur
  logger.error(err.message, { 
    stack: err.stack, 
    method: req.method, 
    path: req.path 
  });

  // Réponse en fonction de l'environnement
  res.status(500).json({
    statut: 'erreur',
    message: 'Une erreur serveur est survenue',
    details: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// Configuration du serveur
import config from './config.js';
const PORT = process.env.PORT || 3000;
const NODE_ENV = config.environment;

// Exemple d'utilisation de l'utilisateur de test si nécessaire
const testUser = config.getTestUser();

// Configuration des middlewares de base
app.use(cors({
  origin: '*', // À ajuster selon vos besoins de sécurité
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de gestion des OPTIONS pour CORS
app.options('*', cors());

// Log de toutes les requêtes entrantes
app.use((req, res, next) => {
  console.log(`📡 Requête reçue : ${req.method} ${req.path}`);
  next();
});

// Configuration de production
if (NODE_ENV === 'production') {
  // Activer la confiance du proxy
  app.set('trust proxy', 1);
  
  // Désactiver les logs détaillés
  logger.transports.forEach(transport => {
    if (transport instanceof winston.transports.File) {
      transport.level = 'error';
    }
  });
  
  // Configuration de sécurité supplémentaire
  app.use(helmet({
    contentSecurityPolicy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));
}

// Configuration Sentry
import * as Sentry from "@sentry/node";

if (NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app })
    ],
    tracesSampleRate: 0.5, // Capture 50% des transactions
    environment: 'production'
  });

  // Middleware Sentry
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Importer les modules nécessaires
import fs from 'fs/promises';

// Middleware pour modifier les fichiers HTML
app.post('/modify-html', async (req, res) => {
  try {
    const { file, code } = req.body;
    
    // Chemin de base pour les fichiers HTML
    const basePath = path.join(__dirname, 'public');
    const filePath = path.join(basePath, file);

    // Vérifier que le fichier est dans le répertoire public
    if (!filePath.startsWith(basePath)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Lire le contenu du fichier existant
    const fileContent = await fs.readFile(filePath, 'utf8');

    // Insérer le code juste avant la balise </body>
    const modifiedContent = fileContent.replace('</body>', `${code}\n</body>`);

    // Écrire le contenu modifié
    await fs.writeFile(filePath, modifiedContent, 'utf8');

    res.status(200).json({ message: 'Fichier modifié avec succès' });
  } catch (error) {
    console.error('Erreur lors de la modification du fichier :', error);
    res.status(500).json({ 
      error: 'Erreur lors de la modification du fichier',
      details: error.message 
    });
  }
});

// Démarrage du serveur avec gestion des erreurs et configuration réseau
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL d'accès : http://localhost:${PORT}`);
  console.log('🌐 Routes disponibles :');
  console.log('  - /api/auth');
  console.log('  - /api/profil');
  console.log('  - /api/evenements');
  console.log('  - /api/bibliotheque');
  console.log('  - /api/nova');
  console.log('  - /api/groupes');
  console.log('  - /api/abonnement');
  
  // Vérification de la connexion Supabase
  verifierConnexionSupabase();
});

export { app, supabase };