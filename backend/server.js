require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;
const IA_ENGINE_URL = process.env.IA_ENGINE_URL || 'http://localhost:5000/predict';
const IA_TIMEOUT_MS = 8000;
const CSV_CACHE_TTL_MS = 60_000; // Evite de re-parser les CSV à chaque requête

// --- CONFIGURATION DU MODULE D'ALERTE EMAIL ---
// Les identifiants ne doivent jamais être en dur dans le code : voir .env
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

app.use(cors());
app.use(express.json());

// --- CACHE CSV GENERIQUE ---
// Evite de relire/reparser le fichier disque à chaque requête tant que le TTL n'est pas expiré.
const csvCache = new Map(); // filePath -> { data, expiresAt }

function lireCsv(filePath, { transform } = {}) {
    const cached = csvCache.get(filePath);
    if (cached && cached.expiresAt > Date.now()) {
        return Promise.resolve(cached.data);
    }

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`Fichier introuvable : ${filePath}`));
        }

        const resultats = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (ligne) => resultats.push(transform ? transform(ligne) : ligne))
            .on('end', () => {
                csvCache.set(filePath, { data: resultats, expiresAt: Date.now() + CSV_CACHE_TTL_MS });
                resolve(resultats);
            })
            .on('error', reject);
    });
}

// --- ROUTE 1 : Récupérer les menaces connues ---
app.get('/api/menaces', async (req, res) => {
    try {
        const csvFilePath = path.join(__dirname, '../data_collection/menaces.csv');
        const menaces = await lireCsv(csvFilePath);
        res.json(menaces);
    } catch (error) {
        console.error('[EMC] Erreur de lecture menaces.csv :', error.message);
        res.status(500).json({ error: 'Erreur de lecture de la base de menaces.' });
    }
});

// --- ROUTE 2 : Analyser une nouvelle URL avec l'API IA (Python) ---
app.post('/api/analyser', async (req, res) => {
    const urlSoumise = req.body?.url?.trim();

    if (!urlSoumise) {
        return res.status(400).json({ error: "Requête invalide : le champ URL est requis pour lancer l'analyse." });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), IA_TIMEOUT_MS);

        let pythonResponse;
        try {
            pythonResponse = await fetch(IA_ENGINE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlSoumise }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!pythonResponse.ok) {
            throw new Error(`Le moteur IA a répondu avec le statut ${pythonResponse.status}`);
        }

        const resultatIA = await pythonResponse.json();

        if (resultatIA.error) {
            return res.status(502).json({ error: resultatIA.error });
        }

        if (resultatIA.danger === true) {
            envoyerAlerteEmail(urlSoumise, resultatIA.type_menace).catch((error) =>
                console.error("[EMC] Erreur lors de l'envoi de l'alerte email :", error.message)
            );
        }

        res.json({
            url_analysee: urlSoumise,
            danger: resultatIA.danger,
            type_menace: resultatIA.type_menace,
            message_alerte: resultatIA.danger
                ? "Activité malveillante confirmée par le modèle d'analyse comportementale."
                : "Aucune activité malveillante détectée. L'URL est considérée comme fiable."
        });

    } catch (error) {
        const injoignable = error.name === 'AbortError';
        console.error('[EMC] Erreur de communication avec le moteur IA :', error.message);
        res.status(503).json({
            error: injoignable
                ? "Le moteur d'analyse prédictive n'a pas répondu à temps."
                : "Le moteur d'analyse prédictive est actuellement injoignable. Réessayez ultérieurement."
        });
    }
});

// --- ROUTE 3 : Récupérer les fiches réflexes depuis le CSV ---
app.get('/api/fiches', async (req, res) => {
    try {
        const cheminFiches = path.join(__dirname, '../data_collection/fiches.csv');
        const fiches = await lireCsv(cheminFiches, {
            // Transformation de la chaine "Action1|Action2" en tableau ["Action1", "Action2"]
            transform: (ligne) => ({
                ...ligne,
                Actions: ligne.Actions ? ligne.Actions.split('|') : []
            })
        });
        res.json(fiches);
    } catch (error) {
        console.error('[EMC] Erreur de lecture fiches.csv :', error.message);
        res.status(500).json({ error: 'Erreur lors de la lecture des fiches réflexes.' });
    }
});

// --- Envoi de l'alerte email (séparé de la route pour ne pas bloquer la réponse HTTP) ---
async function envoyerAlerteEmail(urlSoumise, typeMenace) {
    const mailOptions = {
        from: `"EMC Threat Intelligence" <${process.env.SMTP_USER}>`,
        to: process.env.ALERT_RECIPIENT || process.env.SMTP_USER,
        subject: `[EMC] Alerte de sécurité — Menace ${typeMenace.toUpperCase()} détectée`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0a0e14; color: #ff5c6c; padding: 18px 24px;">
                    <h2 style="margin: 0; font-size: 18px;">Alerte de sécurité — Priorité élevée</h2>
                </div>
                <div style="padding: 24px; color: #1a1a1a;">
                    <p style="margin-top: 0;">Le module d'analyse comportementale a identifié une activité correspondant au profil d'une menace connue. Une intervention est requise.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; color: #666; width: 160px;">Ressource ciblée</td>
                            <td style="padding: 8px 0; font-weight: bold; word-break: break-all;">${urlSoumise}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Type de menace</td>
                            <td style="padding: 8px 0; font-weight: bold; color: #d32f2f; text-transform: uppercase;">${typeMenace}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Horodatage</td>
                            <td style="padding: 8px 0;">${new Date().toLocaleString('fr-FR')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Source de détection</td>
                            <td style="padding: 8px 0;">Moteur d'analyse comportementale (IA)</td>
                        </tr>
                    </table>
                    <p style="margin-bottom: 0;">Accédez à la console pour consulter la fiche réflexe associée et engager la procédure d'isolement si nécessaire.</p>
                </div>
                <div style="background-color: #f5f5f5; padding: 12px 24px; font-size: 12px; color: #888;">
                    Notification automatique générée par la console EMC Threat Intelligence.
                </div>
            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[EMC] Alerte email envoyée avec succès :', info.response);
}

app.listen(PORT, () => {
    console.log(`[EMC] API démarrée — http://localhost:${PORT}`);
    console.log(`[EMC] Endpoint d'analyse prédictive actif : POST /api/analyser`);
});