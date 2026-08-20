import nodemailer from 'nodemailer';

// Gmail SMTP transporter — uses App Password for authentication
// Free: 500 emails/day with Gmail
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

/**
 * Send a 6-digit verification code to the user's email.
 * Returns true if the email was sent successfully.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  const transporter = createTransporter();
  const fromAddress = process.env.GMAIL_USER || 'noreply@rifx.online';

  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📧 [DEV] Verification code for ${to}: ${code}\n`);
  }

  if (!transporter) {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    console.error('Email transporter not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"RIFX Marketing" <${fromAddress}>`,
      to,
      subject: `${code} — Tu código de verificación RIFX`,
      html: buildVerificationEmailHtml(code),
      text: `Tu código de verificación RIFX es: ${code}\n\nEste código expira en 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`,
    });
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error instanceof Error ? error.message : 'unknown_error');
    return false;
  }
}

function buildVerificationEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa;padding:40px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          
          <!-- Header Logo -->
          <tr>
            <td style="text-align:center;padding:40px 30px 10px;">
              <a href="https://rifx-marketing.com" target="_blank" style="text-decoration:none;">
                <img src="https://rifx-marketing.com/images/rifx-logo-particles-clean.png" alt="RIFX Marketing" height="45" style="display:block;margin:0 auto;border:0;color:#111827;font-size:24px;font-weight:bold;">
              </a>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:10px 40px 20px;text-align:center;">
              <h1 style="margin:0;color:#111827;font-size:26px;font-weight:700;line-height:1.3;">
                <span style="background-color:#fef08a;padding:2px 8px;border-radius:4px;">Tu código</span> de verificación en dos pasos:
              </h1>
            </td>
          </tr>

          <!-- Code Box -->
          <tr>
            <td style="padding:10px 40px 30px;text-align:center;">
              <div style="background-color:#f3f4f6;border-radius:8px;padding:24px 0;display:inline-block;width:100%;max-width:320px;">
                <span style="color:#111827;font-size:46px;font-weight:700;letter-spacing:14px;font-family:'Courier New',Courier,monospace;display:block;margin-left:14px;">
                  ${code}
                </span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:0 40px 30px;text-align:center;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                ¡Hola!
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Has intentado acceder o registrarte en un nuevo dispositivo. Para completar el inicio de sesión, usa el siguiente <span style="background-color:#fef08a;padding:2px 6px;border-radius:3px;">código</span>.
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Este código expirará en <strong>10 minutos</strong>.
              </p>
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
                <span style="color:#0ea5e9;font-weight:bold;">Si no has sido <span style="background-color:#fef08a;padding:2px 6px;color:#111827;border-radius:3px;">tú</span>, cambia <span style="background-color:#fef08a;padding:2px 6px;color:#111827;border-radius:3px;">tu</span> contraseña de inmediato.</span>
              </p>
            </td>
          </tr>
          
          <!-- Team Sign-off -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
                Saludos,<br>
                <strong>Tus amigos de RIFX Marketing</strong>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">
            </td>
          </tr>

          <!-- Social & Anti-phishing (Binance Style) -->
          <tr>
            <td style="padding:30px 40px;text-align:center;">
              <p style="margin:0 0 15px;color:#eab308;font-size:17px;font-weight:700;">
                ¡Mantente conectado!
              </p>
              
              <!-- Social Icons -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 25px;">
                <tr>
                  <td style="padding:0 10px;"><a href="https://www.facebook.com/profile.php?id=61556910667259" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/facebook-new.png" width="22" alt="Facebook"></a></td>
                  <td style="padding:0 10px;"><a href="https://www.instagram.com/rifxmarketing/" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/instagram-new--v1.png" width="22" alt="Instagram"></a></td>
                  <td style="padding:0 10px;"><a href="https://www.tiktok.com/@rifxmarketing" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/tiktok--v1.png" width="22" alt="TikTok"></a></td>
                  <td style="padding:0 10px;"><a href="https://www.youtube.com/@RIFX_Marketing" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/youtube-play.png" width="22" alt="YouTube"></a></td>
                </tr>
              </table>

              <!-- Anti-Phishing Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                <tr>
                  <td style="text-align:left;padding-right:15px;vertical-align:middle;">
                    <p style="margin:0;color:#4b5563;font-size:12px;line-height:1.5;">
                      Como medida de protección, recuerda que RIFX nunca te pedirá este código. <a href="https://rifx-marketing.com/seguridad" style="color:#eab308;text-decoration:none;font-weight:bold;">Aprende más aquí</a>.
                    </p>
                  </td>
                  <td width="90" style="text-align:right;vertical-align:middle;">
                    <div style="background-color:#fef08a;color:#854d0e;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:12px;display:inline-block;white-space:nowrap;border:1px solid #fde047;">
                      Anti-phishing
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td style="padding:24px 30px;text-align:center;">
              <p style="margin:0 0 16px;color:#6b7280;font-size:11px;line-height:1.6;text-align:justify;">
                <strong style="color:#4b5563;">Aviso legal:</strong> Ten cuidado con los sitios de phishing y asegúrate de que siempre estés en nuestro sitio web oficial <strong>rifx-marketing.com</strong> cuando ingreses datos confidenciales. Solo tú eres responsable de la seguridad de tu cuenta. Nunca compartas tus contraseñas ni códigos de verificación de dos pasos con terceros, ni siquiera con el equipo de soporte.
              </p>
              
              <p style="margin:0 0 16px;color:#6b7280;font-size:11px;line-height:1.5;">
                Recibiste este correo electrónico por ser un usuario registrado de <a href="https://rifx-marketing.com" style="color:#eab308;text-decoration:none;">rifx-marketing.com</a><br>
                Para obtener más información sobre cómo procesamos los datos, consulta nuestra <a href="https://rifx-marketing.com/privacidad" style="color:#eab308;text-decoration:none;">Política de privacidad</a>.
              </p>
              
              <p style="margin:0 0 16px;color:#6b7280;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} RIFX Marketing. Todos los derechos reservados.
              </p>
              
              <p style="margin:0;font-size:11px;">
                <a href="https://rifx-marketing.com/terminos" style="color:#0ea5e9;text-decoration:none;">Términos de servicio</a> &nbsp;|&nbsp;
                <a href="https://rifx-marketing.com/privacidad" style="color:#0ea5e9;text-decoration:none;">Política de privacidad</a> &nbsp;|&nbsp;
                <strong style="color:#374151;">¿Necesitas ayuda? <a href="https://rifx-marketing.com/soporte" style="color:#10b981;text-decoration:none;">rifx-marketing.com/soporte</a></strong>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a password reset link to the user's email.
 * Returns true if the email was sent successfully.
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const transporter = createTransporter();
  const fromAddress = process.env.GMAIL_USER || 'noreply@rifx.online';

  if (!transporter) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📧 [DEV] Password reset link for ${to}: ${resetLink}\n`);
      return true;
    }
    console.error('Email transporter not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing');
    return false;
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📧 [DEV] Password reset link for ${to}: ${resetLink}\n`);
    }
    await transporter.sendMail({
      from: `"RIFX Marketing" <${fromAddress}>`,
      to,
      subject: `Restablecer tu contraseña — RIFX`,
      html: buildPasswordResetEmailHtml(resetLink),
      text: `Has solicitado restablecer tu contraseña.\n\nHaz clic en el siguiente enlace para crear una nueva contraseña:\n${resetLink}\n\nEste enlace expira en 2 horas.\n\nSi no solicitaste este cambio, ignora este mensaje.`,
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error instanceof Error ? error.message : 'unknown_error');
    return false;
  }
}

function buildPasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa;padding:40px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          
          <!-- Header Logo -->
          <tr>
            <td style="text-align:center;padding:40px 30px 10px;">
              <a href="https://rifx-marketing.com" target="_blank" style="text-decoration:none;">
                <img src="https://rifx-marketing.com/images/rifx-logo-particles-clean.png" alt="RIFX Marketing" height="45" style="display:block;margin:0 auto;border:0;color:#111827;font-size:24px;font-weight:bold;">
              </a>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:10px 40px 20px;text-align:center;">
              <h1 style="margin:0;color:#111827;font-size:26px;font-weight:700;line-height:1.3;">
                <span style="background-color:#fef08a;padding:2px 8px;border-radius:4px;">Restablecer</span> tu contraseña
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:0 40px 30px;text-align:center;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                ¡Hola!
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Has solicitado restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para configurar una nueva contraseña de forma segura.
              </p>
              
              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:30px auto;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#111827;">
                    <a href="${resetLink}" target="_blank" style="font-size:16px;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:6px;padding:14px 28px;border:1px solid #111827;display:inline-block;font-weight:bold;">Restablecer contraseña</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Este enlace expirará en <strong>2 horas</strong>.
              </p>
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
                <span style="color:#0ea5e9;font-weight:bold;">Si no has sido <span style="background-color:#fef08a;padding:2px 6px;color:#111827;border-radius:3px;">tú</span>, por favor ignora este mensaje. <span style="background-color:#fef08a;padding:2px 6px;color:#111827;border-radius:3px;">Tu</span> cuenta seguirá segura.</span>
              </p>
            </td>
          </tr>
          
          <!-- Team Sign-off -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
                Saludos,<br>
                <strong>Tus amigos de RIFX Marketing</strong>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">
            </td>
          </tr>

          <!-- Social & Anti-phishing (Binance Style) -->
          <tr>
            <td style="padding:30px 40px;text-align:center;">
              <p style="margin:0 0 15px;color:#eab308;font-size:17px;font-weight:700;">
                ¡Mantente conectado!
              </p>
              
              <!-- Social Icons -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 25px;">
                <tr>
                  <td style="padding:0 10px;"><a href="https://www.facebook.com/profile.php?id=61556910667259" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/facebook-new.png" width="22" alt="Facebook"></a></td>
                  <td style="padding:0 10px;"><a href="https://www.instagram.com/rifxmarketing/" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/instagram-new--v1.png" width="22" alt="Instagram"></a></td>
                  <td style="padding:0 10px;"><a href="https://www.tiktok.com/@rifxmarketing" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/tiktok--v1.png" width="22" alt="TikTok"></a></td>
                  <td style="padding:0 10px;"><a href="https://www.youtube.com/@RIFX_Marketing" target="_blank"><img src="https://img.icons8.com/ios-filled/50/9ca3af/youtube-play.png" width="22" alt="YouTube"></a></td>
                </tr>
              </table>

              <!-- Anti-Phishing Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                <tr>
                  <td style="text-align:left;padding-right:15px;vertical-align:middle;">
                    <p style="margin:0;color:#4b5563;font-size:12px;line-height:1.5;">
                      Como medida de protección, recuerda que RIFX nunca te pedirá contraseñas por correo. <a href="https://rifx-marketing.com/seguridad" style="color:#eab308;text-decoration:none;font-weight:bold;">Aprende más aquí</a>.
                    </p>
                  </td>
                  <td width="90" style="text-align:right;vertical-align:middle;">
                    <div style="background-color:#fef08a;color:#854d0e;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:12px;display:inline-block;white-space:nowrap;border:1px solid #fde047;">
                      Anti-phishing
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td style="padding:24px 30px;text-align:center;">
              <p style="margin:0 0 16px;color:#6b7280;font-size:11px;line-height:1.6;text-align:justify;">
                <strong style="color:#4b5563;">Aviso legal:</strong> Ten cuidado con los sitios de phishing y asegúrate de que siempre estés en nuestro sitio web oficial <strong>rifx-marketing.com</strong> cuando ingreses datos confidenciales. Solo tú eres responsable de la seguridad de tu cuenta. Nunca compartas tus contraseñas con terceros, ni siquiera con el equipo de soporte.
              </p>
              
              <p style="margin:0 0 16px;color:#6b7280;font-size:11px;line-height:1.5;">
                Recibiste este correo electrónico por ser un usuario registrado de <a href="https://rifx-marketing.com" style="color:#eab308;text-decoration:none;">rifx-marketing.com</a><br>
                Para obtener más información sobre cómo procesamos los datos, consulta nuestra <a href="https://rifx-marketing.com/privacidad" style="color:#eab308;text-decoration:none;">Política de privacidad</a>.
              </p>
              
              <p style="margin:0 0 16px;color:#6b7280;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} RIFX Marketing. Todos los derechos reservados.
              </p>
              
              <p style="margin:0;font-size:11px;">
                <a href="https://rifx-marketing.com/terminos" style="color:#0ea5e9;text-decoration:none;">Términos de servicio</a> &nbsp;|&nbsp;
                <a href="https://rifx-marketing.com/privacidad" style="color:#0ea5e9;text-decoration:none;">Política de privacidad</a> &nbsp;|&nbsp;
                <strong style="color:#374151;">¿Necesitas ayuda? <a href="https://rifx-marketing.com/soporte" style="color:#10b981;text-decoration:none;">rifx-marketing.com/soporte</a></strong>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
