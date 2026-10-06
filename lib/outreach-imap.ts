import tls from 'node:tls';

export type InboxMessage = {
  uid: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  date: string;
  snippet: string;
  matchedContactId?: string;
  matchedContactBusiness?: string;
};

function decodeMimeWord(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString(charset.toLowerCase() === 'utf-8' ? 'utf8' : 'latin1');
      } else if (encoding.toUpperCase() === 'Q') {
        const decoded = text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        return decodeURIComponent(escape(decoded));
      }
    } catch {
      return text;
    }
    return text;
  });
}

function decodeQuotedPrintable(text: string): string {
  if (!text) return '';
  const normalized = text.replace(/=\r?\n/g, '');
  try {
    const raw = normalized.replace(/=([0-9A-F]{2})/gi, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    return decodeURIComponent(escape(raw));
  } catch {
    return normalized;
  }
}

function cleanBodySnippet(raw: string): string {
  if (!raw) return '';
  let content = raw;

  // 1. Si es multipart, buscar la sección text/plain
  const plainMatch = content.match(
    /Content-Type:\s*text\/plain[^]*?(?:\r?\n\r?\n)([\s\S]*?)(?:--[a-zA-Z0-9_=-]+|\nContent-Type:|$)/i
  );
  if (plainMatch && plainMatch[1]?.trim()) {
    content = plainMatch[1];
  } else {
    // Si no tiene marcador explícito, cortar antes de la sección HTML
    const htmlIdx = content.search(/Content-Type:\s*text\/html|<html/i);
    if (htmlIdx > 0) {
      content = content.slice(0, htmlIdx);
    }
  }

  // 2. Limpiar prefijos IMAP y cabeceras residuales
  content = content
    .replace(/^BODY\[TEXT\]<[^>]*>\s*\{[^}]*\}\s*/i, '')
    .replace(/--[a-zA-Z0-9_=-]+/g, '')
    .replace(/format=\w+/gi, '')
    .replace(/charset=[\w"-]+/gi, '')
    .replace(/Content-(?:Type|Transfer-Encoding|Disposition):[^\r\n]*/gi, '');

  // 3. Decodificar Quoted-Printable (=C3=B3, =3D, etc.)
  content = decodeQuotedPrintable(content);

  // 4. Quitar etiquetas HTML si quedaron restos
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  // 5. Separar mensaje principal de citas automáticas
  const lines = content.split(/\r?\n/).map(l => l.trimEnd());
  const cleanLines: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith('>') || /^(?:El|On)\s+.+escribi[óo]:/i.test(line.trim())) {
      break;
    }
    cleanLines.push(line);
  }

  const finalResult = (cleanLines.length > 0 ? cleanLines.join('\n') : content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return finalResult || '(Sin texto en el mensaje)';
}

/**
 * Conecta mediante TLS al buzón IMAP de Nominalia (pop.securemail.pro:993)
 * y descarga las respuestas recientes para mostrarlas en el panel CRM.
 */
export async function fetchOutreachInbox(options?: { limit?: number }): Promise<{
  success: boolean;
  messages: InboxMessage[];
  error?: string;
}> {
  const limit = options?.limit ?? 15;
  const host = process.env.RIFX_OUTREACH_IMAP_HOST || 'pop.securemail.pro';
  const port = Number(process.env.RIFX_OUTREACH_IMAP_PORT) || 993;
  const user = process.env.RIFX_OUTREACH_SMTP_USER;
  const pass = process.env.RIFX_OUTREACH_SMTP_PASSWORD;

  if (!user || !pass) {
    return { success: false, error: 'Credenciales de correo (SMTP/IMAP) no configuradas en el entorno.', messages: [] };
  }

  return new Promise((resolve) => {
    const messages: InboxMessage[] = [];
    let buffer = '';
    let tagIdx = 1;
    let socketEnded = false;

    const timeout = setTimeout(() => {
      if (!socketEnded) {
        socketEnded = true;
        try { socket.destroy(); } catch {}
        resolve({ success: true, messages });
      }
    }, 12000);

    const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {});
    socket.setEncoding('utf8');

    function send(cmd: string) {
      const tag = `A${String(tagIdx++).padStart(3, '0')}`;
      socket.write(`${tag} ${cmd}\r\n`);
      return tag;
    }

    socket.on('data', (chunk: string) => {
      buffer += chunk;

      if (buffer.includes('* OK') && tagIdx === 1) {
        send(`LOGIN "${user}" "${pass}"`);
        buffer = '';
        return;
      }

      if (buffer.includes('A001 OK')) {
        send('SELECT INBOX');
        buffer = '';
        return;
      }

      if (buffer.includes('A001 NO') || buffer.includes('A001 BAD')) {
        clearTimeout(timeout);
        socketEnded = true;
        socket.end();
        resolve({ success: false, error: 'Contraseña o usuario incorrecto en el servidor de correo.', messages: [] });
        return;
      }

      if (buffer.includes('A002 OK')) {
        send('SEARCH ALL');
        buffer = '';
        return;
      }

      if (buffer.includes('A003 OK')) {
        const searchLine = buffer.split('\r\n').find(l => l.startsWith('* SEARCH'));
        const ids = (searchLine || '').replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean);
        if (ids.length === 0) {
          send('LOGOUT');
          return;
        }
        const recentIds = ids.slice(-limit).reverse();
        send(`FETCH ${recentIds.join(',')} (UID ENVELOPE BODY.PEEK[TEXT]<0.3000>)`);
        buffer = '';
        return;
      }

      if (buffer.includes('A004 OK')) {
        const chunks = buffer.split(/\* \d+ FETCH/);
        for (const item of chunks) {
          if (!item.includes('ENVELOPE')) continue;

          const uidMatch = item.match(/UID\s+(\d+)/);
          const dateMatch = item.match(/ENVELOPE \("([^"]+)"/);
          const subjMatch = item.match(/ENVELOPE \("[^"]*"\s+"([^"]*)"/);
          const fromMatch = item.match(/\(\("([^"]*)"\s+NIL\s+"([^"]*)"\s+"([^"]*)"\)\)/);

          const fromEmail = fromMatch ? `${fromMatch[2]}@${fromMatch[3]}`.toLowerCase().trim() : '';
          const fromName = fromMatch ? decodeMimeWord(fromMatch[1]) : '';
          const subject = subjMatch ? decodeMimeWord(subjMatch[1]) : '(Sin asunto)';
          const date = dateMatch ? dateMatch[1] : '';
          const uid = uidMatch ? uidMatch[1] : String(Date.now());

          const textIdx = item.indexOf('BODY[TEXT]');
          const rawBody = textIdx !== -1 ? item.slice(textIdx) : '';
          const snippet = cleanBodySnippet(rawBody);

          // Omitir correos autoremitidos de prueba si no tienen contenido relevante
          if (fromEmail) {
            messages.push({
              uid,
              fromEmail,
              fromName: fromName || fromEmail.split('@')[0],
              subject,
              date,
              snippet,
            });
          }
        }

        send('LOGOUT');
        buffer = '';
        return;
      }

      if (buffer.includes('A005 OK') || buffer.includes('BYE')) {
        clearTimeout(timeout);
        socketEnded = true;
        socket.end();
        resolve({ success: true, messages });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      if (!socketEnded) {
        socketEnded = true;
        resolve({ success: false, error: err.message, messages: [] });
      }
    });
  });
}

/**
 * Elimina mensajes permanentemente del servidor IMAP de Nominalia (pop.securemail.pro:993).
 * Utiliza UID STORE +FLAGS (\Deleted) seguido de EXPUNGE para purgar físicamente los correos
 * y liberar memoria y cuota de almacenamiento en la cuenta de correo de Nominalia.
 */
export async function deleteOutreachMessages(uids: string[]): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const host = process.env.RIFX_OUTREACH_IMAP_HOST || 'pop.securemail.pro';
  const port = Number(process.env.RIFX_OUTREACH_IMAP_PORT) || 993;
  const user = process.env.RIFX_OUTREACH_SMTP_USER;
  const pass = process.env.RIFX_OUTREACH_SMTP_PASSWORD;

  const validUids = Array.from(new Set(uids.filter(id => typeof id === 'string' && /^\d+$/.test(id.trim()))));
  if (validUids.length === 0) {
    return { success: false, count: 0, error: 'No se enviaron identificadores válidos de mensaje para eliminar.' };
  }

  if (!user || !pass) {
    return { success: false, count: 0, error: 'Credenciales de correo (SMTP/IMAP) no configuradas en el entorno.' };
  }

  return new Promise((resolve) => {
    let buffer = '';
    let tagIdx = 1;
    let socketEnded = false;

    const timeout = setTimeout(() => {
      if (!socketEnded) {
        socketEnded = true;
        try { socket.destroy(); } catch {}
        resolve({ success: false, count: 0, error: 'Tiempo de espera agotado al conectar con Nominalia para eliminar correos.' });
      }
    }, 12000);

    const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {});
    socket.setEncoding('utf8');

    function send(cmd: string) {
      const tag = `D${String(tagIdx++).padStart(3, '0')}`;
      socket.write(`${tag} ${cmd}\r\n`);
      return tag;
    }

    socket.on('data', (chunk: string) => {
      buffer += chunk;

      // 1. Conexión establecida -> LOGIN
      if (buffer.includes('* OK') && tagIdx === 1) {
        send(`LOGIN "${user}" "${pass}"`);
        buffer = '';
        return;
      }

      // 2. Login OK -> SELECT INBOX
      if (buffer.includes('D001 OK')) {
        send('SELECT INBOX');
        buffer = '';
        return;
      }

      if (buffer.includes('D001 NO') || buffer.includes('D001 BAD')) {
        clearTimeout(timeout);
        socketEnded = true;
        socket.end();
        resolve({ success: false, count: 0, error: 'Credenciales de acceso incorrectas en el servidor de correo de Nominalia.' });
        return;
      }

      // 3. Select INBOX OK -> Marcar con \Deleted
      if (buffer.includes('D002 OK')) {
        send(`UID STORE ${validUids.join(',')} +FLAGS (\\Deleted)`);
        buffer = '';
        return;
      }

      // 4. Flags asignadas -> EXPUNGE para purgar y liberar espacio en disco
      if (buffer.includes('D003 OK')) {
        send('EXPUNGE');
        buffer = '';
        return;
      }

      // 5. Expunge OK -> LOGOUT
      if (buffer.includes('D004 OK')) {
        send('LOGOUT');
        buffer = '';
        return;
      }

      // 6. Logout completado o BYE
      if (buffer.includes('D005 OK') || buffer.includes('BYE')) {
        clearTimeout(timeout);
        socketEnded = true;
        socket.end();
        resolve({ success: true, count: validUids.length });
        return;
      }

      if (/\bD\d{3}\s+(?:NO|BAD)\b/i.test(buffer)) {
        clearTimeout(timeout);
        socketEnded = true;
        socket.end();
        resolve({ success: false, count: 0, error: 'El servidor de Nominalia rechazó la operación de borrado.' });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      if (!socketEnded) {
        socketEnded = true;
        resolve({ success: false, count: 0, error: err.message });
      }
    });
  });
}

