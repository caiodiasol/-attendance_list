let firebaseReady = false;

// ---------------------- Funções de validação ---------------------- //

function validateName(name) {
    const nameRegex = /^[A-Za-zÀ-ÿ\u00f1\u00d1\s'.-]+$/; // Aceita letras, acentos, espaços, apóstrofes, pontos e hífens
    return name.trim().length >= 2 && name.trim().length <= 100 && nameRegex.test(name.trim());
}

function validateWhatsapp(whatsapp) {
    const cleanNumber = whatsapp.replace(/\D/g, '');
    
    // Deve ter exatamente 11 dígitos (DDD + 9 + 8 dígitos)
    if (cleanNumber.length !== 11) {
        return false;
    }
    
    // Verificar se começa com DDD válido (11-99)
    const ddd = cleanNumber.substring(0, 2);
    if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
        return false;
    }
    
    // Verificar se o terceiro dígito é 9 (celular)
    if (cleanNumber.charAt(2) !== '9') {
        return false;
    }
    
    return true;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim()) && email.trim().length <= 254;
}

// ---------------------- showMessage corrigido ---------------------- //

function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;

    const messageContainer = document.getElementById('message-container') || document.body;
    messageContainer.appendChild(message);

    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (message.parentNode) {
                messageContainer.removeChild(message);
            }
        }, 300);
    }, 4000);
}

// ---------------------- Inicialização do Sistema de Banco ---------------------- //

async function initializeDatabase() {
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos
    
    while (attempts < maxAttempts) {
        if (typeof window.FirebaseDB !== 'undefined') {
            try {
                // Aguardar sistema estar pronto
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Verificar se está disponível
                if (typeof window.FirebaseDB.isAvailable === 'function') {
                    firebaseReady = true;
                    console.log("✅ Sistema de banco de dados inicializado");
                    
                    // Atualizar status na interface
                    const statusElement = document.getElementById('firebaseStatus');
                    if (statusElement) {
                        if (window.databaseService && window.databaseService.isAvailable()) {
                            statusElement.innerHTML = '<i class="fas fa-database"></i> Banco de dados conectado';
                            statusElement.className = 'firebase-status connected';
                        } else {
                            statusElement.innerHTML = '<i class="fas fa-archive"></i> Modo localStorage';
                            statusElement.className = 'firebase-status';
                        }
                    }
                    
                    return true;
                } else {
                    throw new Error('Função isAvailable não encontrada');
                }
            } catch (error) {
                console.warn('Erro ao inicializar:', error);
            }
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    firebaseReady = false;
    console.error("❌ Falha ao inicializar sistema de banco de dados");
    showMessage('Sistema em modo fallback. Dados serão salvos localmente.', 'warning');
    return false;
}

// ---------------------- Máscara de WhatsApp ---------------------- //

function applyWhatsAppMask(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    
    // Limitar a 11 dígitos
    if (value.length > 11) {
        value = value.substring(0, 11);
    }
    
    // Aplicar máscara conforme o número de dígitos
    if (value.length >= 11) {
        // Formato completo: (11) 99999-9999
        value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (value.length >= 7) {
        // Formato parcial: (11) 99999-9
        value = value.replace(/^(\d{2})(\d{5})(\d+)$/, '($1) $2-$3');
    } else if (value.length >= 3) {
        // Formato parcial: (11) 999
        value = value.replace(/^(\d{2})(\d+)$/, '($1) $2');
    } else if (value.length >= 1) {
        // Formato inicial: (1
        value = value.replace(/^(\d+)$/, '($1');
    }
    
    input.value = value;
}

function setupWhatsAppMask() {
    const whatsappInput = document.getElementById('clientWhatsapp');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', function(e) {
            applyWhatsAppMask(e.target);
        });
        
        // Aplicar máscara também quando colar texto
        whatsappInput.addEventListener('paste', function(e) {
            setTimeout(() => applyWhatsAppMask(e.target), 0);
        });
        
        console.log('✅ Máscara de WhatsApp configurada');
    }
}

// ---------------------- Validação em tempo real ---------------------- //

function setupRealTimeValidation() {
    const nameInput = document.getElementById('clientName');
    const whatsappInput = document.getElementById('clientWhatsapp');
    const emailInput = document.getElementById('clientEmail');
    
    // Validação do nome
    if (nameInput) {
        nameInput.addEventListener('blur', function() {
            const name = this.value.trim();
            const errorElement = document.getElementById('nameError');
            
            if (!validateName(name)) {
                this.classList.add('error');
                if (errorElement) {
                    errorElement.textContent = name.length < 2 ? 'Nome deve ter pelo menos 2 caracteres' : 'Nome deve conter apenas letras e espaços';
                }
            } else {
                this.classList.remove('error');
                if (errorElement) errorElement.textContent = '';
            }
        });
        
        nameInput.addEventListener('input', function() {
            this.classList.remove('error');
            const errorElement = document.getElementById('nameError');
            if (errorElement) errorElement.textContent = '';
        });
    }
    
    // Validação do WhatsApp
    if (whatsappInput) {
        whatsappInput.addEventListener('blur', function() {
            const whatsapp = this.value.trim();
            const errorElement = document.getElementById('whatsappError');
            
            if (whatsapp && !validateWhatsapp(whatsapp)) {
                this.classList.add('error');
                if (errorElement) {
                    errorElement.textContent = 'WhatsApp deve ter formato (11) 99999-9999';
                }
            } else {
                this.classList.remove('error');
                if (errorElement) errorElement.textContent = '';
            }
        });
        
        whatsappInput.addEventListener('input', function() {
            this.classList.remove('error');
            const errorElement = document.getElementById('whatsappError');
            if (errorElement) errorElement.textContent = '';
        });
    }
    
    // Validação do email
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            const errorElement = document.getElementById('emailError');
            
            if (!validateEmail(email)) {
                this.classList.add('error');
                if (errorElement) {
                    errorElement.textContent = 'Digite um email válido (ex: nome@email.com)';
                }
            } else {
                this.classList.remove('error');
                if (errorElement) errorElement.textContent = '';
            }
        });
        
        emailInput.addEventListener('input', function() {
            this.classList.remove('error');
            const errorElement = document.getElementById('emailError');
            if (errorElement) errorElement.textContent = '';
        });
    }
}

// ---------------------- Inicialização e Manipulação de formulário ---------------------- //

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Inicializando sistema...');
    
    // Inicializar sistema de banco
    await initializeDatabase();
    
    // Configurar máscara de WhatsApp
    setupWhatsAppMask();
    
    // Configurar validação em tempo real
    setupRealTimeValidation();
    
    // Configurar formulário
    const form = document.getElementById('clientForm');
    if (form) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            await addClient();
        });
        console.log('✅ Event listener adicionado ao formulário');
    } else {
        console.error('❌ Formulário clientForm não encontrado');
    }
});

// ---------------------- Função de adicionar cliente ---------------------- //

async function addClient() {
    if (!firebaseReady) {
        showMessage('⏳ Aguarde o carregamento do sistema antes de cadastrar.', 'warning');
        return;
    }

    const submitButton = document.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    
    try {
        // Mostrar loading no botão
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';

        const name = document.getElementById('clientName').value.trim();
        const whatsapp = document.getElementById('clientWhatsapp').value.trim();
        const email = document.getElementById('clientEmail').value.trim();

        // Validações com mensagens mais específicas
        if (!validateName(name)) {
            throw new Error('❌ Nome deve ter pelo menos 2 caracteres e conter apenas letras e espaços.');
        }

        if (whatsapp && !validateWhatsapp(whatsapp)) {
            throw new Error('❌ WhatsApp deve ter formato válido: (11) 99999-9999');
        }

        if (!validateEmail(email)) {
            throw new Error('❌ Digite um email válido (ex: nome@email.com)');
        }

        const newClientData = {
            name,
            whatsapp,
            email,
            status: 'active'
        };

        console.log('📝 Cadastrando cliente:', newClientData);
        const newClient = await window.FirebaseDB.addClient(newClientData);
        
        if (newClient && newClient.id) {
            // Mensagem de sucesso mais detalhada
            showSuccessMessage(name, email);
            
            // Limpar formulário após sucesso
            const form = document.getElementById('clientForm');
            if (form) {
                form.reset();
            }
            
            console.log('✅ Cliente cadastrado com sucesso:', newClient);
            
            // Redirecionar automaticamente para página de participar após 2 segundos
            setTimeout(() => {
                window.location.href = 'participar.html';
            }, 2000);
        } else {
            throw new Error('Erro interno: dados do cliente não foram salvos corretamente.');
        }
        
    } catch (error) {
        console.error('❌ Erro ao cadastrar cliente:', error);
        showMessage(error.message || 'Erro ao cadastrar cliente. Tente novamente.', 'error');
    } finally {
        // Restaurar botão
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

// Função para mostrar mensagem de sucesso personalizada
function showSuccessMessage(name, email) {
    const message = document.createElement('div');
    message.className = 'message success success-detailed';
    
    message.innerHTML = `
        <div class="success-icon">
            <i class="fas fa-check-circle"></i>
        </div>
        <div class="success-content">
            <h3>🎉 Cadastro Realizado com Sucesso!</h3>
            <p><strong>${name}</strong> foi cadastrado no sistema.</p>
            <p><small>📧 Email: ${email}</small></p>
            <p><small>✅ Você já pode participar da live e concorrer aos prêmios!</small></p>
            <p><small>🔄 Redirecionando para página de participação...</small></p>
        </div>
    `;

    const messageContainer = document.getElementById('messageContainer') || document.body;
    messageContainer.appendChild(message);

    // Remover após 6 segundos (mais tempo para ler)
    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.5s ease forwards';
        setTimeout(() => {
            if (message.parentNode) {
                messageContainer.removeChild(message);
            }
        }, 500);
    }, 6000);
}

// Função para limpar formulário
function clearForm() {
    const form = document.getElementById('clientForm');
    if (form) {
        form.reset();
    }
}
