// Configuration globale
const API_BASE_URL = '/api/administration';
let currentAdmin = null;

// Authentification et Chargement
function checkAuthentication() {
    const token = localStorage.getItem('campus_plus_admin_token');
    if (!token) {
        window.location.href = '/administration/login.html';
        return false;
    }
    return true;
}

// Charger les informations de l'administrateur
async function loadAdminProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profil`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            }
        });

        currentAdmin = await response.json();
        $('#admin-name').text(`${currentAdmin.prenom} ${currentAdmin.nom}`);
    } catch (error) {
        console.error('Erreur de chargement du profil', error);
    }
}

// Gestion des Informations
async function creerInformation(event) {
    event.preventDefault();
    const formData = new FormData();
    
    formData.append('titre', $('#titre-info').val());
    formData.append('contenu', $('#contenu-info').val());
    formData.append('type', $('#type-info').val());
    
    // Formations
    const formations = $('#formation-info').val() || ['toutes'];
    formations.forEach(formation => {
        formData.append('formation', formation);
    });
    
    // Années d'étude
    const annees = $('#annees-info').val() || [1, 2, 3, 4, 5];
    annees.forEach(annee => {
        formData.append('anneeEtude', annee);
    });
    
    // Pièce jointe
    const pieceJointe = $('#piece-jointe-info')[0].files[0];
    if (pieceJointe) {
        formData.append('pieceJointe', pieceJointe);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/informations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            },
            body: formData
        });

        const information = await response.json();
        await chargerListeInformations();
        
        // Réinitialiser le formulaire
        $('#creer-information-form')[0].reset();
    } catch (error) {
        console.error('Erreur de création d\'information', error);
    }
}

async function chargerListeInformations() {
    try {
        const response = await fetch(`${API_BASE_URL}/informations`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            }
        });

        const { informations } = await response.json();
        
        const listeHTML = informations.map(info => `
            <div class="card mb-2">
                <div class="card-body">
                    <h5 class="card-title">${info.titre}</h5>
                    <p class="card-text">${info.contenu.substring(0, 100)}...</p>
                    <span class="badge badge-primary">${info.type}</span>
                    <small class="text-muted ml-2">${new Date(info.datePublication).toLocaleDateString()}</small>
                </div>
            </div>
        `).join('');

        $('#liste-informations').html(listeHTML);
    } catch (error) {
        console.error('Erreur de chargement des informations', error);
    }
}

// Gestion de l'Emploi du Temps
async function uploaderEmploiDuTemps(event) {
    event.preventDefault();
    const formData = new FormData();
    
    formData.append('formation', $('#formation-emploi-temps').val());
    formData.append('anneeEtude', $('#annee-emploi-temps').val());
    formData.append('semestre', $('#semestre-emploi-temps').val());
    formData.append('dateDebut', $('#date-debut-emploi-temps').val());
    formData.append('dateFin', $('#date-fin-emploi-temps').val());
    
    const fichier = $('#fichier-emploi-temps')[0].files[0];
    formData.append('fichierEmploiDuTemps', fichier);

    try {
        const response = await fetch(`${API_BASE_URL}/emploi-du-temps`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            },
            body: formData
        });

        const emploiDuTemps = await response.json();
        await chargerListeEmploiDuTemps();
        
        // Réinitialiser le formulaire
        $('#upload-emploi-temps-form')[0].reset();
    } catch (error) {
        console.error('Erreur d\'upload de l\'emploi du temps', error);
    }
}

async function chargerListeEmploiDuTemps() {
    try {
        const response = await fetch(`${API_BASE_URL}/emploi-du-temps`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            }
        });

        const { emploiDuTemps } = await response.json();
        
        const listeHTML = emploiDuTemps.map(emploi => `
            <div class="card mb-2">
                <div class="card-body">
                    <h5 class="card-title">${emploi.formation} - ${emploi.anneeEtude}ème Année</h5>
                    <p class="card-text">Semestre ${emploi.semestre}</p>
                    <a href="${emploi.fichier.url}" target="_blank" class="btn btn-sm btn-primary">
                        Voir le fichier
                    </a>
                    <small class="text-muted ml-2">
                        ${new Date(emploi.dateDebut).toLocaleDateString()} - 
                        ${new Date(emploi.dateFin).toLocaleDateString()}
                    </small>
                </div>
            </div>
        `).join('');

        $('#liste-emplois-temps').html(listeHTML);
    } catch (error) {
        console.error('Erreur de chargement des emplois du temps', error);
    }
}

// Gestion des Groupes de Classe
async function chargerGroupesClasse() {
    try {
        const response = await fetch(`${API_BASE_URL}/groupes-classe`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            }
        });

        const { groupes } = await response.json();
        
        // Remplir le sélecteur de groupes
        const selectGroupes = groupes.map(groupe => 
            `<option value="${groupe._id}">${groupe.nom} (${groupe.matiere})</option>`
        ).join('');
        $('#groupe-selection').html(selectGroupes);

        // Afficher la liste des groupes
        const listeHTML = groupes.map(groupe => `
            <div class="card mb-2">
                <div class="card-body">
                    <h5 class="card-title">${groupe.nom}</h5>
                    <p class="card-text">Matière: ${groupe.matiere}</p>
                    <p class="card-text">Membres: ${groupe.membres.length}</p>
                </div>
            </div>
        `).join('');

        $('#liste-groupes-classe').html(listeHTML);
    } catch (error) {
        console.error('Erreur de chargement des groupes', error);
    }
}

async function envoyerMessageGroupe(event) {
    event.preventDefault();
    const groupeId = $('#groupe-selection').val();
    const message = $('#message-groupe').val();

    try {
        const response = await fetch(`${API_BASE_URL}/groupes-classe/${groupeId}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            },
            body: JSON.stringify({ contenu: message })
        });

        const resultat = await response.json();
        
        // Réinitialiser le formulaire
        $('#message-groupe-form')[0].reset();
    } catch (error) {
        console.error('Erreur d\'envoi de message', error);
    }
}

// Recherche d'Étudiants
async function rechercherEtudiants(event) {
    event.preventDefault();
    const criteres = $('#criteres-recherche').val();

    try {
        const response = await fetch(`${API_BASE_URL}/etudiants/recherche?q=${criteres}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('campus_plus_admin_token')}`
            }
        });

        const { etudiants } = await response.json();
        
        const resultatsHTML = etudiants.map(etudiant => `
            <div class="card mb-2">
                <div class="card-body">
                    <h5 class="card-title">${etudiant.prenom} ${etudiant.nom}</h5>
                    <p class="card-text">Email: ${etudiant.email}</p>
                    <p class="card-text">Formation: ${etudiant.formation}</p>
                    <p class="card-text">Année: ${etudiant.anneeEtude}</p>
                </div>
            </div>
        `).join('');

        $('#resultats-recherche-etudiants').html(resultatsHTML);
    } catch (error) {
        console.error('Erreur de recherche d\'étudiants', error);
    }
}

// Déconnexion
function logout() {
    localStorage.removeItem('campus_plus_admin_token');
    window.location.href = '/administration/login.html';
}

// Événements et initialisation
$(document).ready(function() {
    // Vérification de l'authentification
    if (!checkAuthentication()) return;

    // Charger les données
    loadAdminProfile();
    chargerListeInformations();
    chargerListeEmploiDuTemps();
    chargerGroupesClasse();

    // Événements de formulaire
    $('#creer-information-form').on('submit', creerInformation);
    $('#upload-emploi-temps-form').on('submit', uploaderEmploiDuTemps);
    $('#message-groupe-form').on('submit', envoyerMessageGroupe);
    $('#recherche-etudiant-form').on('submit', rechercherEtudiants);
    
    // Déconnexion
    $('#logout').on('click', logout);

    // Toggle sidebar
    $('#sidebarCollapse').on('click', function() {
        $('#sidebar').toggleClass('active');
        $('#content').toggleClass('active');
    });
});
