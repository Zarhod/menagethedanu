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
    const resetScoresButton = document.getElementById('resetScoresButton'); 

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const loadingOverlay = document.getElementById('loadingOverlay');
    const scoresTabButton = document.querySelector('.tab-button[data-tab="scores"]');

    const customAlertOverlay = document.getElementById('customAlertOverlay');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const closeAlertButton = customAlertOverlay.querySelector('.close-alert');
    const confirmAlertButton = customAlertOverlay.querySelector('.alert-button');

    resetScoresButton.classList.add('hidden');

    function showAlert(title, message, icon = '🎉') {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        customAlertOverlay.querySelector('.alert-icon').textContent = icon;
        customAlertOverlay.classList.add('visible');
    }

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

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

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
        fullScoresButton.className = 'full-scores-button flat-button';
        fullScoresButton.addEventListener('click', () => {
            scoresTabButton.click();
        });
        currentPodiumDiv.appendChild(fullScoresButton);
    }

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
                showAlert('Erreur de chargement', data.error || `Erreur HTTP: ${response.status} pour ${functionName}`, '❌');
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel à ${functionName}:`, error);
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
                showAlert('Erreur lors de l\'opération', data.error || `Erreur HTTP: ${response.status} pour ${functionName}`, '❌');
                throw new Error(data.error || `Erreur HTTP: ${response.status} pour ${functionName}`);
            }
            return data;
        } catch (error) {
            console.error(`Erreur lors de l'appel POST à ${functionName}:`, error);
            return null;
        } finally {
            showLoading(false);
        }
    }

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

        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item`; // Garde la classe de base
                taskItem.setAttribute('data-task-id', task.ID_Tache); // Stocke l'ID sur la carte
                taskItem.innerHTML = `
                    <h3>${task.Description_Tache}</h3>
                    <p><span class="task-meta">Catégorie:</span> ${task.Libelle}</p>
                    <p><span class="task-score">Score:</span> ${task.Score}</p>
                    `;
                pendingTaskListDiv.appendChild(taskItem);
            });

            document.querySelectorAll('.task-item:not(.completed)').forEach(taskCard => {
                taskCard.addEventListener('click', async (e) => {
                    // Si la cible est un élément à l'intérieur de name-input-wrapper, ne rien faire
                    if (e.target.closest('.name-input-wrapper')) {
                        return;
                    }

                    const taskId = taskCard.dataset.taskId;

                    // Masquer le contenu actuel de la carte
                    taskCard.style.visibility = 'hidden';
                    taskCard.style.height = taskCard.offsetHeight + 'px'; // Fixer la hauteur pour éviter le saut
                    taskCard.style.overflow = 'hidden'; // Cacher le contenu qui pourrait déborder

                    // Créer la boîte de dialogue de saisie du nom
                    const nameInputWrapper = document.createElement('div');
                    nameInputWrapper.className = 'name-input-wrapper entering'; // Ajout de la classe entering pour l'animation
                    nameInputWrapper.innerHTML = `
                        <h3>Prendre la tâche</h3>
                        <input type="text" placeholder="Entrez votre nom" class="assignee-name-input">
                        <div class="input-buttons">
                            <button class="submit-assignee-name flat-button">Valider</button>
                            <button class="cancel-button flat-button">Annuler</button>
                        </div>
                    `;
                    
                    // Insérer la boîte de dialogue directement à la place de la carte
                    taskCard.parentNode.insertBefore(nameInputWrapper, taskCard);
                    
                    const nameInput = nameInputWrapper.querySelector('.assignee-name-input');
                    const submitButton = nameInputWrapper.querySelector('.submit-assignee-name');
                    const cancelButton = nameInputWrapper.querySelector('.cancel-button');

                    nameInput.focus();

                    // Fonction pour masquer la boîte de dialogue et réactiver la carte
                    const hideInputWrapper = () => {
                        nameInputWrapper.classList.remove('entering'); // Supprimer la classe d'animation d'entrée
                        nameInputWrapper.classList.add('hidden'); // Masquer la boîte de dialogue
                        nameInputWrapper.addEventListener('transitionend', () => {
                            nameInputWrapper.remove(); // Supprimer de l'arbre DOM après transition
                            taskCard.style.visibility = 'visible'; // Rendre la carte visible à nouveau
                            taskCard.style.height = ''; // Réinitialiser la hauteur
                            taskCard.style.overflow = ''; // Réinitialiser l'overflow
                        }, { once: true });
                    };

                    // Événement de validation
                    submitButton.addEventListener('click', async () => {
                        const assigneeName = nameInput.value.trim();
                        if (assigneeName) {
                            const result = await postData('assignTask', { taskId, assigneeName });
                            if (result && result.success) {
                                showAlert('Merci pour votre implication !', result.message, '🎉');
                                hideInputWrapper(); // Masquer la boîte de dialogue
                                loadTasks(); // Recharger les tâches
                                loadCurrentPodiumForTasksPage(); 
                                loadCurrentWeeklyScores();
                            } else if (result && result.message) {
                                // Erreur déjà gérée par postData avec showAlert
                                hideInputWrapper(); // Masquer la boîte de dialogue même en cas d'erreur
                            }
                        } else {
                            showAlert('Champ vide', 'Veuillez entrer votre nom pour prendre la tâche.', '⚠️');
                            // Ne pas masquer la boîte de dialogue pour laisser l'utilisateur réessayer
                            nameInput.focus(); // Remettre le focus sur l'input
                        }
                    });

                    // Événement d'annulation
                    cancelButton.addEventListener('click', hideInputWrapper);

                    // Gérer le clic en dehors pour annuler
                    const handleClickOutside = (event) => {
                        if (!nameInputWrapper.contains(event.target) && !taskCard.contains(event.target)) {
                            hideInputWrapper();
                            document.removeEventListener('click', handleClickOutside); // Supprimer l'écouteur
                        }
                    };
                    // Ajouter l'écouteur après un petit délai pour éviter qu'il ne se déclenche sur le clic initial
                    setTimeout(() => {
                        document.addEventListener('click', handleClickOutside);
                    }, 100);

                    // Gérer la touche "Entrée" et "Échap"
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

    document.querySelector('.tab-button[data-tab="tasks"]').click();
});
