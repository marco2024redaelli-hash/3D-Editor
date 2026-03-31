/**
 * DecAI Chat - RAG Client-Side + Ollama Integration
 * Carica i JSON del catalogo, cerca per rilevanza e chiama Ollama.
 */

const DecAIChat = (() => {

    // ── Configurazione ──
    const CONFIG = {
        ollamaUrl: 'http://localhost:11434',
        model: 'decaiv2',
        catalogoPath: '/catalogo/',
        catalogoFiles: [
            'acc_accessori.json',
            'alm_alc_ald_alimentatori.json',
            'ape_crc_qel_apparecchiature.json',
            'blf_plf_supporto_presa_robot.json',
            'bvc_bvl_basi_vibranti.json',
            'cci_cco_cgr_contenitori.json',
            'cnl_cna_canali_lineari.json',
            'cpp_cappe_afoniche.json',
            'cso_riv_colonne_rivestimenti.json',
            'cve_trc_carico_dosaggio.json',
            'cvm_vibrovagli_masse_eccentriche.json',
            'elc_esi_ess_eds_elevatori.json',
            'ias_isole_asservimento.json',
            'ims_impianti_speciali.json',
            'isr_bpk_isole_robotizzate.json',
            'mtr_elp_mototramogge_piastre.json',
            'nra_nsi_nds_nastri_trasportatori.json',
            'rul_rulliere.json',
            'singolarizzazione_dispositivi.json',
            'str_pst_strutture_piastre.json'
        ],
        topK: 5,
        systemPrompt: `Sei l'assistente ufficiale di DECA srl (Monte Marenzo).
Usa esclusivamente i dati aziendali ufficiali per rispondere.

REGOLE:
1. Rispondi SOLO con informazioni presenti nel CONTESTO fornito o nel tuo training.
2. Includi sempre i dati tecnici specifici (codice prodotto, dimensioni, portata, materiali) quando disponibili.
3. SE LA DOMANDA RIGUARDA DETTAGLI TECNICI NON PRESENTI, non inventare. Spiega che DECA realizza soluzioni su misura e invita a contattare l'ufficio tecnico al +39 0341 63 20 80 o info@decasrl.biz.
4. Quando descrivi un prodotto con modello 3D disponibile, aggiungi il tag [AZIONE: APRI_VIEWER_3D codice_prodotto] alla fine.
5. Se l'utente chiede un consiglio, analizza le esigenze e suggerisci i prodotti DECA più adatti dal contesto.`
    };

    // ── Stato ──
    let catalogo = [];       // Array di chunks indicizzati
    let isLoaded = false;
    let isLoading = false;
    let conversationHistory = [];

    // ── Caricamento catalogo ──
    async function loadCatalogo() {
        if (isLoaded || isLoading) return;
        isLoading = true;

        try {
            const promises = CONFIG.catalogoFiles.map(f =>
                fetch(CONFIG.catalogoPath + f).then(r => r.json()).catch(() => null)
            );
            const results = await Promise.all(promises);

            results.forEach((data, idx) => {
                if (!data) return;
                const fileName = CONFIG.catalogoFiles[idx];

                // Indicizza la categoria
                catalogo.push({
                    type: 'categoria',
                    file: fileName,
                    categoria: data.categoria || '',
                    descrizione: data.descrizione_generale || '',
                    text: `${data.categoria || ''} ${data.descrizione_generale || ''}`.toLowerCase(),
                    data: data
                });

                // Indicizza ogni prodotto
                if (data.prodotti) {
                    data.prodotti.forEach(prod => {
                        const keywords = (prod.keywords || []).join(' ');
                        const composizione = (prod.composizione || []).join(' ');
                        const chars = prod.caratteristiche_chiave
                            ? Object.entries(prod.caratteristiche_chiave).map(([k,v]) => `${k}: ${v}`).join(' ')
                            : '';
                        const varianti = (prod.varianti || []).map(v =>
                            `${v.modello || ''} ${v.descrizione || ''} ${v.diametro || ''} ${v.portata || ''}`
                        ).join(' ');

                        catalogo.push({
                            type: 'prodotto',
                            file: fileName,
                            categoria: data.categoria || '',
                            codice: prod.codice || '',
                            nome: prod.nome || '',
                            text: `${prod.codice || ''} ${prod.nome || ''} ${prod.descrizione || ''} ${keywords} ${composizione} ${chars} ${varianti}`.toLowerCase(),
                            data: prod
                        });
                    });
                }
            });

            isLoaded = true;
            console.log(`[DecAI] Catalogo caricato: ${catalogo.length} chunks da ${results.filter(Boolean).length} file`);
        } catch (err) {
            console.error('[DecAI] Errore caricamento catalogo:', err);
        } finally {
            isLoading = false;
        }
    }

    // ── Ricerca per rilevanza (keyword matching con scoring) ──
    function search(query, topK = CONFIG.topK) {
        const queryLower = query.toLowerCase();
        const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);

        const scored = catalogo.map(chunk => {
            let score = 0;

            // Match esatto della query completa
            if (chunk.text.includes(queryLower)) score += 10;

            // Match per ogni token
            queryTokens.forEach(token => {
                if (chunk.text.includes(token)) score += 2;
                // Bonus per match nel codice prodotto
                if (chunk.codice && chunk.codice.toLowerCase().includes(token)) score += 5;
                // Bonus per match nel nome
                if (chunk.nome && chunk.nome.toLowerCase().includes(token)) score += 3;
            });

            return { chunk, score };
        });

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(s => s.chunk);
    }

    // ── Costruzione contesto RAG ──
    function buildContext(results) {
        if (results.length === 0) return '';

        let context = '=== CONTESTO DAL CATALOGO DECA ===\n\n';
        results.forEach((r, i) => {
            if (r.type === 'categoria') {
                context += `[${i+1}] CATEGORIA: ${r.categoria}\n`;
                context += `Descrizione: ${r.descrizione}\n\n`;
            } else {
                context += `[${i+1}] PRODOTTO: ${r.data.codice} - ${r.data.nome}\n`;
                context += JSON.stringify(r.data, null, 2) + '\n\n';
            }
        });
        context += '=== FINE CONTESTO ===\n';
        return context;
    }

    // ── Chiamata Ollama (streaming) ──
    async function chat(userMessage, onToken, onDone, onError) {
        if (!isLoaded) await loadCatalogo();

        // 1. Retrieval
        const results = search(userMessage);
        const context = buildContext(results);

        // 2. Costruisci messaggio con contesto
        const augmentedMessage = context
            ? `${context}\n\nDOMANDA UTENTE: ${userMessage}`
            : userMessage;

        // 3. Aggiungi alla cronologia
        conversationHistory.push({ role: 'user', content: augmentedMessage });

        // 4. Prepara i messaggi per Ollama
        const messages = [
            { role: 'system', content: CONFIG.systemPrompt },
            ...conversationHistory
        ];

        try {
            const response = await fetch(`${CONFIG.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: CONFIG.model,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n').filter(l => l.trim());

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.message && json.message.content) {
                            fullResponse += json.message.content;
                            if (onToken) onToken(json.message.content);
                        }
                        if (json.done) {
                            conversationHistory.push({ role: 'assistant', content: fullResponse });
                            if (onDone) onDone(fullResponse);
                        }
                    } catch (e) { /* skip malformed lines */ }
                }
            }
        } catch (err) {
            console.error('[DecAI] Errore chat:', err);
            if (onError) onError(err.message);
        }
    }

    // ── Reset conversazione ──
    function resetConversation() {
        conversationHistory = [];
    }

    // ── API pubblica ──
    return {
        loadCatalogo,
        search,
        chat,
        resetConversation,
        isReady: () => isLoaded,
        getConfig: () => ({ ...CONFIG })
    };

})();
