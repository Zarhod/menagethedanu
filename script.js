// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>
// Remplacez cette URL par l'URL de votre Cloudflare Worker déployé.
// Exemple : const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev';
const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev/'; 
// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>

document.addEventListener('DOMContentLoaded', () => {
    const completedTaskListDiv = document.getElementById('completedTaskList'); 
    const pendingTaskListDiv = document.getElementById('pendingTaskList');   
    const scoresListDiv = document.getElementById('scoresList');
    const currentPodiumDiv = document.getElementById('currentPodium'); 
    const historyListDiv = document.getElementById('historyList');
    const resetScoresButton = document.getElementById('resetScoresButton'); // Garde la référence

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const loadingOverlay = document.getElementById('loadingOverlay');
    const scoresTabButton = document.querySelector('.tab-button[data-tab="scores"]');

    // Nouveaux éléments pour la popup personnalisée
    const customAlertOverlay = document.getElementById('customAlertOverlay');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const closeAlertButton = customAlertOverlay.querySelector('.close-alert');
    const confirmAlertButton = customAlertOverlay.querySelector('.alert-button');

    // Cacher le bouton de réinitialisation au chargement
    resetScoresButton.classList.add('hidden');

    // Fonction pour afficher la popup personnalisée
    function showAlert(title, message, icon = '🎉') {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        customAlertOverlay.querySelector('.alert-icon').textContent = icon; // Met à jour l'icône
        customAlertOverlay.classList.add('visible');
    }

    // Gestion de la fermeture de la popup
    closeAlertButton.addEventListener('click', () => {
        customAlertOverlay.classList.remove('visible');
    });

    confirmAlertButton.addEventListener('click', () => {
        customAlertOverlay.classList.remove('visible');
    });

    // Optionnel: Fermer la popup en cliquant en dehors
    customAlertOverlay.addEventListener('click', (e) => {
        if (e.target === customAlertOverlay) {
            customAlertOverlay.classList.remove('visible');
        }
    });
    // Optionnel: Fermer la popup avec la touche Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && customAlertOverlay.classList.contains('visible')) {
            customAlertOverlay.classList.remove('visible');
        }
    });

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
        currentPodiumDiv.innerHTML = '<p class="info-message">Chargement du podium...</p>';
        const scores = await fetchData('getCurrentWeeklyScores');
        
        if (!Array.isArray(scores)) {
            currentPodiumDiv.innerHTML = '<p class="error-message">Impossible de charger le podium.</p>';
            return;
        }

        if (scores.length === 0) {
            currentPodiumDiv.innerHTML = '<p class="info-message">Le podium sera affiché après la première tâche !</p>';
            return;
        }

        scores.sort((a, b) => b.score - a.score); 

        currentPodiumDiv.innerHTML = '<h2>Podium de la semaine</h2>';
        const ol = document.createElement('ol');
        ol.classList.add('podium-list'); 
        const podiumClasses = ['gold', 'silver', 'bronze'];

        scores.slice(0, 3).forEach((player, index) => { 
            const li = document.createElement('li');
            li.className = podiumClasses[index] || ''; 
            li.innerHTML = `
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score} points</span>
            `;
            ol.appendChild(li);
        });
        currentPodiumDiv.appendChild(ol);

        const fullScoresButton = document.createElement('button');
        fullScoresButton.textContent = 'Voir tous les scores';
        fullScoresButton.className = 'full-scores-button flat-button'; // Nouvelle classe
        fullScoresButton.addEventListener('click', () => {
            scoresTabButton.click();
        });
        currentPodiumDiv.appendChild(fullScoresButton);
    }

    // --- Fonctions d'appel API ---

    function showLoading(isVisible) {
        if (isVisible) {
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }

    async function fetchData(functionName) {
        showLoading(true);
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}?function=${functionName}`);
            const data = await response.json();
            if (!response.ok) {
                // Utilise la nouvelle popup pour les erreurs API
                showAlert('Erreur de chargement', data.error || `Erreur HTTP: ${response.status} pour ${functionName}`, '❌');
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel à ${functionName}:`, error);
            // Alert déjà géré par showAlert dans le bloc try
            return null;
        } finally {
            showLoading(false);
        }
    }

    async function postData(functionName, payload) {
        showLoading(true);
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
                // Utilise la nouvelle popup pour les erreurs API
                showAlert('Erreur lors de l\'opération', data.error || `Erreur HTTP: ${response.status} pour ${functionName}`, '❌');
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel POST à ${functionName}:`, error);
            // Alert déjà géré par showAlert dans le bloc try
            return null;
        } finally {
            showLoading(false);
        }
    }

    // --- Fonctions de chargement et d'affichage des données ---

    async function loadTasks() {
        completedTaskListDiv.innerHTML = '<p class="info-message">Chargement des tâches terminées...</p>';
        pendingTaskListDiv.innerHTML = '<p class="info-message">Chargement des tâches à faire...</p>';
        
        const tasks = await fetchData('getTasks');
        
        if (!Array.isArray(tasks)) {
            console.error("Les données reçues de 'getTasks' ne sont pas un tableau:", tasks);
            completedTaskListDiv.innerHTML = '<p class="error-message">Erreur: Impossible de charger les tâches. La réponse de l\'API est invalide.</p>';
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
            completedTaskListDiv.innerHTML = '<p class="info-message">Aucune tâche terminée cette semaine.</p>';
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
                    <button class="assign-button flat-button" data-task-id="${task.ID_Tache}">Prendre cette tâche</button>
                `;
                pendingTaskListDiv.appendChild(taskItem);
            });

            document.querySelectorAll('.assign-button').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const taskId = e.target.dataset.taskId;
                    const buttonElement = e.target; 
                    
                    if (buttonElement.dataset.promptOpen === 'true') {
                        return; 
                    }
                    buttonElement.dataset.promptOpen = 'true';

                    const nameInputWrapper = document.createElement('div');
                    nameInputWrapper.className = 'name-input-wrapper hidden';
                    nameInputWrapper.innerHTML = `
                        <input type="text" placeholder="Entrez votre nom" class="assignee-name-input">
                        <button class="submit-assignee-name flat-button">Valider</button>
                    `;
                    
                    buttonElement.parentNode.insertBefore(nameInputWrapper, buttonElement.nextSibling);
                    buttonElement.style.display = 'none'; 
                    
                    setTimeout(() => {
                        nameInputWrapper.classList.remove('hidden');
                        const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                        nameInput.focus();
                    }, 10);

                    const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                    const submitButton = nameInputWrapper.querySelector('.submit-assignee-name');

                    submitButton.addEventListener('click', async () => {
                        const assigneeName = nameInput.value.trim();
                        if (assigneeName) {
                            const result = await postData('assignTask', { taskId, assigneeName });
                            if (result && result.success) {
                                showAlert('Merci pour votre implication !', result.message, '🎉'); // Nouvelle popup
                                loadTasks();
                                loadCurrentPodiumForTasksPage(); 
                                loadCurrentWeeklyScores();
                            } else if (result && result.message) {
                                // Erreur déjà gérée par postData avec showAlert
                            }
                        } else {
                            showAlert('Champ vide', 'Veuillez entrer votre nom pour prendre la tâche.', '⚠️'); // Nouvelle popup pour validation
                        }
                        // Masquer et supprimer l'input wrapper après l'opération
                        nameInputWrapper.classList.add('hidden');
                        nameInputWrapper.addEventListener('transitionend', () => {
                            nameInputWrapper.remove();
                            buttonElement.style.display = 'block';
                            delete buttonElement.dataset.promptOpen;
                        }, { once: true });
                    });

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
            pendingTaskListDiv.innerHTML = '<p class="info-message">Bravo ! Toutes les tâches sont faites pour le moment.</p>';
        }
    }

    async function loadCurrentWeeklyScores() {
        scoresListDiv.innerHTML = '<p class="info-message">Chargement des scores...</p>';
        
        const scores = await fetchData('getCurrentWeeklyScores');
        
        if (!Array.isArray(scores)) {
            console.error("Les données reçues de 'getCurrentWeeklyScores' ne sont pas un tableau:", scores);
            scoresListDiv.innerHTML = '<p class="error-message">Erreur: Impossible de charger les scores. La réponse de l\'API est invalide.</p>';
            return;
        }

        scoresListDiv.innerHTML = '';
        
        if (scores.length === 0) {
            scoresListDiv.innerHTML = '<p class="info-message">Aucun score enregistré pour cette semaine.</p>';
            return;
        }
        
        const ul = document.createElement('ul');
        ul.classList.add('scores-full-list'); 
        scores.sort((a, b) => b.score - a.score); 

        scores.forEach(score => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${score.name}</strong> <span>${score.score} points</span>`;
            ul.appendChild(li);
        });
        scoresListDiv.appendChild(ul);
    }

    async function loadWeeklyPodiums() {
        historyListDiv.innerHTML = '<p class="info-message">Chargement de l\'historique...</p>';
        const podiums = await fetchData('getWeeklyPodiums');
        
        if (!Array.isArray(podiums)) {
            console.error("Les données reçues de 'getWeeklyPodiums' ne sont pas un tableau:", podiums);
            historyListDiv.innerHTML = '<p class="error-message">Erreur: Impossible de charger l\'historique des podiums. La réponse de l\'API est invalide.</p>';
            return;
        }

        historyListDiv.innerHTML = '';
        if (podiums.length === 0) {
            historyListDiv.innerHTML = '<p class="info-message">Aucun podium enregistré pour le moment.</p>';
            return;
        }
        podiums.sort((a, b) => b.week.localeCompare(a.week)); 
        podiums.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            let podiumHtml = '';
            if (item.podium && item.podium.length > 0) {
                podiumHtml = '<ol class="podium-history-list">'; 
                item.podium.forEach((p, index) => {
                    const podiumClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
                    podiumHtml += `<li class="${podiumClass}"><strong>${p.name}</strong> <span>${p.score} points</span></li>`;
                });
                podiumHtml += '</ol>';
            } else {
                podiumHtml = '<p class="info-message">Pas de participants cette semaine-là.</p>';
            }
            historyItem.innerHTML = `
                <h3>${item.week}</h3>
                ${podiumHtml}
            `;
            historyListDiv.appendChild(historyItem);
        });
    }

    // Le bouton de réinitialisation n'est plus écouté ici, car il est géré via le sheet.
    // L'ancienne fonction resetScoresButton.addEventListener('click', ...) est supprimée.

    // Charger les données initiales au démarrage
    document.querySelector('.tab-button[data-tab="tasks"]').click();
});
