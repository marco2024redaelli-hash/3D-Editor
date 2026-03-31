/**
 * DecAI Chat Widget - Floating chat per il 3D Editor
 * Stile coerente con il tema DECA (scuro + accent #4ecca3)
 */

(function() {

    // ── Inietta CSS ──
    const style = document.createElement('style');
    style.textContent = `
        #decai-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #4ecca3;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(78,204,163,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        #decai-fab:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 28px rgba(78,204,163,0.55);
        }
        #decai-fab svg { width: 28px; height: 28px; fill: #0c0e14; }

        #decai-panel {
            position: fixed;
            bottom: 92px;
            right: 24px;
            width: 400px;
            height: 520px;
            background: #141620;
            border: 1px solid #2a2e42;
            border-radius: 12px;
            box-shadow: 0 12px 48px rgba(0,0,0,0.7);
            display: none;
            flex-direction: column;
            z-index: 10001;
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            overflow: hidden;
        }
        #decai-panel.open { display: flex; }

        #decai-header {
            display: flex;
            align-items: center;
            padding: 14px 16px;
            background: #1c1f2e;
            border-bottom: 1px solid #2a2e42;
            gap: 10px;
        }
        #decai-header-icon {
            width: 32px; height: 32px; border-radius: 50%;
            background: linear-gradient(135deg, #4ecca3, #3ba88c);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        #decai-header-icon svg { width: 18px; height: 18px; fill: #0c0e14; }
        #decai-header-title {
            flex: 1;
        }
        #decai-header-title h3 {
            font-size: 14px; font-weight: 600; color: #eaedf3; margin: 0;
        }
        #decai-header-title span {
            font-size: 11px; color: #8b90a0;
        }
        #decai-close-btn, #decai-reset-btn {
            background: none; border: none; cursor: pointer;
            color: #8b90a0; padding: 4px; border-radius: 4px;
            transition: color 0.15s, background 0.15s;
        }
        #decai-close-btn:hover, #decai-reset-btn:hover {
            color: #eaedf3; background: rgba(255,255,255,0.06);
        }

        #decai-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        #decai-messages::-webkit-scrollbar { width: 5px; }
        #decai-messages::-webkit-scrollbar-track { background: transparent; }
        #decai-messages::-webkit-scrollbar-thumb { background: #2a2e42; border-radius: 3px; }

        .decai-msg {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.5;
            color: #eaedf3;
            word-wrap: break-word;
            white-space: pre-wrap;
        }
        .decai-msg.user {
            align-self: flex-end;
            background: #4ecca3;
            color: #0c0e14;
            border-bottom-right-radius: 3px;
        }
        .decai-msg.assistant {
            align-self: flex-start;
            background: #232738;
            border-bottom-left-radius: 3px;
        }
        .decai-msg.assistant .decai-3d-btn {
            display: inline-block;
            margin-top: 8px;
            padding: 5px 12px;
            background: rgba(78,204,163,0.15);
            border: 1px solid #4ecca3;
            color: #4ecca3;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.15s;
        }
        .decai-msg.assistant .decai-3d-btn:hover {
            background: rgba(78,204,163,0.3);
        }
        .decai-typing {
            align-self: flex-start;
            padding: 10px 14px;
            background: #232738;
            border-radius: 10px;
            border-bottom-left-radius: 3px;
            font-size: 13px;
            color: #8b90a0;
        }
        .decai-typing .dot {
            display: inline-block;
            width: 6px; height: 6px;
            background: #4ecca3;
            border-radius: 50%;
            margin: 0 2px;
            animation: decai-blink 1.2s infinite;
        }
        .decai-typing .dot:nth-child(2) { animation-delay: 0.2s; }
        .decai-typing .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes decai-blink {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
        }

        .decai-welcome {
            text-align: center;
            padding: 20px 16px;
            color: #8b90a0;
            font-size: 13px;
            line-height: 1.6;
        }
        .decai-welcome strong { color: #4ecca3; }
        .decai-welcome-chips {
            display: flex; flex-wrap: wrap; gap: 6px;
            justify-content: center; margin-top: 12px;
        }
        .decai-chip {
            padding: 6px 12px;
            background: #1c1f2e;
            border: 1px solid #2a2e42;
            border-radius: 16px;
            font-size: 11px;
            color: #eaedf3;
            cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
        }
        .decai-chip:hover {
            border-color: #4ecca3;
            background: rgba(78,204,163,0.08);
        }

        #decai-input-area {
            display: flex;
            padding: 12px;
            gap: 8px;
            border-top: 1px solid #2a2e42;
            background: #1c1f2e;
        }
        #decai-input {
            flex: 1;
            background: #141620;
            border: 1px solid #2a2e42;
            border-radius: 8px;
            padding: 10px 14px;
            color: #eaedf3;
            font-size: 13px;
            font-family: inherit;
            outline: none;
            resize: none;
            min-height: 40px;
            max-height: 100px;
        }
        #decai-input:focus { border-color: #4ecca3; }
        #decai-input::placeholder { color: #555a6e; }
        #decai-send-btn {
            width: 40px; height: 40px;
            background: #4ecca3;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s;
            flex-shrink: 0;
            align-self: flex-end;
        }
        #decai-send-btn:hover { background: #3ba88c; }
        #decai-send-btn:disabled { background: #2a2e42; cursor: not-allowed; }
        #decai-send-btn svg { width: 18px; height: 18px; fill: #0c0e14; }

        .decai-error {
            padding: 8px 12px;
            background: rgba(233,69,96,0.12);
            border: 1px solid rgba(233,69,96,0.3);
            border-radius: 8px;
            color: #e94560;
            font-size: 12px;
            text-align: center;
        }

        @media (max-width: 480px) {
            #decai-panel {
                width: calc(100vw - 16px);
                height: calc(100vh - 120px);
                right: 8px;
                bottom: 80px;
            }
        }
    `;
    document.head.appendChild(style);

    // ── HTML del widget ──
    const fabHTML = `
        <button id="decai-fab" title="DecAI Assistente">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
        </button>
    `;

    const panelHTML = `
        <div id="decai-panel">
            <div id="decai-header">
                <div id="decai-header-icon">
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                </div>
                <div id="decai-header-title">
                    <h3>DecAI</h3>
                    <span>Assistente Catalogo DECA</span>
                </div>
                <button id="decai-reset-btn" title="Nuova conversazione">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </button>
                <button id="decai-close-btn" title="Chiudi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div id="decai-messages">
                <div class="decai-welcome">
                    Ciao! Sono <strong>DecAI</strong>, l'assistente del catalogo DECA Srl.<br>
                    Chiedimi informazioni su prodotti, configurazioni e soluzioni.
                    <div class="decai-welcome-chips">
                        <span class="decai-chip" data-q="Cos'è la IAS03?">Cos'è la IAS03?</span>
                        <span class="decai-chip" data-q="Ho bisogno di orientare pezzi leggeri in plastica, cosa mi consigli?">Orientare pezzi leggeri</span>
                        <span class="decai-chip" data-q="Mostrami la base vibrante circolare più grande">Base vibrante più grande</span>
                    </div>
                </div>
            </div>
            <div id="decai-input-area">
                <textarea id="decai-input" placeholder="Scrivi una domanda..." rows="1"></textarea>
                <button id="decai-send-btn" title="Invia">
                    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
            </div>
        </div>
    `;

    // ── Inserisci nel DOM ──
    const container = document.createElement('div');
    container.innerHTML = fabHTML + panelHTML;
    document.body.appendChild(container);

    // ── Elementi ──
    const fab = document.getElementById('decai-fab');
    const panel = document.getElementById('decai-panel');
    const closeBtn = document.getElementById('decai-close-btn');
    const resetBtn = document.getElementById('decai-reset-btn');
    const messagesEl = document.getElementById('decai-messages');
    const inputEl = document.getElementById('decai-input');
    const sendBtn = document.getElementById('decai-send-btn');

    let isOpen = false;
    let isSending = false;

    // ── Toggle panel ──
    fab.addEventListener('click', () => {
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        if (isOpen) {
            DecAIChat.loadCatalogo();
            inputEl.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        isOpen = false;
        panel.classList.remove('open');
    });

    // ── Reset ──
    resetBtn.addEventListener('click', () => {
        DecAIChat.resetConversation();
        messagesEl.innerHTML = `
            <div class="decai-welcome">
                Ciao! Sono <strong>DecAI</strong>, l'assistente del catalogo DECA Srl.<br>
                Chiedimi informazioni su prodotti, configurazioni e soluzioni.
                <div class="decai-welcome-chips">
                    <span class="decai-chip" data-q="Cos'è la IAS03?">Cos'è la IAS03?</span>
                    <span class="decai-chip" data-q="Ho bisogno di orientare pezzi leggeri in plastica, cosa mi consigli?">Orientare pezzi leggeri</span>
                    <span class="decai-chip" data-q="Mostrami la base vibrante circolare più grande">Base vibrante più grande</span>
                </div>
            </div>`;
        bindChips();
    });

    // ── Chips di suggerimento ──
    function bindChips() {
        document.querySelectorAll('.decai-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const q = chip.getAttribute('data-q');
                if (q) sendMessage(q);
            });
        });
    }
    bindChips();

    // ── Aggiunge messaggio alla UI ──
    function addMessage(role, content) {
        // Rimuovi welcome se presente
        const welcome = messagesEl.querySelector('.decai-welcome');
        if (welcome) welcome.remove();

        const div = document.createElement('div');
        div.className = `decai-msg ${role}`;
        div.textContent = content;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    // ── Processa la risposta (converte tag 3D in bottoni cliccabili) ──
    function processResponse(text) {
        // Cerca [AZIONE: APRI_VIEWER_3D codice]
        return text.replace(/\[AZIONE:\s*APRI_VIEWER_3D\s*(\w*)\]/g, (match, codice) => {
            if (codice) {
                return `<span class="decai-3d-btn" onclick="DecAIWidget.open3D('${codice}')">🔲 Visualizza 3D: ${codice}</span>`;
            }
            return '';
        });
    }

    // ── Invio messaggio ──
    async function sendMessage(text) {
        if (isSending || !text.trim()) return;
        isSending = true;
        sendBtn.disabled = true;

        addMessage('user', text.trim());
        inputEl.value = '';
        inputEl.style.height = 'auto';

        // Typing indicator
        const typing = document.createElement('div');
        typing.className = 'decai-typing';
        typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        messagesEl.appendChild(typing);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // Placeholder per la risposta streaming
        let responseDiv = null;
        let fullText = '';

        await DecAIChat.chat(
            text.trim(),
            // onToken
            (token) => {
                if (!responseDiv) {
                    typing.remove();
                    responseDiv = addMessage('assistant', '');
                }
                fullText += token;
                responseDiv.textContent = fullText;
                messagesEl.scrollTop = messagesEl.scrollHeight;
            },
            // onDone
            (finalText) => {
                if (responseDiv) {
                    responseDiv.innerHTML = processResponse(finalText);
                }
                isSending = false;
                sendBtn.disabled = false;
            },
            // onError
            (err) => {
                typing.remove();
                const errDiv = document.createElement('div');
                errDiv.className = 'decai-error';
                errDiv.textContent = `Errore di connessione a Ollama. Assicurati che sia in esecuzione su localhost:11434.\n${err}`;
                messagesEl.appendChild(errDiv);
                messagesEl.scrollTop = messagesEl.scrollHeight;
                isSending = false;
                sendBtn.disabled = false;
            }
        );
    }

    // ── Event listeners ──
    sendBtn.addEventListener('click', () => sendMessage(inputEl.value));

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputEl.value);
        }
    });

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    });

    // ── API per apertura 3D ──
    window.DecAIWidget = {
        open3D: function(codice) {
            // Cerca nel catalogo del 3D editor se esiste la funzione
            if (typeof window.loadModelByCode === 'function') {
                window.loadModelByCode(codice);
            } else {
                console.log('[DecAI] Apertura 3D viewer per:', codice);
                // Fallback: cerca nella sidebar dell'editor
                const searchInput = document.querySelector('#search-input, [data-search]');
                if (searchInput) {
                    searchInput.value = codice;
                    searchInput.dispatchEvent(new Event('input'));
                }
            }
        }
    };

})();
