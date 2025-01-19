// socketClient.js
class SocketClient {
  constructor(url = 'http://localhost:3333') {
    this.socket = null;
    this.url = url;
    this.userId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Initialisation de la connexion socket
  connect(userId) {
    if (this.socket) {
      this.disconnect();
    }

    this.userId = userId;

    try {
      this.socket = io(this.url, {
        auth: { userId },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        withCredentials: true
      });

      this._setupEventListeners();
    } catch (error) {
      console.error('Erreur de connexion socket:', error);
      this._handleConnectionError(error);
    }

    return this;
  }

  // Configuration des écouteurs d'événements
  _setupEventListeners() {
    if (!this.socket) return;

    // Événement de connexion réussie
    this.socket.on('connect', () => {
      console.log('Connecté au serveur WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._notifyConnectionStatus(true);
    });

    // Événement de déconnexion
    this.socket.on('disconnect', (reason) => {
      console.log('Déconnecté du serveur WebSocket:', reason);
      this.isConnected = false;
      this._notifyConnectionStatus(false);

      if (reason === 'io server disconnect') {
        // La déconnexion vient du serveur, on tente de se reconnecter
        this.socket.connect();
      }
    });

    // Gestion des erreurs de connexion
    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion socket:', error);
      this._handleConnectionError(error);
    });

    // Événement de rejoindre un groupe
    this.socket.on('groupe_rejoint', (data) => {
      console.log('Groupe rejoint avec succès:', data);
      this._notifyGroupJoined(data);
    });

    // Événement de réception de message
    this.socket.on('nouveau_message', (message) => {
      console.log('Nouveau message reçu:', message);
      this._displayMessage(message);
    });

    // Événement de notification
    this.socket.on('notification', (notification) => {
      console.log('Nouvelle notification:', notification);
      this._displayNotification(notification);
    });

    return this;
  }

  // Méthode pour rejoindre un groupe
  joinGroupe(groupeId) {
    if (!this.isConnected) {
      console.warn('Pas de connexion socket active');
      return;
    }

    this.socket.emit('rejoindre_groupe', { 
      groupeId, 
      etudiantId: this.userId 
    });
  }

  // Méthode pour envoyer un message
  envoyerMessage(groupeId, message) {
    if (!this.isConnected) {
      console.warn('Pas de connexion socket active');
      return;
    }

    this.socket.emit('envoyer_message', { 
      groupeId, 
      message, 
      etudiantId: this.userId 
    });
  }

  // Gestion des erreurs de connexion
  _handleConnectionError(error) {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._showErrorNotification('Impossible de se connecter au serveur');
      return;
    }

    // Tentative de reconnexion
    setTimeout(() => {
      this.connect(this.userId);
    }, 2000 * this.reconnectAttempts);
  }

  // Déconnexion
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Méthodes privées pour les notifications et l'affichage
  _notifyConnectionStatus(status) {
    const event = new CustomEvent('socket-connection', { 
      detail: { connected: status } 
    });
    document.dispatchEvent(event);
  }

  _notifyGroupJoined(data) {
    const event = new CustomEvent('groupe-joined', { detail: data });
    document.dispatchEvent(event);
  }

  _displayMessage(message) {
    const event = new CustomEvent('nouveau-message', { detail: message });
    document.dispatchEvent(event);
  }

  _displayNotification(notification) {
    const event = new CustomEvent('nouvelle-notification', { detail: notification });
    document.dispatchEvent(event);
  }

  _showErrorNotification(message) {
    const event = new CustomEvent('socket-error', { detail: { message } });
    document.dispatchEvent(event);
  }
}

// Exportation de l'instance unique
export const socketClient = new SocketClient();

// Exemple d'utilisation dans d'autres scripts
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer l'ID de l'utilisateur (à adapter selon votre système d'authentification)
  const userId = localStorage.getItem('userId');
  
  if (userId) {
    socketClient.connect(userId);
  }

  // Écouteurs d'événements personnalisés
  document.addEventListener('socket-connection', (e) => {
    console.log('Statut de connexion:', e.detail.connected);
  });

  document.addEventListener('nouvelle-notification', (e) => {
    // Logique pour afficher la notification
    console.log('Notification reçue:', e.detail);
  });
});