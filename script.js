// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>
// Remplacez cette URL par l'URL de votre Cloudflare Worker déployé.
// Elle DOIT être l'adresse de base de votre Worker, sans aucun '?' ni paramètre.
// Exemple : const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev';
const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev/'; 
// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>

document.addEventListener('DOMContentLoaded', () => {
    const completedTaskListDiv = document.getElementById('completedTaskList'); 
    const pendingTaskListDiv = document.getElementById('pendingTaskList');   
    const scoresListDiv = document.getElementById('scoresList');
    const currentPodiumDiv = document.getElementById('currentPodium'); 
    const historyListDiv = document.getElementById('historyList');
    const resetScoresButton = document.getElementById('resetScoresButton');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Nouveaux éléments pour le chargement et la navigation
    const loadingOverlay = document.getElementById('loadingOverlay'); // Ajouté pour le spinner
    const scoresTabButton = document.querySelector('.tab-button[data-tab="scores"]'); // Bouton de l'onglet Scores

    // --- Fonctions de gestion des onglets ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            // Désactiver tous les boutons et contenus
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activer le bouton et le contenu cliqué
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Charger les données spécifiques à l'onglet
            if (tabId === 'tasks') {
                loadTasks();
                // Charger le podium actuel également sur l'onglet tâches
                loadCurrentPodiumForTasksPage(); 
            } else if (tabId === 'scores') {
                loadCurrentWeeklyScores();
            } else if (tabId === 'history') {
                loadWeeklyPodiums();
            }
        });
    });

    // Nouvelle fonction pour charger et afficher le podium sur la page des tâches
    async function loadCurrentPodiumForTasksPage() {
        currentPodiumDiv.innerHTML = '<p class="loading-message">Chargement du podium...</p>';
        const scores = await fetchData('getCurrentWeeklyScores');
        
        if (!Array.isArray(scores)) {
            currentPodiumDiv.innerHTML = '<p class="error-message">Impossible de charger le podium.</p>';
            return;
        }

        if (scores.length === 0) {
            currentPodiumDiv.innerHTML = '<p class="info-message">Le podium sera affiché après la première tâche !</p>';
            return;
        }

        // Trier les scores par ordre décroissant
        scores.sort((a, b) => b.score - a.score); 

        currentPodiumDiv.innerHTML = '<h2>Podium de la semaine</h2>';
        const ol = document.createElement('ol');
        ol.classList.add('podium-list'); // Ajout d'une classe pour le style
        const podiumClasses = ['gold', 'silver', 'bronze'];

        scores.slice(0, 3).forEach((player, index) => { 
            const li = document.createElement('li');
            li.className = podiumClasses[index] || ''; 
            li.innerHTML = `
                <span class="rank">${index + 1}.</span>
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score} points</span>
            `;
            ol.appendChild(li);
        });
        currentPodiumDiv.appendChild(ol);

        // Ajouter le bouton "Scores Complets"
        const fullScoresButton = document.createElement('button');
        fullScoresButton.textContent = 'Voir tous les scores';
        fullScoresButton.className = 'full-scores-button';
        fullScoresButton.addEventListener('click', () => {
            // Simuler le clic sur l'onglet "Scores"
            scoresTabButton.click();
            // Optionnel: Défiler jusqu'à la liste des scores si elle est longue
            // document.getElementById('scores-tab').scrollIntoView({ behavior: 'smooth' });
        });
        currentPodiumDiv.appendChild(fullScoresButton);
    }

    // --- Fonctions d'appel API ---

    // Fonction pour afficher/masquer le spinner de chargement
    function showLoading(isVisible) {
        if (isVisible) {
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Effectue une requête GET vers le Cloudflare Worker.
     * @param {string} functionName Le nom de la fonction Apps Script à appeler.
     * @returns {Promise<Object|null>} Les données JSON de la réponse ou null en cas d'erreur.
     */
    async function fetchData(functionName) {
        showLoading(true); // Afficher le spinner
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}?function=${functionName}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel à ${functionName}:`, error);
            alert(`Impossible de charger les données : ${error.message}`);
            return null;
        } finally {
            showLoading(false); // Masquer le spinner
        }
    }

    /**
     * Effectue une requête POST vers le Cloudflare Worker.
     * @param {string} functionName Le nom de la fonction Apps Script à appeler.
     * @param {Object} payload Les données à envoyer dans le corps de la requête.
     * @returns {Promise<Object|null>} Les données JSON de la réponse ou null en cas d'erreur.
     */
    async function postData(functionName, payload) {
        showLoading(true); // Afficher le spinner
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}?function=${functionName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel POST à ${functionName}:`, error);
            alert(`Erreur lors de l'opération : ${error.message}`);
            return null;
        } finally {
            showLoading(false); // Masquer le spinner
        }
    }

    // --- Fonctions de chargement et d'affichage des données (inchangées ou avec petites corrections) ---

    async function loadTasks() {
        completedTaskListDiv.innerHTML = '<p class="task-meta">Chargement des tâches terminées...</p>';
        pendingTaskListDiv.innerHTML = '<p>Chargement des tâches à faire...</p>';
        
        const tasks = await fetchData('getTasks');
        
        if (!Array.isArray(tasks)) {
            console.error("Les données reçues de 'getTasks' ne sont pas un tableau:", tasks);
            completedTaskListDiv.innerHTML = '<p class="task-meta error">Erreur: Impossible de charger les tâches. La réponse de l\'API est invalide.</p>';
            pendingTaskListDiv.innerHTML = '';
            return;
        }

        completedTaskListDiv.innerHTML = '';
        pendingTaskListDiv.innerHTML = ''; 
        
        const completedTasks = tasks.filter(task => task.Statut === 'Terminé');
        const pendingTasks = tasks.filter(task => task.Statut !== 'Terminé');

        // Afficher les tâches terminées
        if (completedTasks.length > 0) {
            completedTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item completed`; 
                taskItem.innerHTML = `
                    <h3>${task.Description_Tache}</h3>
                    <p><span class="task-meta">Assigné à:</span> <strong>${task.Assignee}</strong> <span class="task-meta">le</span> ${task.Date_Prise}</p>
                    <p><span class="task-score">Score:</span> ${task.Score}</p>
                `;
                completedTaskListDiv.appendChild(taskItem);
            });
        } else {
            completedTaskListDiv.innerHTML = '<p class="task-meta">Aucune tâche terminée cette semaine.</p>';
        }

        // Afficher les tâches à faire
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item`;
                taskItem.innerHTML = `
                    <h3>${task.Description_Tache}</h3>
                    <p><span class="task-meta">Catégorie:</span> ${task.Libelle}</p>
                    <p><span class="task-score">Score:</span> ${task.Score}</p>
                    <button class="assign-button" data-task-id="${task.ID_Tache}">Prendre cette tâche</button>
                `;
                pendingTaskListDiv.appendChild(taskItem);
            });

            // Attacher les écouteurs d'événements après que les éléments soient dans le DOM
            document.querySelectorAll('.assign-button').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const taskId = e.target.dataset.taskId;
                    const buttonElement = e.target; 
                    
                    // Empêcher les clics multiples tant que le prompt est ouvert
                    if (buttonElement.dataset.promptOpen === 'true') {
                        return; 
                    }
                    buttonElement.dataset.promptOpen = 'true';

                    // Créer et afficher le champ de saisie du nom avec animation
                    const nameInputWrapper = document.createElement('div');
                    nameInputWrapper.className = 'name-input-wrapper hidden'; // Commencer caché
                    nameInputWrapper.innerHTML = `
                        <input type="text" placeholder="Entrez votre nom" class="assignee-name-input">
                        <button class="submit-assignee-name">Valider</button>
                    `;
                    
                    buttonElement.parentNode.insertBefore(nameInputWrapper, buttonElement.nextSibling);
                    buttonElement.style.display = 'none'; 
                    
                    // Déclencher l'animation après l'insertion dans le DOM
                    setTimeout(() => {
                        nameInputWrapper.classList.remove('hidden');
                        const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                        nameInput.focus();
                    }, 10); // Petit délai pour laisser le DOM se rafraîchir

                    const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                    const submitButton = nameInputWrapper.querySelector('.submit-assignee-name');

                    submitButton.addEventListener('click', async () => {
                        const assigneeName = nameInput.value.trim();
                        if (assigneeName) {
                            const result = await postData('assignTask', { taskId, assigneeName });
                            if (result && result.success) {
                                alert(result.message);
                                loadTasks(); // Recharger les tâches pour mettre à jour l'affichage
                                loadCurrentPodiumForTasksPage(); // Recharger le podium sur la page des tâches
                                loadCurrentWeeklyScores(); // Mettre à jour les scores également
                            } else if (result && result.message) {
                                alert(`Erreur: ${result.message}`);
                            }
                        } else {
                            alert('Veuillez entrer votre nom.');
                        }
                        // Masquer et supprimer l'input wrapper après l'opération
                        nameInputWrapper.classList.add('hidden');
                        nameInputWrapper.addEventListener('transitionend', () => {
                            nameInputWrapper.remove();
                            buttonElement.style.display = 'block';
                            delete buttonElement.dataset.promptOpen;
                        }, { once: true });
                    });

                    // Annuler la saisie si l'utilisateur clique ailleurs ou appuie sur Échap
                    const cancelInput = (event) => {
                        if (!nameInputWrapper.contains(event.target) && event.target !== buttonElement) {
                            nameInputWrapper.classList.add('hidden');
                            nameInputWrapper.addEventListener('transitionend', () => {
                                nameInputWrapper.remove();
                                buttonElement.style.display = 'block';
                                delete buttonElement.dataset.promptOpen;
                            }, { once: true });
                            document.removeEventListener('click', cancelInput);
                        }
                    };
                    setTimeout(() => {
                        document.addEventListener('click', cancelInput);
                    }, 100);

                    nameInput.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            submitButton.click();
                        } else if (event.key === 'Escape') {
                            nameInputWrapper.classList.add('hidden');
                            nameInputWrapper.addEventListener('transitionend', () => {
                                nameInputWrapper.remove();
                                buttonElement.style.display = 'block';
                                delete buttonElement.dataset.promptOpen;
                            }, { once: true });
                        }
                    });
                });
            });
        } else {
            pendingTaskListDiv.innerHTML = '<p>Bravo ! Toutes les tâches sont faites pour le moment.</p>';
        }
    }

    async function loadCurrentWeeklyScores() {
        scoresListDiv.innerHTML = '<p>Chargement des scores...</p>';
        
        const scores = await fetchData('getCurrentWeeklyScores');
        
        if (!Array.isArray(scores)) {
            console.error("Les données reçues de 'getCurrentWeeklyScores' ne sont pas un tableau:", scores);
            scoresListDiv.innerHTML = '<p class="error">Erreur: Impossible de charger les scores. La réponse de l\'API est invalide.</p>';
            return;
        }

        scoresListDiv.innerHTML = '';
        
        if (scores.length === 0) {
            scoresListDiv.innerHTML = '<p>Aucun score enregistré pour cette semaine.</p>';
            return;
        }
        
        const ul = document.createElement('ul');
        ul.classList.add('scores-full-list'); // Ajout d'une classe pour le défilement
        scores.sort((a, b) => b.score - a.score); 

        scores.forEach(score => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${score.name}</strong> <span>${score.score} points</span>`;
            ul.appendChild(li);
        });
        scoresListDiv.appendChild(ul);
    }

    async function loadWeeklyPodiums() {
        historyListDiv.innerHTML = '<p>Chargement de l\'historique...</p>';
        const podiums = await fetchData('getWeeklyPodiums');
        
        if (!Array.isArray(podiums)) {
            console.error("Les données reçues de 'getWeeklyPodiums' ne sont pas un tableau:", podiums);
            historyListDiv.innerHTML = '<p class="error">Erreur: Impossible de charger l\'historique des podiums. La réponse de l\'API est invalide.</p>';
            return;
        }

        historyListDiv.innerHTML = '';
        if (podiums.length === 0) {
            historyListDiv.innerHTML = '<p>Aucun podium enregistré pour le moment.</p>';
            return;
        }
        podiums.sort((a, b) => b.week.localeCompare(a.week)); 
        podiums.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            let podiumHtml = '';
            if (item.podium && item.podium.length > 0) {
                podiumHtml = '<ol class="podium-history-list">'; // Nouvelle classe
                item.podium.forEach((p, index) => {
                    const podiumClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
                    podiumHtml += `<li class="${podiumClass}"><strong>${p.name}</strong> <span>${p.score} points</span></li>`;
                });
                podiumHtml += '</ol>';
            } else {
                podiumHtml = '<p>Pas de participants cette semaine.</p>';
            }
            historyItem.innerHTML = `
                <h3>${item.week}</h3>
                ${podiumHtml}
            `;
            historyListDiv.appendChild(historyItem);
        });
    }

    // --- Gestion du bouton de réinitialisation des scores ---
    resetScoresButton.addEventListener('click', async () => {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser les scores hebdomadaires et enregistrer le podium ? Cela réinitialisera également toutes les tâches à "À faire".')) {
            const result = await postData('resetAndSaveScores', {});
            if (result && result.success) {
                alert(result.message);
                loadTasks();
                loadCurrentPodiumForTasksPage(); // Recharger le podium sur la page des tâches
                loadCurrentWeeklyScores();
                loadWeeklyPodiums();
            } else if (result && result.message) {
                 alert(`Erreur: ${result.message}`); 
            }
        }
    });

    // Charger les données initiales au démarrage
    document.querySelector('.tab-button[data-tab="tasks"]').click();
});
