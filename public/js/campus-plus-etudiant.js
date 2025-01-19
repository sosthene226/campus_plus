// Configuration globale
const API_BASE_URL = '/api';
let currentUser = null;

// Gestion de l'authentification
function checkAuthentication() {
    const token = localStorage.getItem('campus_plus_token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Chargement des informations de l'utilisateur
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profil`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            }
        });

        if (!response.ok) throw new Error('Échec du chargement du profil');

        currentUser = await response.json();
        
        // Mettre à jour le nom d'utilisateur
        $('#user-name').text(`${currentUser.prenom} ${currentUser.nom}`);
        
        // Remplir les informations de profil
        $('#profil-infos').html(`
            <p><strong>Nom:</strong> ${currentUser.nom}</p>
            <p><strong>Prénom:</strong> ${currentUser.prenom}</p>
            <p><strong>Email:</strong> ${currentUser.email}</p>
            <p><strong>Formation:</strong> ${currentUser.formation}</p>
        `);
    } catch (error) {
        console.error('Erreur de chargement du profil', error);
    }
}

// Chargement du statut d'abonnement
async function loadAbonnementStatut() {
    try {
        const response = await fetch(`${API_BASE_URL}/abonnement/consulter`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            }
        });

        const abonnement = await response.json();
        
        // Mettre à jour le statut d'abonnement
        $('#abonnement-statut').text(abonnement.type);
        $('#statut-abonnement').html(`
            <p><strong>Type:</strong> ${abonnement.type}</p>
            <p><strong>Statut:</strong> ${abonnement.statut}</p>
            <p><strong>Date de début:</strong> ${new Date(abonnement.dateDebut).toLocaleDateString()}</p>
            <p><strong>Date de fin:</strong> ${new Date(abonnement.dateFin).toLocaleDateString()}</p>
        `);
    } catch (error) {
        console.error('Erreur de chargement de l\'abonnement', error);
    }
}

// Chargement des groupes
async function loadGroupes() {
    try {
        const response = await fetch(`${API_BASE_URL}/groupes/mes-groupes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            }
        });

        const groupes = await response.json();
        
        const listeGroupes = groupes.map(groupe => `
            <div class="card mb-2">
                <div class="card-body">
                    <h5 class="card-title">${groupe.nom}</h5>
                    <p class="card-text">Type: ${groupe.type}</p>
                    <p class="card-text">Matière: ${groupe.matiere}</p>
                </div>
            </div>
        `).join('');

        $('#liste-groupes').html(listeGroupes);
    } catch (error) {
        console.error('Erreur de chargement des groupes', error);
    }
}

// Génération de ressources NOVA
async function genererFicheRevision(event) {
    event.preventDefault();
    try {
        const response = await fetch(`${API_BASE_URL}/nova/fiche-revision`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            },
            body: JSON.stringify({
                filiere: $('#filiere-fiche').val(),
                matiere: $('#matiere-fiche').val()
            })
        });

        const ficheRevision = await response.json();
        // TODO: Afficher la fiche de révision générée
    } catch (error) {
        console.error('Erreur de génération de fiche', error);
    }
}

async function genererCasPratique(event) {
    event.preventDefault();
    try {
        const response = await fetch(`${API_BASE_URL}/nova/cas-pratique`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            },
            body: JSON.stringify({
                filiere: $('#filiere-cas-pratique').val(),
                anneeEtude: $('#annee-etude').val()
            })
        });

        const casPratique = await response.json();
        // TODO: Afficher le cas pratique généré
    } catch (error) {
        console.error('Erreur de génération de cas pratique', error);
    }
}

// Création de groupe
async function creerGroupe(event) {
    event.preventDefault();
    try {
        const response = await fetch(`${API_BASE_URL}/groupes/creer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            },
            body: JSON.stringify({
                nom: $('#nom-groupe').val(),
                type: $('#type-groupe').val()
            })
        });

        const groupe = await response.json();
        // Recharger la liste des groupes
        await loadGroupes();
    } catch (error) {
        console.error('Erreur de création de groupe', error);
    }
}

// Souscription d'abonnement
async function souscrireAbonnement(event) {
    event.preventDefault();
    try {
        // Initialisation du paiement
        const initialisationResponse = await fetch(`${API_BASE_URL}/abonnement/initialiser-paiement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            },
            body: JSON.stringify({
                typeAbonnement: $('#type-abonnement').val(),
                methodePaiement: $('#methode-paiement').val(),
                phoneNumber: $('#numero-telephone').val()
            })
        });

        const paiementInitial = await initialisationResponse.json();
        
        // Demander le code OTP
        const otp = prompt('Veuillez entrer le code OTP reçu');
        
        // Confirmation du paiement
        const confirmationResponse = await fetch(`${API_BASE_URL}/abonnement/confirmer-paiement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_token')}`
            },
            body: JSON.stringify({
                transactionId: paiementInitial.transactionId,
                otp: otp
            })
        });

        const abonnement = await confirmationResponse.json();
        
        // Recharger le statut d'abonnement
        await loadAbonnementStatut();
    } catch (error) {
        console.error('Erreur de souscription', error);
    }
}

// Déconnexion
function logout() {
    localStorage.removeItem('campus_plus_token');
    window.location.href = '/login.html';
}

// Événements et initialisation
$(document).ready(function() {
    // Vérification de l'authentification
    if (!checkAuthentication()) return;

    // Charger les données
    loadUserProfile();
    loadAbonnementStatut();
    loadGroupes();

    // Remplir les sélecteurs de filière (depuis nova.html)
    $('#filiere-fiche, #filiere-cas-pratique').html($('#filiere-cas-pratique').html());

    // Événements de formulaire
    $('#nova-fiche-form').on('submit', genererFicheRevision);
    $('#nova-cas-pratique-form').on('submit', genererCasPratique);
    $('#creer-groupe-form').on('submit', creerGroupe);
    $('#souscrire-abonnement-form').on('submit', souscrireAbonnement);
    $('#logout').on('click', logout);

    // Toggle sidebar
    $('#sidebarCollapse').on('click', function() {
        $('#sidebar').toggleClass('active');
        $('#content').toggleClass('active');
    });
});
