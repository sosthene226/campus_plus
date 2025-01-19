import { Server } from 'socket.io'
import { supabase } from '../supabaseClient.js'
import { v4 as uuidv4 } from 'uuid'

class WebSocketService {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: ['http://localhost:3333', 'http://127.0.0.1:3333'],
        methods: ["GET", "POST"]
      }
    })
    this.initializeSocketEvents()
  }

  initializeSocketEvents() {
    this.io.use(async (socket, next) => {
      const userId = socket.handshake.auth.userId;
      
      // Vérifier l'authentification de l'utilisateur
      if (!userId) {
        return next(new Error('Authentification requise'));
      }

      try {
        // Vérifier l'existence de l'utilisateur dans Supabase
        const { data: user, error } = await supabase
          .from('utilisateurs')
          .select('*')
          .eq('id', userId)
          .single();

        if (error || !user) {
          return next(new Error('Utilisateur non trouvé'));
        }

        // Stocker l'utilisateur dans le socket pour une utilisation ultérieure
        socket.user = user;
        next();
      } catch (err) {
        next(new Error('Erreur de vérification utilisateur'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Nouvelle connexion WebSocket pour:', socket.user.nom);

      // Gestion des événements de groupe
      socket.on('rejoindre_groupe', async (data) => {
        const { groupeId, etudiantId } = data;
        
        try {
          // Vérifier l'appartenance au groupe
          const { data: appartenance, error } = await supabase
            .from('membres_groupe')
            .select('*')
            .eq('groupe_id', groupeId)
            .eq('etudiant_id', etudiantId)
            .single();

          if (error || !appartenance) {
            socket.emit('erreur_groupe', { 
              message: 'Vous ne pouvez pas rejoindre ce groupe' 
            });
            return;
          }

          socket.join(groupeId);
          socket.emit('groupe_rejoint', { groupeId });
        } catch (erreur) {
          console.error('Erreur lors de la connexion au groupe :', erreur);
        }
      });

      // Envoi de message dans un groupe
      socket.on('envoyer_message', async (data) => {
        const { groupeId, message, etudiantId } = data;

        try {
          // Enregistrer le message dans la base de données
          const { data: nouveauMessage, error } = await supabase
            .from('messages')
            .insert({
              groupe_id: groupeId,
              etudiant_id: etudiantId,
              contenu: message,
              timestamp: new Date()
            })
            .select();

          if (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
            return;
          }

          // Diffuser le message à tous les membres du groupe
          this.io.to(groupeId).emit('nouveau_message', {
            ...nouveauMessage[0],
            sender: socket.user.nom
          });
        } catch (erreur) {
          console.error('Erreur lors de l\'envoi du message :', erreur);
        }
      });

      // Gestion des déconnexions
      socket.on('disconnect', () => {
        console.log('Déconnexion du socket:', socket.user.nom);
      });
    });
  }

  // Méthode pour diffuser des notifications
  async envoyerNotification(etudiantIds, notification) {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens_notification')
        .select('token')
        .in('etudiant_id', etudiantIds)

      if (error) {
        console.error('Erreur de récupération des tokens :', error)
        return
      }

      tokens.forEach(({ token }) => {
        // Logique d'envoi de notification (à implémenter)
        console.log(`Notification envoyée à : ${token}`)
      })
    } catch (erreur) {
      console.error('Erreur lors de l\'envoi des notifications :', erreur)
    }
  }
}

export default WebSocketService