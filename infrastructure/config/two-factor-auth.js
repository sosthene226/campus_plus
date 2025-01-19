const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class DeuxFacteurs {
    // Générer une clé secrète pour un utilisateur
    static genererCle() {
        return speakeasy.generateSecret({
            name: "CAMPUS+ (Votre compte)"
        });
    }

    // Générer un QR Code pour l'authentification
    static async genererQRCode(secret) {
        return new Promise((resolve, reject) => {
            QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
                if (err) reject(err);
                resolve(data_url);
            });
        });
    }

    // Vérifier le code à deux facteurs
    static verifierCode(secret, token) {
        return speakeasy.totp.verify({
            secret: secret.base32,
            encoding: 'base32',
            token: token
        });
    }

    // Configuration de la politique de 2FA
    static configurerPolitique(utilisateur) {
        return {
            deuxFacteursActif: utilisateur.deuxFacteursActif,
            methodesDisponibles: [
                'applicationAuthenticator',
                'smsVerification',
                'emailVerification'
            ],
            niveauSecurite: this.evaluerNiveauSecurite(utilisateur)
        };
    }

    // Évaluer le niveau de sécurité
    static evaluerNiveauSecurite(utilisateur) {
        const criteres = [
            utilisateur.deuxFacteursActif,
            utilisateur.emailVerifie,
            utilisateur.appareilsConfiances.length > 0
        ];

        const niveauxSecurite = [
            'Faible',
            'Moyen',
            'Élevé'
        ];

        const score = criteres.filter(Boolean).length;
        return niveauxSecurite[score] || 'Faible';
    }
}

module.exports = DeuxFacteurs;
