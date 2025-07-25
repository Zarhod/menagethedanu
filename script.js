// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>
// Remplacez cette URL par l'URL de votre Cloudflare Worker déployé.
// Exemple : const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev';
const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev/';
// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>

document.addEventListener('DOMContentLoaded', () => {
    // Récupération des éléments DOM
    const completedTaskListDiv = document.getElementById('completedTaskList');
    const pendingTaskListDiv = document.getElementById('pendingTaskList');
    const scoresListDiv = document.getElementById('scoresList');
    const currentPodiumDiv = document.getElementById('currentPodium');
    const historyListDiv = document.getElementById('historyList');
    const resetScoresButton = document.getElementById('resetScoresButton');

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const loadingOverlay = document.getElementById('loadingOverlay'); // Référence à l'overlay de chargement
    const scoresTabButton = document.querySelector('.tab-button[data-tab="scores"]');

    const customAlertOverlay = document.getElementById('customAlertOverlay');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const closeAlertButton = customAlertOverlay.querySelector('.close-alert');
    const confirmAlertButton = customAlertOverlay.querySelector('.alert-button');

    // Variables pour la pop-up de saisie du nom (gestion de l'instance ouverte)
    let currentNameInputWrapper = null;
    let currentOverlay = null;

    // Nouvelle constante pour le header des tâches terminées
    const completedTasksSection = document.getElementById('completedTasksSection');
    const completedTasksHeader = completedTasksSection.querySelector('.completed-tasks-header');
    const completedTasksList = document.getElementById('completedTaskList');


    // Cache le bouton de réinitialisation par défaut (à afficher selon les conditions si besoin)
    resetScoresButton.classList.add('hidden');

    /**
     * Affiche une pop-up d'alerte personnalisée.
     * @param {string} title - Le titre de l'alerte.
     * @param {string} message - Le message de l'alerte.
     * @param {string} icon - L'icône (emoji) à afficher.
     */
    function showAlert(title, message, icon = '🎉') {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        customAlertOverlay.querySelector('.alert-icon').textContent = icon;
        customAlertOverlay.classList.add('visible');
    }

    // Gestionnaires d'événements pour fermer l'alerte
    closeAlertButton.addEventListener('click', () => {
        customAlertOverlay.classList.remove('visible');
    });

    confirmAlertButton.addEventListener('click', () => {
        customAlertOverlay.classList.remove('visible');
    });

    customAlertOverlay.addEventListener('click', (e) => {
        if (e.target === customAlertOverlay) {
            customAlertOverlay.classList.remove('visible');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && customAlertOverlay.classList.contains('visible')) {
            customAlertOverlay.classList.remove('visible');
        }
    });

    // Gestion des onglets
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            // Masque tous les onglets et contenus, puis active le bon
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Charge les données spécifiques à l'onglet
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

    // Logique pour le menu déroulant des tâches terminées
    completedTasksHeader.addEventListener('click', () => {
        const isCollapsed = completedTasksHeader.classList.contains('collapsed');
        if (isCollapsed) {
            completedTasksHeader.classList.remove('collapsed');
            completedTasksHeader.classList.add('expanded');
            completedTasksList.classList.add('visible');
        } else {
            completedTasksHeader.classList.remove('expanded');
            completedTasksHeader.classList.add('collapsed');
            completedTasksList.classList.remove('visible');
        }
    });


    /**
     * Charge et affiche le podium actuel dans l'onglet des tâches.
     */
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

        // Trie les scores par ordre décroissant
        scores.sort((a, b) => b.score - a.score);

        currentPodiumDiv.innerHTML = '<h2>Podium de la semaine</h2>';
        const ol = document.createElement('ol');
        ol.classList.add('podium-list');
        const podiumClasses = ['gold', 'silver', 'bronze']; // Classes pour les médailles

        // Affiche les 3 premiers du podium
        scores.slice(0, 3).forEach((player, index) => {
            const li = document.createElement('li');
            li.className = podiumClasses[index] || ''; // Applique la classe de médaille
            li.innerHTML = `
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score} points</span>
            `;
            ol.appendChild(li);
        });
        currentPodiumDiv.appendChild(ol);

        // Ajoute un bouton pour voir tous les scores
        const fullScoresButton = document.createElement('button');
        fullScoresButton.textContent = 'Voir tous les scores';
        fullScoresButton.className = 'full-scores-button flat-button';
        fullScoresButton.addEventListener('click', () => {
            scoresTabButton.click(); // Clique sur l'onglet scores pour y naviguer
        });
        currentPodiumDiv.appendChild(fullScoresButton);
    }

    /**
     * Affiche ou masque l'overlay de chargement avec le spinner.
     * @param {boolean} isVisible - True pour afficher, False pour masquer.
     */
    function showLoading(isVisible) {
        if (isVisible) {
            loadingOverlay.style.display = 'flex'; // Utilise flex pour le centrage CSS
        } else {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Effectue une requête GET vers le Cloudflare Worker.
     * Gère l'affichage du chargement et des alertes d'erreur.
     * @param {string} functionName - Le nom de la fonction à appeler sur le Worker.
     * @returns {Promise<any|null>} Les données de la réponse ou null en cas d'erreur.
     */
    async function fetchData(functionName) {
        showLoading(true); // Affiche le spinner
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}?function=${functionName}`);
            const data = await response.json();
            if (!response.ok) {
                showAlert('Erreur de chargement', data.error || `Erreur HTTP: ${response.status} pour ${functionName}`, '❌');
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel à ${functionName}:`, error);
            // L'alerte est déjà affichée par showAlert
            return null;
        } finally {
            showLoading(false); // Masque le spinner
        }
    }

    /**
     * Effectue une requête POST vers le Cloudflare Worker.
     * Gère l'affichage du chargement et des alertes d'erreur.
     * @param {string} functionName - Le nom de la fonction à appeler sur le Worker.
     * @param {object} payload - Les données à envoyer dans le corps de la requête.
     * @returns {Promise<any|null>} Les données de la réponse ou null en cas d'erreur.
     */
    async function postData(functionName, payload) {
        showLoading(true); // Affiche le spinner
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
                showAlert('Erreur lors de l\'opération', data.error || `Erreur HTTP: ${response.status} pour ${functionName}`, '❌');
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel POST à ${functionName}:`, error);
            // L'alerte est déjà affichée par showAlert
            return null;
        } finally {
            showLoading(false); // Masque le spinner
        }
    }

    /**
     * Charge et affiche les tâches en attente et terminées.
     */
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

        // Vide les listes avant d'ajouter de nouvelles tâches
        completedTaskListDiv.innerHTML = '';
        pendingTaskListDiv.innerHTML = '';

        const completedTasks = tasks.filter(task => task.Statut === 'Terminé');
        const pendingTasks = tasks.filter(task => task.Statut !== 'Terminé');

        // Affiche les tâches terminées
        if (completedTasks.length > 0) {
            completedTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item completed`;
                taskItem.innerHTML = `
                    <h3>${task.Description_Tache}</h3>
                    <p><span class="task-meta">Assigné à:</span> <strong>${task.Assignee}</strong> <span class="task-meta">le</span> ${task.Date_Prise ? new Date(task.Date_Prise).toLocaleDateString('fr-FR') : 'N/A'}</p>
                    <p><span class="task-score">Score:</span> ${task.Score}</p>
                `;
                completedTaskListDiv.appendChild(taskItem);
            });
            // Assurez-vous que le header est visible même si la liste est initialement repliée
            completedTasksHeader.style.display = 'flex'; // Affiche l'en-tête du menu déroulant
        } else {
            completedTaskListDiv.innerHTML = '<p class="info-message">Aucune tâche terminée cette semaine.</p>';
            completedTasksHeader.style.display = 'none'; // Masque l'en-tête si pas de tâches terminées
        }

        // Affiche les tâches en attente et ajoute des écouteurs d'événements
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item`;
                taskItem.setAttribute('data-task-id', task.ID_Tache);
                taskItem.innerHTML = `
                    <h3>${task.Description_Tache}</h3>
                    <p><span class="task-meta">Catégorie:</span> ${task.Libelle}</p>
                    <p><span class="task-score">Score:</span> ${task.Score}</p>
                `;
                pendingTaskListDiv.appendChild(taskItem);
            });

            document.querySelectorAll('.task-item:not(.completed)').forEach(taskCard => {
                taskCard.addEventListener('click', async (e) => {
                    // Empêche l'ouverture multiple de pop-ups
                    if (currentNameInputWrapper && currentNameInputWrapper.classList.contains('visible')) {
                        return;
                    }

                    // La correction cruciale : 'taskId' est déclaré localement ici.
                    const taskId = taskCard.getAttribute('data-task-id'); 

                    // Crée et affiche l'overlay de fond sombre
                    const overlay = document.createElement('div');
                    overlay.classList.add('name-input-overlay');
                    document.body.appendChild(overlay);
                    setTimeout(() => overlay.classList.add('visible'), 10);

                    // Crée et affiche la pop-up de saisie du nom
                    const nameInputWrapper = document.createElement('div');
                    nameInputWrapper.classList.add('name-input-wrapper');
                    nameInputWrapper.innerHTML = `
                        <h3>Prendre la tâche</h3>
                        <input type="text" placeholder="Entrez votre nom" class="assignee-name-input">
                        <div class="input-buttons">
                            <button class="submit-assignee-name flat-button">Valider</button>
                            <button class="cancel-button flat-button">Annuler</button>
                        </div>
                    `;
                    document.body.appendChild(nameInputWrapper);
                    setTimeout(() => nameInputWrapper.classList.add('visible'), 10);

                    // Affecte les variables globales pour pouvoir les gérer lors des clics extérieurs/escape
                    currentNameInputWrapper = nameInputWrapper;
                    currentOverlay = overlay;

                    const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                    const submitButton = nameInputWrapper.querySelector('.submit-assignee-name');
                    const cancelButton = nameInputWrapper.querySelector('.cancel-button');

                    nameInput.focus();

                    /**
                     * Masque la pop-up et l'overlay.
                     */
                    const hideInputWrapper = () => {
                        if (nameInputWrapper) {
                            nameInputWrapper.classList.remove('visible');
                            nameInputWrapper.addEventListener('transitionend', () => {
                                nameInputWrapper.remove();
                                currentNameInputWrapper = null;
                            }, { once: true });
                        }
                        if (overlay) {
                            overlay.classList.remove('visible');
                            overlay.addEventListener('transitionend', () => {
                                overlay.remove();
                                currentOverlay = null;
                            }, { once: true });
                        }
                    };

                    // Gère la soumission du nom
                    submitButton.addEventListener('click', async () => {
                        const assigneeName = nameInput.value.trim();
                        // 'taskId' est accessible ici grâce à la closure
                        if (assigneeName && taskId) {
                            const result = await postData('assignTask', { taskId: taskId, assigneeName });
                            if (result && result.success) {
                                showAlert('Merci pour votre implication !', result.message, '🎉');
                                hideInputWrapper();
                                loadTasks();
                                loadCurrentPodiumForTasksPage();
                                loadCurrentWeeklyScores();
                            }
                        } else {
                            showAlert('Champ vide ou tâche non sélectionnée', 'Veuillez entrer votre nom pour prendre la tâche.', '⚠️');
                            nameInput.focus();
                        }
                    });

                    // Gère l'annulation
                    cancelButton.addEventListener('click', hideInputWrapper);

                    // Ferme la pop-up si on clique en dehors
                    if (overlay) {
                        overlay.addEventListener('click', hideInputWrapper);
                    }

                    // Gère la touche Entrée et Échap
                    nameInput.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            submitButton.click();
                        } else if (event.key === 'Escape') {
                            hideInputWrapper();
                        }
                    });
                });
            });
        } else {
            pendingTaskListDiv.innerHTML = '<p class="info-message">Bravo ! Toutes les tâches sont faites pour le moment.</p>';
        }
    }

    /**
     * Charge et affiche les scores hebdomadaires actuels.
     */
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

    /**
     * Charge et affiche l'historique des podiums hebdomadaires.
     */
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

    // Gère le bouton de réinitialisation des scores (probablement dans l'onglet Scores)
    resetScoresButton.addEventListener('click', async () => {
        const confirmReset = await new Promise(resolve => {
            showAlert(
                'Confirmer la réinitialisation',
                'Êtes-vous sûr de vouloir réinitialiser les scores de la semaine ? Cela archivera le podium actuel.',
                '⚠️'
            );
            confirmAlertButton.onclick = () => {
                customAlertOverlay.classList.remove('visible');
                resolve(true);
                resetAlertHandlers();
            };
            closeAlertButton.onclick = () => {
                customAlertOverlay.classList.remove('visible');
                resolve(false);
                resetAlertHandlers();
            };
            customAlertOverlay.onclick = (e) => {
                if (e.target === customAlertOverlay) {
                    customAlertOverlay.classList.remove('visible');
                    resolve(false);
                    resetAlertHandlers();
                }
            };
        });

        if (confirmReset) {
            const result = await postData('resetWeeklyScores', {});
            if (result && result.success) {
                showAlert('Réinitialisation réussie', result.message, '✅');
                loadTasks();
                loadCurrentPodiumForTasksPage();
                loadCurrentWeeklyScores();
                loadWeeklyPodiums();
            }
        }
    });

    // Fonction pour réinitialiser les gestionnaires d'alerte à leur état par défaut
    function resetAlertHandlers() {
        confirmAlertButton.onclick = () => { customAlertOverlay.classList.remove('visible'); };
        closeAlertButton.onclick = () => { customAlertOverlay.classList.remove('visible'); };
        customAlertOverlay.onclick = (e) => {
            if (e.target === customAlertOverlay) { customAlertOverlay.classList.remove('visible'); }
        };
    }

    // Initialisation : charge les tâches et le podium au démarrage
    document.querySelector('.tab-button[data-tab="tasks"]').click();
});
