import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { higgsfield } from '@higgsfield/client/v2';

async function main() {
  console.log('Iniciando solicitud a Higgsfield API (bytedance/seedance-2.5/text-to-video)...');

  try {
    const response = await higgsfield.subscribe('bytedance/seedance-2.5/text-to-video', {
      input: {
        prompt: 'A cinematic scene at sunset',
        duration: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
      },
    });

    if (response.status === 'completed' && response.video?.url) {
      console.log('Generación exitosa. URL del video generado:');
      console.log(response.video.url);
      return response.video.url;
    }

    if (response.status === 'failed') {
      console.error('La generación fue cancelada o falló:', JSON.stringify(response, null, 2));
      process.exit(1);
    }

    if (response.status === 'nsfw') {
      console.error('La solicitud fue moderada por las políticas de contenido (NSFW).');
      process.exit(1);
    }

    console.log('Estado de respuesta:', response.status);
    if (response.video?.url) {
      console.log('URL del video:', response.video.url);
      return response.video.url;
    }
  } catch (error: any) {
    if (error.name === 'AccountError' || error.message?.toLowerCase().includes('credit')) {
      console.error('Bloqueo de ejecución (Blocker): Saldo insuficiente de créditos en la cuenta de Higgsfield.');
      console.error(`Detalle: ${error.message}`);
    } else {
      console.error('Error durante la llamada a Seedance 2.5:', error.message || error);
    }
    process.exit(1);
  }
}

main();
