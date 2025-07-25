// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>
// Remplacez cette URL par l'URL de votre Cloudflare Worker déployé.
// Exemple : const CLOUDFLARE_WORKER_URL = 'https://apps-script-proxy.votre-nom-utilisateur.workers.dev';
const CLOUDFLARE_WORKER_URL = 'https://menagetd.jassairbus.workers.dev/?function=getTasks'; 
// <<<<<<<<<<<<<<<<<<<<< TRÈS IMPORTANT >>>>>>>>>>>>>>>>>>>>>>>

document.addEventListener('DOMContentLoaded', () => {
    const completedTaskListDiv = document.getElementById('completedTaskList'); 
    const pendingTaskListDiv = document.getElementById('pendingTaskList');   
    const scoresListDiv = document.getElementById('scoresList');
    const currentPodiumDiv = document.getElementById('currentPodium'); // Nouveau div pour le podium actuel
    const historyListDiv = document.getElementById('historyList');
    const resetScoresButton = document.getElementById('resetScoresButton');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

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
            } else if (tabId === 'scores') {
                loadCurrentWeeklyScores();
            } else if (tabId === 'history') {
                loadWeeklyPodiums();
            }
        });
    });

    // --- Fonctions d'appel API ---

    /**
     * Effectue une requête GET vers le Cloudflare Worker.
     * @param {string} functionName Le nom de la fonction Apps Script à appeler.
     * @returns {Promise<Object>} Les données JSON de la réponse.
     */
    async function fetchData(functionName) {
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}?function=${functionName}`);
            const data = await response.json();
            if (!response.ok) {
                // Si le statut HTTP n'est pas OK (ex: 400, 500), et qu'il y a un message d'erreur dans le JSON
                throw new Error(data.error || `Erreur HTTP: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel à ${functionName}:`, error);
            alert(`Impossible de charger les données : ${error.message}`);
            return null;
        }
    }

    /**
     * Effectue une requête POST vers le Cloudflare Worker.
     * @param {string} functionName Le nom de la fonction Apps Script à appeler.
     * @param {Object} payload Les données à envoyer dans le corps de la requête.
     * @returns {Promise<Object>} Les données JSON de la réponse.
     */
    async function postData(functionName, payload) {
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
                throw new Error(data.error || `Erreur HTTP: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel POST à ${functionName}:`, error);
            alert(`Erreur lors de l'opération : ${error.message}`);
            return null;
        }
    }

    // --- Fonctions de chargement et d'affichage des données ---

    async function loadTasks() {
        completedTaskListDiv.innerHTML = '<p class="task-meta">Chargement des tâches terminées...</p>';
        pendingTaskListDiv.innerHTML = '<p>Chargement des tâches à faire...</p>';
        
        const tasks = await fetchData('getTasks');
        
        if (tasks) {
            completedTaskListDiv.innerHTML = '';
            pendingTaskListDiv.innerHTML = ''; 
            
            const completedTasks = tasks.filter(task => task.Statut === 'Terminé');
            const pendingTasks = tasks.filter(task => task.Statut !== 'Terminé');

            // Afficher les tâches terminées en premier (plus petites)
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

                        // Créer et afficher le champ de saisie du nom
                        const nameInputWrapper = document.createElement('div');
                        nameInputWrapper.className = 'name-input-wrapper';
                        nameInputWrapper.innerHTML = `
                            <input type="text" placeholder="Entrez votre nom" class="assignee-name-input">
                            <button class="submit-assignee-name">Valider</button>
                        `;
                        
                        // Insérer le wrapper après le bouton "Prendre cette tâche"
                        buttonElement.parentNode.insertBefore(nameInputWrapper, buttonElement.nextSibling);
                        buttonElement.style.display = 'none'; // Cacher le bouton "Prendre cette tâche"

                        const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                        const submitButton = nameInputWrapper.querySelector('.submit-assignee-name');

                        // Focus sur le champ de saisie
                        nameInput.focus();

                        submitButton.addEventListener('click', async () => {
                            const assigneeName = nameInput.value.trim();
                            if (assigneeName) {
                                const result = await postData('assignTask', { taskId, assigneeName });
                                if (result && result.success) {
                                    alert(result.message);
                                    loadTasks(); // Recharger les tâches pour mettre à jour l'affichage
                                    loadCurrentWeeklyScores(); // Mettre à jour les scores également
                                }
                            } else {
                                alert('Veuillez entrer votre nom.');
                            }
                            // Réactiver le bouton et supprimer le wrapper si l'opération est terminée
                            buttonElement.style.display = 'block';
                            nameInputWrapper.remove();
                            delete buttonElement.dataset.promptOpen;
                        });

                        // Annuler la saisie si l'utilisateur clique ailleurs ou appuie sur Échap
                        const cancelInput = (event) => {
                            if (!nameInputWrapper.contains(event.target) && event.target !== buttonElement) {
                                buttonElement.style.display = 'block';
                                nameInputWrapper.remove();
                                delete buttonElement.dataset.promptOpen;
                                document.removeEventListener('click', cancelInput);
                            }
                        };
                        // Ajouter un délai pour éviter de déclencher l'événement immédiatement après le clic sur le bouton
                        setTimeout(() => {
                            document.addEventListener('click', cancelInput);
                        }, 100);

                        nameInput.addEventListener('keydown', (event) => {
                            if (event.key === 'Enter') {
                                submitButton.click();
                            } else if (event.key === 'Escape') {
                                buttonElement.style.display = 'block';
                                nameInputWrapper.remove();
                                delete buttonElement.dataset.promptOpen;
                            }
                        });
                    });
                });
            } else {
                pendingTaskListDiv.innerHTML = '<p>Bravo ! Toutes les tâches sont faites pour le moment.</p>';
            }
        }
    }

    async function loadCurrentWeeklyScores() {
        scoresListDiv.innerHTML = '<p>Chargement des scores...</p>';
        currentPodiumDiv.innerHTML = '<p>Calcul du podium...</p>';

        const scores = await fetchData('getCurrentWeeklyScores');
        if (scores) {
            scoresListDiv.innerHTML = '';
            
            if (scores.length === 0) {
                scoresListDiv.innerHTML = '<p>Aucun score enregistré pour cette semaine.</p>';
                currentPodiumDiv.innerHTML = '<p>Le podium sera affiché après la première tâche !</p>';
                return;
            }
            
            const ul = document.createElement('ul');
            // Trier les scores par ordre décroissant
            scores.sort((a, b) => b.score - a.score);

            // Afficher tous les scores
            scores.forEach(score => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${score.name}</strong> <span>${score.score} points</span>`;
                ul.appendChild(li);
            });
            scoresListDiv.appendChild(ul);

            // Afficher le podium actuel
            displayCurrentPodium(scores);
        }
    }

    function displayCurrentPodium(scores) {
        currentPodiumDiv.innerHTML = '';
        if (scores.length === 0) {
            currentPodiumDiv.innerHTML = '<p>Le podium sera affiché après la première tâche !</p>';
            return;
        }

        const ol = document.createElement('ol');
        const podiumClasses = ['gold', 'silver', 'bronze'];

        scores.slice(0, 3).forEach((player, index) => { // Prend seulement les 3 premiers
            const li = document.createElement('li');
            li.className = podiumClasses[index] || ''; // Applique les classes CSS (gold, silver, bronze)
            li.innerHTML = `
                <span>${index + 1}. <strong>${player.name}</strong></span>
                <span>${player.score} points</span>
            `;
            ol.appendChild(li);
        });
        currentPodiumDiv.appendChild(ol);
    }


    async function loadWeeklyPodiums() {
        historyListDiv.innerHTML = '<p>Chargement de l\'historique...</p>';
        const podiums = await fetchData('getWeeklyPodiums');
        if (podiums) {
            historyListDiv.innerHTML = '';
            if (podiums.length === 0) {
                historyListDiv.innerHTML = '<p>Aucun podium enregistré pour le moment.</p>';
                return;
            }
            // Trier les podiums par semaine la plus récente en premier
            podiums.sort((a, b) => b.week.localeCompare(a.week)); 
            podiums.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                let podiumHtml = '';
                if (item.podium && item.podium.length > 0) {
                    podiumHtml = '<ol>';
                    item.podium.forEach((p, index) => {
                         // Ajoute les classes de couleur au podium historique aussi
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
    }

    // --- Gestion du bouton de réinitialisation des scores ---
    resetScoresButton.addEventListener('click', async () => {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser les scores hebdomadaires et enregistrer le podium ? Cela réinitialisera également toutes les tâches à "À faire".')) {
            const result = await postData('resetAndSaveScores', {});
            if (result && result.success) {
                alert(result.message);
                // Recharger toutes les données après la réinitialisation
                loadTasks();
                loadCurrentWeeklyScores();
                loadWeeklyPodiums();
            }
        }
    });

    // Charger les tâches par défaut au démarrage
    loadTasks();
    // Charger les scores et le podium au démarrage si l'onglet scores est actif par défaut ou pour pré-charger
    // Ou mieux: charger UNIQUEMENT la page des tâches, et laisser les autres onglets se charger à la demande
    // La logique ci-dessus avec les tabButtons s'en charge.
});