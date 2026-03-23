const fs = require('fs');
const path = '//wsl$/Ubuntu/home/marco_redaelli/decai-finetune/';

const old = JSON.parse(fs.readFileSync(path + 'training6.json', 'utf8'));

const newExamples = [
  {
    instruction: "Sostituisci il vibratore circolare con un vibratore lineare nella scena 3D",
    input: "",
    output: '{"text":"Sostituisco il vibratore circolare con un vibratore lineare.","actions":[{"type":"replace","target":"vibratore circolare","search":"vibratore lineare"}]}'
  },
  {
    instruction: "Cambia l'elevatore con una mototramoggia",
    input: "",
    output: '{"text":"Sostituzione in corso: elevatore \u2192 mototramoggia.","actions":[{"type":"replace","target":"elevatore","search":"mototramoggia"}]}'
  },
  {
    instruction: "Rimpiazza il nastro trasportatore con un canale vibrante",
    input: "",
    output: '{"text":"Sostituisco il nastro trasportatore con un canale vibrante.","actions":[{"type":"replace","target":"nastro trasportatore","search":"canale vibrante"}]}'
  },
  {
    instruction: "Sostituisci la tramoggia di carico con un elevatore a nastro",
    input: "",
    output: '{"text":"Sostituzione: tramoggia di carico \u2192 elevatore a nastro.","actions":[{"type":"replace","target":"tramoggia","search":"elevatore a nastro"}]}'
  },
  {
    instruction: "Metti un alimentatore centrifugo al posto del vibratore",
    input: "",
    output: '{"text":"Sostituisco il vibratore con un alimentatore centrifugo.","actions":[{"type":"replace","target":"vibratore","search":"alimentatore centrifugo"}]}'
  },
  {
    instruction: "Scambia il vibrovaglio con un nastro trasportatore",
    input: "",
    output: '{"text":"Sostituisco il vibrovaglio con un nastro trasportatore.","actions":[{"type":"replace","target":"vibrovaglio","search":"nastro trasportatore"}]}'
  },
  {
    instruction: "Togli il vibratore lineare e metti un alimentatore meccanico",
    input: "",
    output: '{"text":"Rimuovo il vibratore lineare e inserisco un alimentatore meccanico nella stessa posizione.","actions":[{"type":"replace","target":"vibratore lineare","search":"alimentatore meccanico"}]}'
  },
  {
    instruction: "Carica un vibratore circolare nella scena",
    input: "",
    output: '{"text":"Carico un vibratore circolare nella scena 3D.","actions":[{"type":"load","search":"vibratore circolare"}]}'
  },
  {
    instruction: "Aggiungi un elevatore alla scena 3D",
    input: "",
    output: '{"text":"Aggiungo un elevatore alla scena.","actions":[{"type":"load","search":"elevatore"}]}'
  },
  {
    instruction: "Rimuovi il nastro dalla scena",
    input: "",
    output: '{"text":"Rimuovo il nastro dalla scena.","actions":[{"type":"remove","name":"nastro"}]}'
  },
  {
    instruction: "Seleziona il vibratore nella scena",
    input: "",
    output: '{"text":"Seleziono il vibratore.","actions":[{"type":"select","name":"vibratore"}]}'
  },
  {
    instruction: "Sposta il vibratore a destra di 2 metri",
    input: "",
    output: '{"text":"Sposto il vibratore di 2 unit\u00e0 sull\'asse X.","actions":[{"type":"select","name":"vibratore"},{"type":"move","x":2,"y":0,"z":0}]}'
  },
  {
    instruction: "Ruota l'elevatore di 90 gradi",
    input: "",
    output: '{"text":"Ruoto l\'elevatore di 90\u00b0 sull\'asse Y.","actions":[{"type":"select","name":"elevatore"},{"type":"rotate","x":0,"y":90,"z":0}]}'
  },
  {
    instruction: "Colora il nastro trasportatore di rosso",
    input: "",
    output: '{"text":"Cambio il colore del nastro trasportatore in rosso.","actions":[{"type":"select","name":"nastro"},{"type":"color","value":"#ff0000"}]}'
  },
  {
    instruction: "Disponi tutti gli oggetti in griglia",
    input: "",
    output: '{"text":"Dispongo tutti gli oggetti in griglia ordinata.","actions":[{"type":"arrange"}]}'
  },
  {
    instruction: "Cerca il codice 001234 nella distinta base",
    input: "",
    output: '{"text":"Cerco il codice 001234 nella distinta base.","actions":[{"type":"search_bom","code":"001234"}]}'
  },
  {
    instruction: "Mostrami il disegno del pezzo 56789",
    input: "",
    output: '{"text":"Cerco il disegno tecnico del pezzo 56789.","actions":[{"type":"search_drawing","code":"56789"}]}'
  },
  {
    instruction: "Vorrei sostituire il componente in alto a sinistra con un modello piu piccolo di nastro",
    input: "",
    output: '{"text":"Per sostituire un componente specifico, indicami il nome esatto dell\'oggetto nella scena e il modello con cui vuoi sostituirlo. Puoi vedere i nomi nel pannello Oggetti nella scena a destra.","actions":[]}'
  },
  {
    instruction: "Sostituisci tutto con versioni in acciaio inox",
    input: "",
    output: '{"text":"Non posso sostituire automaticamente tutti i componenti. Posso sostituirli uno alla volta: dimmi quale oggetto vuoi cambiare e con cosa.","actions":[]}'
  },
  {
    instruction: "Puoi cambiare il materiale del vibratore?",
    input: "",
    output: '{"text":"Posso cambiare il colore del vibratore nella scena 3D. Per cambiare il materiale reale (es. acciaio inox, PVC), contatta l\'ufficio tecnico DECA al 0341 63 20 80.","actions":[]}'
  },
  {
    instruction: "Sostituisci la base del vibratore circolare modello VC300 con il modello VC450",
    input: "",
    output: '{"text":"Sostituisco il VC300 con il VC450.","actions":[{"type":"replace","target":"VC300","search":"VC450"}]}'
  },
  {
    instruction: "Cambia l'alimentatore meccanico con uno a doppia camera",
    input: "",
    output: '{"text":"Sostituisco l\'alimentatore meccanico con la versione a doppia camera.","actions":[{"type":"replace","target":"alimentatore meccanico","search":"alimentatore meccanico doppia camera"}]}'
  },
  {
    instruction: "Vorrei vedere come sta un elevatore magnetico al posto di quello a nastro",
    input: "",
    output: '{"text":"Sostituisco l\'elevatore a nastro con un elevatore magnetico per visualizzare il risultato.","actions":[{"type":"replace","target":"elevatore","search":"elevatore magnetico"}]}'
  },
  {
    instruction: "Metti un robot SCARA dove c'e il robot antropomorfo",
    input: "",
    output: '{"text":"Sostituisco il robot antropomorfo con un robot SCARA.","actions":[{"type":"replace","target":"robot antropomorfo","search":"robot SCARA"}]}'
  },
  {
    instruction: "Sostituisci il canale vibrante con un nastro inclinato",
    input: "",
    output: '{"text":"Sostituzione: canale vibrante \u2192 nastro trasportatore inclinato.","actions":[{"type":"replace","target":"canale vibrante","search":"nastro inclinato"}]}'
  }
];

const all = old.concat(newExamples);
fs.writeFileSync(path + 'training7.json', JSON.stringify(all, null, 2), 'utf8');
console.log('training7.json creato: ' + all.length + ' esempi (' + old.length + ' esistenti + ' + newExamples.length + ' nuovi)');
