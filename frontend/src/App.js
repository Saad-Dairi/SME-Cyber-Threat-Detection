import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

// Centralise l'URL de l'API : une seule valeur à changer selon l'environnement
// (idéalement injectée via une variable d'environnement de build, ex. REACT_APP_API_URL)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// --- Icônes (SVG en ligne, remplace les emojis) ---

const ShieldIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 4 5.5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10v-6L12 2z" />
  </svg>
);

const BrainIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-1.5 5.2A3 3 0 0 0 6 18a3 3 0 0 0 3 3" />
    <path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 1.5 5.2A3 3 0 0 1 18 18a3 3 0 0 1-3 3" />
    <path d="M9 3v18M15 3v18" />
  </svg>
);

const AlertIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 2 20h20L12 3z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

const CheckIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const SearchIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const BlockedIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 8 8 8" />
  </svg>
);

const PulseIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h4l2-7 4 14 2-7h6" />
  </svg>
);

const ClockIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

const FileIcon = () => (
  <svg className="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

function App() {
  const [fichesReflexes, setFichesReflexes] = useState([]);
  const [menaces, setMenaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [urlTest, setUrlTest] = useState('');
  const [loadingIA, setLoadingIA] = useState(false);
  const [resultatAnalyse, setResultatAnalyse] = useState(null);
  const [loadingAnalyse, setLoadingAnalyse] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function chargerDonneesInitiales() {
      try {
        const [menacesRes, fichesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/menaces`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/fiches`, { signal: controller.signal })
        ]);

        if (menacesRes.ok) {
          setMenaces(await menacesRes.json());
        } else {
          console.error('Erreur menaces : réponse HTTP', menacesRes.status);
        }

        if (fichesRes.ok) {
          setFichesReflexes(await fichesRes.json());
        } else {
          console.error('Erreur fiches : réponse HTTP', fichesRes.status);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Erreur de chargement des données initiales :', error);
        }
      } finally {
        setLoading(false);
      }
    }

    chargerDonneesInitiales();
    return () => controller.abort();
  }, []);

  // Recherche en Blacklist en O(1) plutôt que de parcourir le tableau à chaque analyse
  const blacklistIndex = useMemo(() => {
    const index = new Set();
    menaces.forEach((m) => {
      if (m.URL) index.add(m.URL.toLowerCase());
    });
    return index;
  }, [menaces]);

  const trouverDansBlacklist = useCallback((urlSaisie) => {
    for (const urlConnue of blacklistIndex) {
      if (urlConnue.includes(urlSaisie)) return true;
    }
    return false;
  }, [blacklistIndex]);

  const lancerAnalyseComplete = useCallback(async (e) => {
    e.preventDefault();
    const urlSaisie = urlTest.trim();
    if (!urlSaisie) return;

    setLoadingAnalyse(true);
    setResultatAnalyse(null);

    // ETAPE 1 : Vérification dans la Blacklist
    if (trouverDansBlacklist(urlSaisie.toLowerCase())) {
      setResultatAnalyse({
        danger: true,
        source: 'Blacklist',
        type_menace: 'malware', // Par defaut pour la blacklist
        message: "Correspondance identifiée dans la base de renseignement sur les menaces. Accès à cette ressource déconseillé."
      });
      setLoadingAnalyse(false);
      return;
    }

    // ETAPE 2 : Analyse predictive par l'IA
    try {
      const reponse = await fetch(`${API_BASE_URL}/api/analyser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlSaisie })
      });
      const data = await reponse.json();

      if (!reponse.ok) {
        setResultatAnalyse({ error: data.error || "Le moteur d'analyse est actuellement indisponible." });
        return;
      }

      setResultatAnalyse({
        danger: data.danger,
        source: 'Intelligence Artificielle',
        type_menace: data.type_menace,
        message: data.message_alerte
      });
    } catch (error) {
      console.error("Erreur d'analyse IA :", error);
      setResultatAnalyse({ error: "Le moteur d'analyse est actuellement indisponible." });
    } finally {
      setLoadingAnalyse(false);
    }
  }, [urlTest, trouverDansBlacklist]);

  // Valeurs dérivées mémoïsées : recalculées uniquement quand leurs dépendances changent
  const totalBloquees = useMemo(() => menaces.length, [menaces]);
  const menacesActives = useMemo(
    () => menaces.filter((m) => m.Statut === 'online').length,
    [menaces]
  );
  const dernieresMenaces = useMemo(() => menaces.slice(0, 5), [menaces]);
  const ficheAffichee = useMemo(() => {
    if (!resultatAnalyse?.danger) return null;
    return fichesReflexes.find((f) => f.ID === resultatAnalyse.type_menace) || fichesReflexes[0] || null;
  }, [resultatAnalyse, fichesReflexes]);
  
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="eyebrow">
          <span className="pulse-dot" />
          Surveillance active — Flux en temps réel
        </div>
        <h1><ShieldIcon /> EMC <span>Threat Intelligence</span> Console</h1>
        <p className="subtitle">Plateforme de détection et d'analyse prédictive des cybermenaces, conçue pour les PME. Corrélation automatique avec la base de renseignement et évaluation comportementale par intelligence artificielle.</p>
      </header>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <BlockedIcon />
            <span className="kpi-label">Indicateurs de compromission recensés</span>
          </div>
          <div className="kpi-value">{totalBloquees}</div>
          <div className="kpi-sub">Depuis le début de la journée</div>
        </div>
        <div className="kpi-card kpi-card-alert">
          <div className="kpi-top">
            <PulseIcon />
            <span className="kpi-label">Menaces actuellement actives</span>
          </div>
          <div className="kpi-value">{menacesActives}</div>
          <div className="kpi-sub">Infrastructures compromises en ligne</div>
        </div>
      </div>

      {/* MODULE UNIFIÉ : SCANNER GLOBAL */}
      <div className="module-card">
        <div className="module-heading">
          <BrainIcon />
          <h3>Analyse d'URL — Réputation & Modèle prédictif</h3>
        </div>
        <p className="module-description">Chaque URL est d'abord confrontée à la base de renseignement sur les menaces connues. En l'absence de correspondance, elle est soumise au modèle d'analyse comportementale pour une évaluation prédictive du risque.</p>

        <form onSubmit={lancerAnalyseComplete} className="cyber-form">
          <input
            type="text"
            className="cyber-input"
            placeholder="https://exemple-suspect.com — saisir l'URL à analyser"
            value={urlTest}
            onChange={(e) => setUrlTest(e.target.value)}
          />
          <button type="submit" className="cyber-button" disabled={loadingAnalyse}>
            {loadingAnalyse ? (
              <>
                <span className="spinner" />
                Analyse en cours…
              </>
            ) : (
              <>
                <SearchIcon />
                Lancer l'analyse
              </>
            )}
          </button>
        </form>

        {resultatAnalyse && !resultatAnalyse.error && (
          <div className="analyse-result">
            <div className={`alert-box ${resultatAnalyse.danger ? 'alert-danger' : 'alert-success'}`}>
              {resultatAnalyse.danger ? <AlertIcon /> : <CheckIcon />}
              <span>
                <strong>[{resultatAnalyse.source}]</strong> {resultatAnalyse.message}
              </span>
            </div>

            {/* Affichage contextuel dynamique de la fiche reflexe */}
            {ficheAffichee && (
              <div className="fiche-card fiche-card-alert">
                <div className="fiche-card-header">
                  <FileIcon />
                  <h4>{ficheAffichee.Titre}</h4>
                </div>
                <p className="fiche-desc">{ficheAffichee.Description}</p>
                <ul>
                  {ficheAffichee.Actions && ficheAffichee.Actions.map((action, i) => (
                    <li key={i} className="fiche-card-action">{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {resultatAnalyse && resultatAnalyse.error && (
          <div className="alert-box alert-danger">
            <AlertIcon />
            {resultatAnalyse.error} — Vérifiez que le moteur d'analyse est disponible et réessayez.
          </div>
        )}
      </div>

      {/* TOP 5 DES MENACES RÉCENTES */}
      <div className="module-card">
        <div className="module-heading">
          <ClockIcon />
          <h3>Activité récente</h3>
        </div>
        <p className="module-description">Cinq dernières entrées remontées par le flux de renseignement sur les menaces (Threat Intelligence Feed).</p>

        {loading ? (
          <div className="loading-state">Synchronisation avec la base de renseignement…</div>
        ) : dernieresMenaces.length === 0 ? (
          <div className="empty-state">Aucun indicateur de menace référencé pour le moment.</div>
        ) : (
          <ul className="threat-list">
            {dernieresMenaces.map((menace, index) => (
              <li key={index} className="threat-item">
                <span className="url-cell">{menace.URL}</span>
                <span className={`status-badge ${menace.Statut === 'online' ? 'status-active' : 'status-offline'}`}>
                  <span className="dot" />
                  {menace.Statut === 'online' ? 'Actif' : 'Hors-ligne'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;