let port;
let reader;
let writer;
let keepReading = true;
let frameIndex = 0;

const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const connBadge = document.getElementById('conn-badge');
const terminalLogs = document.getElementById('terminal-logs');
const terminalInput = document.getElementById('terminal-input');
const btnSend = document.getElementById('btn-send');
const terminalForm = document.getElementById('terminal-form');
const btnAtCmds = document.querySelectorAll('.btn-at');

const telemetryTbody = document.getElementById('telemetry-tbody');
const lblEmptyTelemetry = document.getElementById('row-empty');

// Check for Web Serial API support
if (!("serial" in navigator)) {
  connBadge.textContent = "Web Serial Non Supporté";
  connBadge.style.background = "var(--color-danger)";
  connBadge.title = "L'API Web Serial nécessite Chrome/Edge et un accès via HTTPS ou localhost (Live Server).";
  btnConnect.disabled = true;
  appendLog("ERREUR CRITIQUE: L'API Web Serial n'est pas disponible.");
  appendLog("Assurez-vous d'utiliser Chrome/Edge et d'ouvrir ce site via HTTPS ou un serveur local (localhost), et non 'file:///'.");
}

btnConnect.addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    connBadge.textContent = 'Série Connectée';
    connBadge.classList.remove('disconnected');
    connBadge.classList.add('connected');
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
    terminalInput.disabled = false;
    btnSend.disabled = false;

    keepReading = true;
    appendLog("--- Connexion Série Établie ---");
    readLoop();
  } catch (err) {
    console.error('Erreur de connexion série', err);
    alert('Erreur lors de la connexion au port série : ' + err.message + '\n\n(Vérifiez que le port n\'est pas déjà ouvert dans un autre logiciel comme PlatformIO ou le Flasher.)');
  }
});

btnDisconnect.addEventListener('click', async () => {
  keepReading = false;
  if (reader) {
    await reader.cancel().catch(e => console.error("Reader cancel error:", e));
  }
  if (port) {
    await port.close().catch(e => console.error("Port close error:", e));
  }
  
  connBadge.textContent = 'Série Déconnectée';
  connBadge.classList.remove('connected');
  connBadge.classList.add('disconnected');
  btnConnect.disabled = false;
  btnDisconnect.disabled = true;
  terminalInput.disabled = true;
  btnSend.disabled = true;
  appendLog("--- Déconnecté ---");
});

async function readLoop() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();

  let partialLine = '';

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        partialLine += value;
        let lines = partialLine.split('\n');
        partialLine = lines.pop(); // Keep incomplete line

        for (let line of lines) {
          line = line.replace('\r', '').trim();
          if(line.length > 0) {
            appendLog(line);
            parseTelemetry(line);
          }
        }
      }
    }
  } catch (error) {
    console.error('Erreur de lecture:', error);
    appendLog("Erreur de lecture: " + error.message);
  } finally {
    reader.releaseLock();
  }
}

function appendLog(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  terminalLogs.appendChild(div);
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

// Envoi de données
async function sendData(data) {
  if (!port || !port.writable) {
    appendLog("Erreur: Port série non prêt.");
    return;
  }
  try {
    const encoder = new TextEncoder();
    const writerBuffer = port.writable.getWriter();
    await writerBuffer.write(encoder.encode(data + '\r\n'));
    writerBuffer.releaseLock();
    appendLog('> ' + data);
  } catch(e) {
    console.error('Erreur d\'envoi:', e);
    appendLog("Erreur d'envoi: " + e.message);
  }
}

terminalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = terminalInput.value;
  if (val) {
    sendData(val);
    terminalInput.value = '';
  }
});

btnAtCmds.forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.getAttribute('data-cmd');
    sendData(cmd);
  });
});

// Parsing telemetry
function parseTelemetry(line) {
  // [TX] UTC:1782586735 | POS:43.60014, 1.47430 | ALT:201.5m | SPD:0.1km/h | COG:0.0° | T:38.10°C | SAT:11 | BAT:0mV | STATUS:0x01
  if(line.startsWith('[TX]')) {
    try {
      if(lblEmptyTelemetry) lblEmptyTelemetry.style.display = 'none';
      
      const parts = line.split('|').map(p => p.trim());
      let d = { ts: '', pos: '', alt: '', spd: '', sat: '', temp: '', bat: '' };
      
      parts.forEach(part => {
        if(part.startsWith('UTC:')) d.ts = part.split(':')[1];
        if(part.startsWith('POS:')) d.pos = part.split('POS:')[1];
        if(part.startsWith('ALT:')) d.alt = part.split(':')[1];
        if(part.startsWith('SPD:')) d.spd = part.split(':')[1];
        if(part.startsWith('T:')) d.temp = part.split(':')[1];
        if(part.startsWith('SAT:')) d.sat = part.split(':')[1];
        if(part.startsWith('BAT:')) d.bat = part.split(':')[1];
      });
      
      frameIndex++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${frameIndex}</td>
        <td style="font-family: var(--font-mono);">${d.ts}</td>
        <td style="font-family: var(--font-mono); color: var(--color-cyan);">${d.pos}</td>
        <td>${d.alt}</td>
        <td>${d.spd}</td>
        <td>${d.sat}</td>
        <td>${d.temp}</td>
        <td style="color: var(--color-success);">${d.bat}</td>
      `;
      telemetryTbody.prepend(tr);
      
      // limit rows
      if (telemetryTbody.children.length > 50) {
        telemetryTbody.removeChild(telemetryTbody.lastChild);
      }
      
      // Update Map
      if(d.pos && window.updateMap) {
        const coords = d.pos.split(',');
        if(coords.length === 2) {
          window.updateMap(coords[0].trim(), coords[1].trim());
        }
      }
    } catch(e) {
      console.error('Parse err:', e);
    }
  }
}

document.getElementById('btn-clear-terminal')?.addEventListener('click', () => {
  terminalLogs.innerHTML = '';
});

document.getElementById('btn-clear-telemetry')?.addEventListener('click', () => {
  telemetryTbody.innerHTML = '<tr id="row-empty"><td id="lbl-empty-telemetry" colspan="8" class="text-center text-secondary">No frames received yet. Connect the serial port and power on your trackers.</td></tr>';
  frameIndex = 0;
});
