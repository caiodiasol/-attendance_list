// Sistema de ranking de ganhadores
let winnersHistory = [];

// Elementos do DOM
const winnersContainer = document.getElementById('winnersContainer');
const totalWinnersCountElement = document.getElementById('totalWinnersCount');
const lastWinnerDateElement = document.getElementById('lastWinnerDate');
const messageContainer = document.getElementById('messageContainer');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeWinnersPage();
});

// Função para inicializar a página de ganhadores
async function initializeWinnersPage() {
    try {
        await loadWinnersHistory();
        updateWinnersDisplay();
        updateStats();
        
        console.log('Página de ganhadores inicializada');
    } catch (error) {
        console.error('Erro ao inicializar página de ganhadores:', error);
        showMessage('Erro ao carregar histórico de ganhadores', 'error');
    }
}

// Função para carregar histórico de ganhadores
async function loadWinnersHistory() {
    try {
        // Carregar do localStorage
        const savedWinners = localStorage.getItem('winners_history');
        if (savedWinners) {
            winnersHistory = JSON.parse(savedWinners);
        }
        
        // Tentar carregar do Firebase se disponível
        if (window.FirebaseDB && typeof window.FirebaseDB.getWinners === 'function') {
            try {
                const firebaseWinners = await window.FirebaseDB.getWinners();
                if (firebaseWinners && firebaseWinners.length > 0) {
                    winnersHistory = firebaseWinners;
                }
            } catch (firebaseError) {
                console.log('Firebase não disponível, usando localStorage:', firebaseError);
            }
        }
        
        // Ordenar por timestamp (mais recente primeiro)
        winnersHistory.sort((a, b) => {
            const dateA = new Date(a.timestamp);
            const dateB = new Date(b.timestamp);
            return dateB - dateA;
        });
        
    } catch (error) {
        console.error('Erro ao carregar histórico de ganhadores:', error);
        winnersHistory = [];
    }
}

// Função para atualizar exibição dos ganhadores
function updateWinnersDisplay() {
    if (winnersHistory.length === 0) {
        winnersContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-crown"></i>
                <h3>Nenhuma premiação ainda</h3>
                <p>As premiações aparecerão aqui quando forem confirmadas no ranking principal.</p>
            </div>
        `;
        return;
    }
    
    winnersContainer.innerHTML = winnersHistory.map((winners, index) => {
        const winnerDate = new Date(winners.timestamp);
        const formatDate = winnerDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="winners-award">
                <div class="award-header">
                    <div class="award-info">
                        <h3><i class="fas fa-trophy"></i> Premiação #${winnersHistory.length - index}</h3>
                        <p class="award-date">${formatDate}</p>
                        <p class="award-participants">${winners.totalParticipants} participantes</p>
                    </div>
                    <div class="award-badge">
                        <i class="fas fa-crown"></i>
                    </div>
                </div>
                
                <div class="winners-podium">
                    ${generatePodiumHtml(winners.ranking.slice(0, 3))}
                </div>
                
                <div class="winners-list">
                    <h4><i class="fas fa-list"></i> Top 10 Completo</h4>
                    <div class="ranking-list">
                        ${winners.ranking.slice(0, 10).map((entry, pos) => `
                            <div class="ranking-item ${pos < 3 ? 'top-three' : ''}">
                                <div class="ranking-position">
                                    <div class="position-badge" style="color: ${getPositionColor(pos + 1)}">
                                        ${pos + 1}
                                    </div>
                                </div>
                                <div class="client-info">
                                    <div class="client-name">${escapeHtml(entry.client.name)}</div>
                                </div>
                                <div class="points-info">
                                    <div class="points-count">${entry.points}</div>
                                    <div class="points-label">pontos</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Função para gerar HTML do pódium
function generatePodiumHtml(topThree) {
    if (topThree.length < 3) {
        return '<p class="no-podium">Menos de 3 participantes nesta premiação</p>';
    }
    
    return `
        <div class="podium">
            <div class="podium-place second">
                <div class="podium-avatar">
                    <span class="position">2</span>
                </div>
                <div class="podium-info">
                    <div class="podium-name">${escapeHtml(topThree[1].client.name.split(' ')[0])}</div>
                    <div class="podium-points">${topThree[1].points} pts</div>
                </div>
                <div class="podium-bar second-bar"></div>
            </div>
            
            <div class="podium-place first">
                <div class="podium-crown">👑</div>
                <div class="podium-avatar winner">
                    <span class="position">1</span>
                </div>
                <div class="podium-info">
                    <div class="podium-name">${escapeHtml(topThree[0].client.name.split(' ')[0])}</div>
                    <div class="podium-points">${topThree[0].points} pts</div>
                </div>
                <div class="podium-bar first-bar"></div>
            </div>
            
            <div class="podium-place third">
                <div class="podium-avatar">
                    <span class="position">3</span>
                </div>
                <div class="podium-info">
                    <div class="podium-name">${escapeHtml(topThree[2].client.name.split(' ')[0])}</div>
                    <div class="podium-points">${topThree[2].points} pts</div>
                </div>
                <div class="podium-bar third-bar"></div>
            </div>
        </div>
    `;
}

// Função para obter cor da posição
function getPositionColor(position) {
    switch (position) {
        case 1: return '#ffd700'; // Ouro
        case 2: return '#c0c0c0'; // Prata  
        case 3: return '#cd7f32'; // Bronze
        default: return '#2563eb'; // Azul padrão
    }
}

// Função para atualizar estatísticas
function updateStats() {
    // Total de premiações
    totalWinnersCountElement.textContent = winnersHistory.length;
    
    // Data da última premiação
    if (winnersHistory.length > 0) {
        const lastWinner = winnersHistory[0];
        const lastDate = new Date(lastWinner.timestamp);
        lastWinnerDateElement.textContent = lastDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit'
        });
    } else {
        lastWinnerDateElement.textContent = '-';
    }
}

// Função para limpar histórico de ganhadores
async function clearWinnersHistory() {
    if (!confirm('Tem certeza que deseja limpar todo o histórico de ganhadores? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        // Limpar localStorage
        localStorage.removeItem('winners_history');
        
        // Limpar Firebase se disponível
        if (window.FirebaseDB && typeof window.FirebaseDB.clearWinners === 'function') {
            await window.FirebaseDB.clearWinners();
        }
        
        // Atualizar interface
        winnersHistory = [];
        updateWinnersDisplay();
        updateStats();
        
        showMessage('Histórico de ganhadores limpo com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao limpar histórico:', error);
        showMessage('Erro ao limpar histórico. Tente novamente.', 'error');
    }
}

// Função para escapar HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Função para mostrar mensagens
function showMessage(text, type = 'info') {
    if (typeof window.showMessage === 'function') {
        window.showMessage(text, type);
        return;
    }
    
    // Fallback local
    if (!messageContainer) return;
    
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    messageContainer.appendChild(message);
    
    setTimeout(() => {
        if (message.parentNode) {
            messageContainer.removeChild(message);
        }
    }, 4000);
}