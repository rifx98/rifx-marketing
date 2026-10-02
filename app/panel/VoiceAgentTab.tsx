'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Play,
  Square,
  Sparkles,
  Save,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Radio,
  Sliders,
  History,
  Key,
  Flame,
  ArrowRight,
  ShieldCheck,
  Send,
  Copy,
  Check,
  Globe,
  HelpCircle,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { Conversation } from '@elevenlabs/client';
import { VOICE_AGENT_CLOSING_PROMPT } from '@/lib/sales-prompts';

interface VoiceAgentTabProps {
  language: string;
  tenantData: any;
}

export default function VoiceAgentTab({ language, tenantData }: VoiceAgentTabProps) {
  const isEn = language === 'en';

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'config' | 'cloning' | 'phone_calls'>('simulator');

  // Loading & Notification states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Settings State
  const [settings, setSettings] = useState<any>({
    name: 'Asistente de Ventas RIFX',
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    voice_name: 'Rachel (Cálida y Confiable)',
    system_prompt: VOICE_AGENT_CLOSING_PROMPT,
    first_message: '¡Hola! Es un gusto saludarte. Soy asesor en RIFX, cuéntame, ¿qué servicio o proyecto buscas para tu negocio?',
    is_active: true,
    inbound_enabled: true,
    outbound_enabled: true,
    twilio_phone_number: '',
    elevenlabs_api_key: '',
    agent_id: ''
  });

  // Voices list
  const [voices, setVoices] = useState<any[]>([]);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // WebRTC Simulator State
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationLogs, setConversationLogs] = useState<{ role: 'agent' | 'user'; text: string; time: string }[]>([]);
  const conversationInstanceRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Cloning State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [cloneVoiceName, setCloneVoiceName] = useState('');
  const [cloningLoading, setCloningLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Phone Call State (Twilio Real Dial)
  const [dialPhoneNumber, setDialPhoneNumber] = useState('');
  const [dialingLoading, setDialingLoading] = useState(false);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [hasMasterTwilio, setHasMasterTwilio] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneSearchCountry, setPhoneSearchCountry] = useState('EC');
  const [phoneSearchAreaCode, setPhoneSearchAreaCode] = useState('');
  const [phoneSearchResults, setPhoneSearchResults] = useState<any[]>([]);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [provisioningNumber, setProvisioningNumber] = useState(false);
  const [releasingNumber, setReleasingNumber] = useState(false);
  const [callForwardingModalOpen, setCallForwardingModalOpen] = useState(false);
  const [showManualTwilio, setShowManualTwilio] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const [manualMessage, setManualMessage] = useState('');
  const [isInteractiveSimulation, setIsInteractiveSimulation] = useState(false);
  const isCallingRef = useRef<boolean>(false);
  const isAgentSpeakingRef = useRef<boolean>(false);

  // Mantener refs sincronizados con el estado de llamada
  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  useEffect(() => {
    isAgentSpeakingRef.current = isAgentSpeaking;
  }, [isAgentSpeaking]);

  // Helper notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, voicesRes, logsRes] = await Promise.all([
        fetch('/api/panel/voice-agent/config'),
        fetch('/api/panel/voice-agent/voices'),
        fetch('/api/panel/voice-agent/logs')
      ]);

      const configData = await configRes.json();
      if (configData.settings) {
        setSettings(configData.settings);
      }
      if (configData.hasEnvKey !== undefined) {
        setHasEnvKey(configData.hasEnvKey);
      }
      if (configData.hasMasterTwilio !== undefined) {
        setHasMasterTwilio(configData.hasMasterTwilio);
      }

      const voicesData = await voicesRes.json();
      if (voicesData.voices) {
        setVoices(voicesData.voices);
      }

      const logsData = await logsRes.json();
      if (logsData.logs) {
        setCallLogs(logsData.logs);
      }
    } catch (err: any) {
      console.error('Error cargando datos de voz:', err);
      showNotification('error', 'Error al cargar información de voz.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      // Cleanup audio and calls
      if (conversationInstanceRef.current) {
        conversationInstanceRef.current.endSession().catch(() => {});
      }
      if (demoAudioRef.current) {
        demoAudioRef.current.pause();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Timer for active call
  useEffect(() => {
    if ((isCalling && callStatus === 'connected') || isPlayingDemo) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling, callStatus, isPlayingDemo]);

  // Función para hablar con voz natural en el navegador con reactivación garantizada del micrófono
  const speakVoiceResponse = (text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsAgentSpeaking(false);
      isAgentSpeakingRef.current = false;
      onEnd?.();
      if (isCallingRef.current) startSpeechListening();
      return;
    }

    try {
      // 1. Detener escucha temporalmente para que el micro no capture la voz del propio agente
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Mantener referencia en window para evitar garbage collection de Chrome en Windows
      (window as any)._activeVoiceUtterance = utterance;

      const voicesList = window.speechSynthesis.getVoices();
      const isFemale =
        settings.voice_name?.toLowerCase().includes('sarah') ||
        settings.voice_name?.toLowerCase().includes('laura') ||
        settings.voice_name?.toLowerCase().includes('rachel') ||
        settings.voice_name?.toLowerCase().includes('river');

      const spanishVoices = voicesList.filter((v) => v.lang.startsWith('es'));
      let chosen = spanishVoices.find((v) =>
        isFemale
          ? v.name.includes('Sabina') || v.name.includes('Monica') || v.name.includes('Elena') || v.name.includes('Google') || v.name.includes('Female')
          : v.name.includes('Raul') || v.name.includes('Pablo') || v.name.includes('Male')
      );
      if (!chosen && spanishVoices.length > 0) chosen = spanishVoices[0];
      if (chosen) utterance.voice = chosen;

      setIsAgentSpeaking(true);
      isAgentSpeakingRef.current = true;

      let finished = false;
      const onSpeechComplete = () => {
        if (finished) return;
        finished = true;
        (window as any)._activeVoiceUtterance = null;
        setIsAgentSpeaking(false);
        isAgentSpeakingRef.current = false;
        onEnd?.();

        // Reactivar el micrófono de inmediato si seguimos en la llamada
        if (isCallingRef.current) {
          setTimeout(() => {
            if (isCallingRef.current && !isAgentSpeakingRef.current) {
              startSpeechListening();
            }
          }, 300);
        }
      };

      utterance.onstart = () => {
        setIsAgentSpeaking(true);
        isAgentSpeakingRef.current = true;
      };
      utterance.onend = onSpeechComplete;
      utterance.onerror = onSpeechComplete;

      // Watchdog de seguridad: si Chrome cuelga el evento onend, reactivar a los pocos segundos
      const estimatedMs = Math.max(4000, (text.length / 10) * 1000);
      setTimeout(() => {
        if (!finished && isAgentSpeakingRef.current) {
          onSpeechComplete();
        }
      }, estimatedMs + 1000);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsAgentSpeaking(false);
      isAgentSpeakingRef.current = false;
      onEnd?.();
      if (isCallingRef.current) startSpeechListening();
    }
  };

  // Audio sample playback (con fallback a voz sintetizada si falla)
  const handlePlayVoicePreview = (url?: string, name?: string) => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    if (demoAudioRef.current) {
      demoAudioRef.current.pause();
      setIsPlayingDemo(false);
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (playingAudioUrl === (url || name)) {
      setPlayingAudioUrl(null);
      return;
    }

    if (url) {
      const audio = new Audio(url);
      audioPreviewRef.current = audio;
      setPlayingAudioUrl(url);
      audio.play().catch(() => {
        speakVoiceResponse(`Hola, soy ${name || 'tu asesor de voz'}. Esta es una muestra de cómo respondo llamadas.`, () => {
          setPlayingAudioUrl(null);
        });
      });
      audio.onended = () => setPlayingAudioUrl(null);
      audio.onerror = () => {
        speakVoiceResponse(`Hola, soy ${name || 'tu asesor de voz'}. Esta es una muestra de cómo respondo llamadas.`, () => {
          setPlayingAudioUrl(null);
        });
      };
    } else {
      setPlayingAudioUrl(name || 'voice');
      speakVoiceResponse(`Hola, soy ${name || 'tu asesor de voz'}. Esta es una muestra de cómo respondo llamadas.`, () => {
        setPlayingAudioUrl(null);
      });
    }
  };

  // Demo Call Simulation (No API Key Required)
  const handlePlayDemoCall = () => {
    if (isPlayingDemo) {
      if (demoAudioRef.current) {
        demoAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingDemo(false);
      setIsAgentSpeaking(false);
      return;
    }

    const selectedVoice = voices.find((v) => v.voice_id === settings.voice_id) || voices[0];
    const previewUrl = selectedVoice?.preview_url || 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3';

    if (audioPreviewRef.current) audioPreviewRef.current.pause();

    const greeting = settings.first_message || '¡Hola! Qué gusto saludarte. Soy el asesor inteligente de la empresa, ¿en qué te puedo ayudar hoy?';

    setConversationLogs([
      {
        role: 'agent',
        text: greeting,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);

    setIsPlayingDemo(true);
    setIsAgentSpeaking(true);

    const audio = new Audio(previewUrl);
    demoAudioRef.current = audio;

    audio.play().then(() => {
      audio.onended = () => {
        setIsPlayingDemo(false);
        setIsAgentSpeaking(false);
      };
    }).catch(() => {
      // Fallback si el navegador restringe audio directo
      speakVoiceResponse(greeting, () => {
        setIsPlayingDemo(false);
        setIsAgentSpeaking(false);
      });
    });
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/panel/voice-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar configuración');

      if (data.settings) {
        setSettings(data.settings);
      }
      showNotification('success', data.message || '¡Configuración guardada exitosamente!');
    } catch (err: any) {
      showNotification('error', err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Reconocimiento de Voz continuo para modo simulador
  const startSpeechListening = () => {
    if (typeof window === 'undefined') return;
    if (!isCallingRef.current) return;
    if (isAgentSpeakingRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('[Simulador] SpeechRecognition no está en este navegador, usa el campo de texto.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = async (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex]?.[0]?.transcript;
        if (transcript && transcript.trim().length > 0) {
          try { recognition.abort(); } catch {}
          recognitionRef.current = null;
          await handleSendUserSpeech(transcript.trim());
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[SpeechRecognition]:', e.error);
        }
      };

      recognition.onend = () => {
        // Si seguimos en llamada simulada y el agente no está hablando, reactivar
        if (isCallingRef.current && !isAgentSpeakingRef.current) {
          setTimeout(() => {
            if (isCallingRef.current && !isAgentSpeakingRef.current && !recognitionRef.current) {
              startSpeechListening();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        console.warn('No se pudo iniciar SpeechRecognition:', err);
      }
    }
  };

  // Envío de mensaje del usuario a la IA y respuesta hablada
  const handleSendUserSpeech = async (userText: string) => {
    if (!userText.trim()) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setConversationLogs((prev) => [
      ...prev,
      { role: 'user', text: userText, time: userTime }
    ]);

    try {
      setIsAgentSpeaking(true);
      isAgentSpeakingRef.current = true;

      const res = await fetch('/api/panel/voice-agent/simulate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          system_prompt: settings.system_prompt,
          history: conversationLogs.slice(-6)
        })
      });

      const data = await res.json();
      const reply = data.reply || 'Entendido perfectamente. ¿En qué más te puedo colaborar hoy?';
      const shouldHangUp = data.hang_up || false;
      const appointmentCreated = data.appointment_created || false;

      const agentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setConversationLogs((prev) => [
        ...prev,
        { role: 'agent', text: reply, time: agentTime }
      ]);

      if (appointmentCreated) {
        showNotification('success', '📅 ¡Cita registrada exitosamente en el calendario!');
      }

      speakVoiceResponse(reply, () => {
        if (shouldHangUp) {
          setTimeout(() => {
            handleEndBrowserCall();
            showNotification('info', '📞 Cierre completado. La llamada ha finalizado.');
          }, 1200);
        }
      });
    } catch (err) {
      console.error('Error al responder:', err);
      const fallbackReply = 'Te escucho claramente. Cuéntame los detalles de tu consulta.';
      const agentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setConversationLogs((prev) => [
        ...prev,
        { role: 'agent', text: fallbackReply, time: agentTime }
      ]);
      speakVoiceResponse(fallbackReply);
    }
  };

  // Iniciar Simulador de Voz Interactivo (sin requerir ElevenLabs)
  const startInteractiveVoiceSimulation = () => {
    setIsInteractiveSimulation(true);
    setCallStatus('connected');
    showNotification('info', '¡Llamada activa en Modo Interactivo! Habla por tu micrófono o escribe en la consola.');

    const initialGreeting = settings.first_message || '¡Hola! Es un gusto saludarte. Soy el asesor comercial de la empresa. Cuéntame, ¿qué servicio o meta te gustaría explorar hoy?';
    
    setConversationLogs([
      {
        role: 'agent',
        text: initialGreeting,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);

    speakVoiceResponse(initialGreeting, () => {
      startSpeechListening();
    });
  };

  // Start In-Browser Live Call
  const handleStartBrowserCall = async () => {
    try {
      setCallStatus('connecting');
      setIsCalling(true);
      setConversationLogs([]);

      // 1. Pedir permisos de micrófono con manejo amigable de errores
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr: any) {
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
          throw new Error('Permiso de micrófono bloqueado. En la barra de direcciones de tu navegador (icono de controles o candado a la izquierda), cambia "Micrófono" a "Permitir" y recarga la página.');
        }
        throw new Error('No se pudo acceder al micrófono: ' + (micErr.message || 'Verifica la conexión del micrófono.'));
      }

      // 2. Si tiene ElevenLabs configurado, iniciar sesión WebRTC oficial
      if (hasEnvKey || settings.has_custom_key) {
        try {
          const signedRes = await fetch('/api/panel/voice-agent/signed-url');
          const signedData = await signedRes.json();
          if (signedRes.ok && signedData.signed_url) {
            const conversation = await Conversation.startSession({
              signedUrl: signedData.signed_url,
              onConnect: () => {
                setCallStatus('connected');
                setIsInteractiveSimulation(false);
              },
              onDisconnect: () => {
                setIsCalling(false);
                setCallStatus('disconnected');
                setIsAgentSpeaking(false);
              },
              onError: (err) => {
                console.error('[ConvAI Error]:', err);
                showNotification('error', 'Error en la llamada de voz con ElevenLabs.');
                handleEndBrowserCall();
              },
              onModeChange: (mode) => {
                setIsAgentSpeaking(mode.mode === 'speaking');
              },
              onMessage: (msg: any) => {
                if (msg.message) {
                  setConversationLogs((prev) => [
                    ...prev,
                    {
                      role: msg.source === 'user' ? 'user' : 'agent',
                      text: msg.message,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    }
                  ]);
                }
              }
            });

            conversationInstanceRef.current = conversation;
            return;
          }
        } catch (elevenErr) {
          console.warn('[ElevenLabs] Error conectando a WebRTC, usando simulador interactivo:', elevenErr);
        }
      }

      // 3. Fallback inteligente a Simulador Interactivo en Vivo
      startInteractiveVoiceSimulation();
    } catch (err: any) {
      console.error('Error iniciando llamada:', err);
      setIsCalling(false);
      setCallStatus('disconnected');
      showNotification('error', err.message || 'Error al iniciar llamada de prueba.');
    }
  };

  // End In-Browser Live Call
  const handleEndBrowserCall = async () => {
    try {
      if (conversationInstanceRef.current && typeof conversationInstanceRef.current.endSession === 'function') {
        await conversationInstanceRef.current.endSession();
        conversationInstanceRef.current = null;
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (err) {
      console.warn('Error terminando llamada:', err);
    } finally {
      setIsCalling(false);
      setCallStatus('disconnected');
      setIsAgentSpeaking(false);
      setIsInteractiveSimulation(false);
    }
  };

  // Voice Recording for Cloning
  const startRecordingVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showNotification('error', 'No se pudo acceder al micrófono para grabar.');
    }
  };

  const stopRecordingVoice = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // Upload Voice Clone to ElevenLabs
  const handleCreateVoiceClone = async () => {
    if (!cloneVoiceName.trim()) {
      showNotification('error', 'Ingresa un nombre para tu voz.');
      return;
    }
    if (!recordedAudioBlob) {
      showNotification('error', 'Graba o sube una muestra de tu voz primero.');
      return;
    }

    try {
      setCloningLoading(true);
      const formData = new FormData();
      formData.append('name', cloneVoiceName.trim());
      formData.append('audio', recordedAudioBlob, 'voice-sample.webm');

      const res = await fetch('/api/panel/voice-agent/clone', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al clonar voz');

      showNotification('success', '¡Tu voz ha sido clonada exitosamente en ElevenLabs!');
      setCloneVoiceName('');
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
      // Recargar catálogo de voces
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message || 'Error al clonar la voz');
    } finally {
      setCloningLoading(false);
    }
  };

  // Trigger Outbound Phone Call via Twilio
  const handleDialRealPhone = async () => {
    if (!dialPhoneNumber.trim()) {
      showNotification('error', 'Ingresa un número telefónico válido con código de país.');
      return;
    }

    try {
      setDialingLoading(true);
      const res = await fetch('/api/panel/voice-agent/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_number: dialPhoneNumber.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al realizar llamada');

      showNotification('success', data.message || `Llamando a ${dialPhoneNumber}...`);
      setDialPhoneNumber('');
      // Refrescar historial
      setTimeout(fetchData, 3000);
    } catch (err: any) {
      showNotification('error', err.message || 'Error al llamar');
    } finally {
      setDialingLoading(false);
    }
  };

  // Buscar números en Twilio (SaaS Telephony)
  const handleSearchPhoneNumbers = async (country = phoneSearchCountry, areaCode = phoneSearchAreaCode) => {
    try {
      setSearchingNumbers(true);
      const params = new URLSearchParams({ country });
      if (areaCode?.trim()) params.append('areaCode', areaCode.trim());

      const res = await fetch(`/api/panel/voice-agent/phone-numbers?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron buscar números disponibles');
      }
      setPhoneSearchResults(data.numbers || []);
      if (!data.numbers || data.numbers.length === 0) {
        showNotification('info', `No encontramos números disponibles con ese prefijo para ${country}. Intenta con otro código de área.`);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error buscando números');
    } finally {
      setSearchingNumbers(false);
    }
  };

  // Asignar (comprar) número exclusivo para el agente del tenant
  const handleProvisionNumber = async (phoneNumber: string) => {
    try {
      setProvisioningNumber(true);
      const res = await fetch('/api/panel/voice-agent/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision', phoneNumber })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error asignando número telefónico');
      }

      showNotification('success', `¡Línea ${data.phoneNumber} activada y conectada exitosamente a tu agente de voz!`);
      setPhoneModalOpen(false);
      setPhoneSearchResults([]);
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message || 'No se pudo activar el número');
    } finally {
      setProvisioningNumber(false);
    }
  };

  // Liberar línea telefónica
  const handleReleaseNumber = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas liberar la línea ${settings?.twilio_phone_number}? El agente dejará de contestar llamadas a este número.`)) {
      return;
    }
    try {
      setReleasingNumber(true);
      const res = await fetch('/api/panel/voice-agent/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al liberar número');
      }
      showNotification('info', 'Línea telefónica liberada.');
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message || 'Error liberando número');
    } finally {
      setReleasingNumber(false);
    }
  };

  // Copiar número al portapapeles
  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  // Presets de Prompts
  const applyPromptPreset = (type: 'sales' | 'booking' | 'support') => {
    if (type === 'sales') {
      setSettings((prev: any) => ({
        ...prev,
        system_prompt: VOICE_AGENT_CLOSING_PROMPT,
        first_message: '¡Hola! Qué gusto saludarte. Soy asesor en RIFX, cuéntame, ¿qué servicio o proyecto buscas para tu negocio?'
      }));
    } else if (type === 'booking') {
      setSettings((prev: any) => ({
        ...prev,
        system_prompt: `Eres un asistente de recepción y citas para llamadas telefónicas.
Tu objetivo es coordinar la fecha y hora de la cita del cliente de forma ágil y cordial, confirmarla en el calendario y despedirte cordialmente una vez agendada.
NUNCA preguntes "¿hacemos una llamada?" porque ya estás hablando por teléfono.
Cuando el cliente confirme el horario y diga "okay", "gracias" o "listo", despídete con amabilidad y cuelga.`,
        first_message: '¡Hola! Gracias por llamar. Te ayudo a agendar tu cita en un instante. ¿Qué día y horario te convendría mejor?'
      }));
    } else {
      setSettings((prev: any) => ({
        ...prev,
        system_prompt: 'Eres un especialista de soporte y atención al cliente en una llamada telefónica. Escuchas activamente la necesidad o consulta del usuario con empatía y buscas darle una solución rápida, clara y humana.',
        first_message: '¡Hola! Bienvenido al canal de atención telefónica. ¿En qué puedo ayudarte hoy?'
      }));
    }
    showNotification('info', 'Plantilla de instrucciones aplicada.');
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[500px]">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-300 font-medium">Cargando Agente de Voz y Telefonía IA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Banner Superior ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-950 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              ElevenLabs Conversational AI
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {isEn ? 'AI Voice Agent & Telephony' : 'Agente de Voz & Llamadas Telefónicas IA'}
            </h1>
            <p className="text-blue-100/80 text-sm leading-relaxed">
              {isEn
                ? 'Ultra-low latency human-like voice agents. Make and receive calls, speak in real time, or clone your own voice.'
                : 'Agentes de voz humana en tiempo real. Atiende y realiza llamadas telefónicas comerciales, simula conversaciones en vivo y clona tu propia voz.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${hasEnvKey || settings.has_custom_key ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
              <div>
                <p className="text-[11px] text-blue-200 uppercase font-semibold">
                  {hasEnvKey || settings.has_custom_key ? 'ElevenLabs Conectado' : 'Falta API Key'}
                </p>
                <p className="text-sm font-bold truncate max-w-[160px]">{settings.voice_name || 'Sarah (Profesional)'}</p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubTab('simulator')}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              {isEn ? 'Test Live Call' : 'Probar Llamada en Vivo'}
            </button>
          </div>
        </div>

        {/* Decoración de fondo */}
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── Toast de Feedback ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="text-sm font-medium">{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs opacity-60 hover:opacity-100">
              Cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navegación de Sub-Pestañas ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('simulator')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'simulator'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          {isEn ? 'Live Simulator (WebRTC)' : 'Probador en Vivo (Micrófono)'}
        </button>

        <button
          onClick={() => setActiveSubTab('config')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'config'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          {isEn ? 'Agent Personality & Voice' : 'Personalidad y Voz del Agente'}
        </button>

        <button
          onClick={() => setActiveSubTab('cloning')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'cloning'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          {isEn ? 'Clone My Voice' : 'Clonar mi Propia Voz'}
        </button>

        <button
          onClick={() => setActiveSubTab('phone_calls')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'phone_calls'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Phone className="w-4 h-4" />
          {isEn ? 'Phone Line & Logs' : 'Telefonía Real & Historial'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. PROBADOR EN VIVO (WEBRTC SIMULATOR)                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Consola de Llamada */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[460px] shadow-sm">
            {/* Visualizador de audio / Onda de llamada */}
            <div className="relative mb-8 flex items-center justify-center">
              {/* Círculos de pulso cuando está en llamada */}
              {isCalling && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className="absolute w-44 h-44 rounded-full bg-blue-500/20"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.7, 1], opacity: [0.2, 0.05, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', delay: 0.3 }}
                    className="absolute w-56 h-56 rounded-full bg-indigo-500/10"
                  />
                </>
              )}

              <div
                onClick={() => {
                  if (isCalling && !isAgentSpeaking) {
                    startSpeechListening();
                    showNotification('info', 'Micrófono activo, te escucho.');
                  }
                }}
                className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                  isCalling
                    ? isAgentSpeaking
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white ring-8 ring-emerald-500/20 shadow-emerald-500/30'
                      : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white ring-8 ring-blue-500/20 shadow-blue-500/30 cursor-pointer hover:scale-105 active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
                title={isCalling && !isAgentSpeaking ? 'Micrófono activo (haz clic para reactivar)' : undefined}
              >
                {isCalling ? (
                  isAgentSpeaking ? (
                    <Volume2 className="w-12 h-12 animate-pulse" />
                  ) : (
                    <Mic className="w-12 h-12 animate-bounce" />
                  )
                ) : (
                  <Phone className="w-12 h-12" />
                )}
              </div>
            </div>

            {/* Estado de llamada */}
            <div className="space-y-2 mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isCalling
                  ? callStatus === 'connecting'
                    ? 'Conectando con ElevenLabs...'
                    : isAgentSpeaking
                    ? `${settings.voice_name || 'Agente'} está hablando...`
                    : 'Escuchándote... Habla libremente'
                  : 'Listo para probar tu Agente de Voz'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                {isCalling
                  ? 'Habla por tu micrófono como si fueras un cliente real. La IA responderá en menos de 600ms con voz humana.'
                  : 'Prueba la interacción en tiempo real desde tu navegador sin costo de telefonía.'}
              </p>

              {isCalling && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-semibold">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  {formatSeconds(callDuration)}
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isCalling ? (
                <>
                  <button
                    onClick={handlePlayDemoCall}
                    className={`px-6 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center gap-2.5 transform hover:-translate-y-0.5 ${
                      isPlayingDemo
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isPlayingDemo ? <Square className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-blue-600" />}
                    {isPlayingDemo ? 'Detener Demostración' : 'Escuchar Demostración'}
                  </button>

                  <button
                    onClick={handleStartBrowserCall}
                    className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-2.5 transform hover:-translate-y-0.5"
                  >
                    <Mic className="w-4 h-4" />
                    Hablar en Vivo (Micrófono)
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEndBrowserCall}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-base shadow-xl shadow-rose-500/30 transition-all flex items-center gap-3 transform hover:-translate-y-0.5"
                >
                  <PhoneOff className="w-5 h-5" />
                  Colgar Llamada
                </button>
              )}
            </div>
          </div>

          {/* Transcripción en Vivo */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col h-[460px] shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-blue-500" />
                Transcripción en Tiempo Real
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                {conversationLogs.length} mensajes
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 text-sm">
              {conversationLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Mic className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Los mensajes hablados aparecerán aquí en vivo cuando inicies la llamada.</p>
                </div>
              ) : (
                conversationLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-2xl ${
                      log.role === 'agent'
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-100 dark:border-blue-900/50'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 ml-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold opacity-60 mb-1">
                      <span>{log.role === 'agent' ? settings.voice_name || 'Agente IA' : 'Tú (Cliente)'}</span>
                      <span>{log.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{log.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input interactivo para probar escribiendo si no se desea hablar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualMessage.trim()) return;
                  if (!isCalling) {
                    handleStartBrowserCall().then(() => {
                      setTimeout(() => {
                        handleSendUserSpeech(manualMessage.trim());
                        setManualMessage('');
                      }, 1000);
                    });
                  } else {
                    handleSendUserSpeech(manualMessage.trim());
                    setManualMessage('');
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={manualMessage}
                  onChange={(e) => setManualMessage(e.target.value)}
                  placeholder={isCalling ? "Escribe un mensaje o habla por el mic..." : "Escribe aquí para probar el agente..."}
                  disabled={isAgentSpeaking}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!manualMessage.trim() || isAgentSpeaking}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs disabled:opacity-40 transition-all flex items-center justify-center shadow-sm"
                  title="Enviar mensaje al agente"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. CONFIGURACIÓN Y PERSONALIDAD DEL AGENTE                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Tarjeta de Instrucciones del Agente */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Personalidad e Instrucciones (System Prompt)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define cómo debe responder tu agente de voz cuando hable con clientes.
                  </p>
                </div>

                {/* Botones de Presets */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => applyPromptPreset('sales')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Ventas
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPromptPreset('booking')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Citas
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPromptPreset('support')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Soporte
                  </button>
                </div>
              </div>

              {/* Mensaje de Bienvenida Inicial */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Mensaje Inicial de Bienvenida (Lo primero que dice al contestar)
                </label>
                <input
                  type="text"
                  value={settings.first_message || ''}
                  onChange={(e) => setSettings({ ...settings, first_message: e.target.value })}
                  placeholder="¡Hola! Gracias por comunicarte, ¿en qué te puedo asesorar hoy?"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Prompt del Agente */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Prompt del Sistema & Reglas de Conversación
                </label>
                <textarea
                  rows={8}
                  value={settings.system_prompt || ''}
                  onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Instrucciones para el agente de voz..."
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando en ElevenLabs...' : 'Guardar y Sincronizar'}
                </button>
              </div>
            </div>
          </div>

          {/* Selector de Voz */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Selecciona la Voz de tu Agente
              </h3>
              <p className="text-xs text-slate-500">
                Elige entre las voces curadas en español o una voz que hayas clonado.
              </p>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {voices.map((v) => {
                  const isSelected = settings.voice_id === v.voice_id;
                  const isPlaying = playingAudioUrl === (v.preview_url || v.name);

                  return (
                    <div
                      key={v.voice_id}
                      onClick={() => setSettings({ ...settings, voice_id: v.voice_id, voice_name: v.name })}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20'
                          : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            v.category === 'cloned'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                          }`}
                        >
                          {v.category === 'cloned' ? '⭐' : 'AI'}
                        </div>
                        <div>
                          <p className="font-bold text-xs">{v.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {v.description || 'Voz de ElevenLabs'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handlePlayVoicePreview(v.preview_url, v.name)}
                          className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          title="Escuchar muestra de voz"
                        >
                          {isPlaying ? <Square className="w-4 h-4 text-blue-600" /> : <Play className="w-4 h-4" />}
                        </button>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ajustes de API Key de ElevenLabs */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Key className="w-4 h-4 text-blue-500" />
                  API Key de ElevenLabs
                </div>
                {hasEnvKey || settings.has_custom_key ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Conectada
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Requerida
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Para que el agente responda en vivo con voz humana necesitas tu API Key. Puedes conseguir una gratis en{' '}
                <a
                  href="https://elevenlabs.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline font-semibold"
                >
                  elevenlabs.io ↗
                </a>
              </p>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={settings.elevenlabs_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, elevenlabs_api_key: e.target.value })}
                  placeholder="xi-api-key..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  {saving ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 3. CLONACIÓN DE VOZ (TU PROPIA VOZ)                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'cloning' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grabador / Creador de Voz */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
                <Flame className="w-3.5 h-3.5" />
                Instant Voice Cloning
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Clona tu voz en 30 segundos
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Grábate leyendo un texto por 30 a 60 segundos. La inteligencia artificial replicará tu tono, cadencia y
                acento para que tu bot hable exactamente como tú.
              </p>
            </div>

            {/* Texto de guía para leer */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
              <strong>Guion sugerido para leer en voz alta:</strong>
              <p className="mt-1">
                &ldquo;Hola, bienvenidos a nuestro servicio de asesoría y marketing. En nuestro equipo nos apasiona
                ayudar a los negocios a automatizar sus procesos comerciales y conseguir más clientes todos los días con
                tecnología de punta.&rdquo;
              </p>
            </div>

            {/* Interfaz de Grabación */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 gap-4">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecordingVoice
                    ? 'bg-rose-500 text-white animate-pulse ring-8 ring-rose-500/20'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                }`}
              >
                {isRecordingVoice ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8 opacity-60" />}
              </div>

              {isRecordingVoice ? (
                <div className="text-center space-y-2">
                  <p className="text-sm font-bold text-rose-600 animate-pulse">Grabando tu voz...</p>
                  <p className="text-xs font-mono font-semibold text-slate-500">
                    Tiempo: {formatSeconds(recordingSeconds)} (Recomendado: 30 seg)
                  </p>
                  <button
                    onClick={stopRecordingVoice}
                    className="px-6 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow-md"
                  >
                    Detener Grabación
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <button
                    onClick={startRecordingVoice}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md flex items-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    Iniciar Grabación desde Micrófono
                  </button>
                  <p className="text-[11px] text-slate-400">O también puedes subir un archivo de audio grabado (.mp3, .wav)</p>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setRecordedAudioBlob(file);
                        setRecordedAudioUrl(URL.createObjectURL(file));
                      }
                    }}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300"
                  />
                </div>
              )}

              {/* Muestra grabada lista */}
              {recordedAudioUrl && !isRecordingVoice && (
                <div className="w-full mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Audio listo para clonar
                  </div>
                  <audio controls src={recordedAudioUrl} className="h-8 max-w-[200px]" />
                </div>
              )}
            </div>

            {/* Nombre y Clonación */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Nombre de tu Voz Clonada
                </label>
                <input
                  type="text"
                  value={cloneVoiceName}
                  onChange={(e) => setCloneVoiceName(e.target.value)}
                  placeholder="Ej. Mi Voz - Juan Pérez"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <button
                onClick={handleCreateVoiceClone}
                disabled={cloningLoading || !recordedAudioBlob}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Flame className="w-4 h-4" />
                {cloningLoading ? 'Clonando voz con ElevenLabs...' : 'Clonar mi Voz Ahora'}
              </button>
            </div>
          </div>

          {/* Información y Voces Clonadas Existentes */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Tus Voces Clonadas
              </h3>
              <p className="text-xs text-slate-500">
                Estas son las réplicas vocales que has entrenado en ElevenLabs.
              </p>

              <div className="space-y-3">
                {voices.filter((v) => v.category === 'cloned').length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
                    <Flame className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-500" />
                    <p className="text-xs font-medium">Aún no has clonado ninguna voz.</p>
                    <p className="text-[11px] mt-1 text-slate-400">
                      Graba tu voz a la izquierda y aparecerá aquí disponible para tus llamadas.
                    </p>
                  </div>
                ) : (
                  voices
                    .filter((v) => v.category === 'cloned')
                    .map((v) => (
                      <div
                        key={v.voice_id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            {v.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {v.voice_id}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSettings({ ...settings, voice_id: v.voice_id, voice_name: v.name });
                            showNotification('success', `Voz activada: ${v.name}`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                        >
                          Usar para llamadas
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white space-y-3 shadow-md">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Seguridad y Consentimiento
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                ElevenLabs procesa el archivo de audio para extraer las características biométricas de tu voz.
                Asegúrate de clonar únicamente voces con la autorización correspondiente del titular.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 4. TELEFONÍA REAL (TWILIO) & HISTORIAL                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'phone_calls' && (
        <div className="space-y-6">
          {/* Banner de Sincronización Requerida si falta agent_id */}
          {!settings?.agent_id && (
            <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Sincronización requerida con ElevenLabs
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                    Para realizar llamadas salientes a teléfonos reales, primero debes sincronizar tu agente: ve a la pestaña{' '}
                    <strong>Personalidad y Voz del Agente</strong>, ingresa tu <strong>API Key de ElevenLabs</strong> (abajo a la derecha) y haz clic en <strong>Guardar y Sincronizar</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('config')}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold whitespace-nowrap shadow-sm transition-all"
              >
                Configurar ElevenLabs →
              </button>
            </div>
          )}

          {/* Marcador Telefónico Real */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <PhoneCall className="w-3.5 h-3.5" />
                  Llamada Telefónica en Vivo
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Realizar Llamada Telefónica Saliente
                </h3>
                <p className="text-xs text-slate-500">
                  Ingresa tu número celular o el de un lead. El agente de voz llamará al teléfono real y conversará con
                  él.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="tel"
                  value={dialPhoneNumber}
                  onChange={(e) => setDialPhoneNumber(e.target.value)}
                  placeholder="+593991234567 o +525512345678"
                  className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono w-72 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  onClick={handleDialRealPhone}
                  disabled={dialingLoading || !dialPhoneNumber}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  <PhoneCall className="w-4 h-4" />
                  {dialingLoading ? 'Llamando...' : 'Llamar al Celular'}
                </button>
              </div>
            </div>
          </div>

          {/* 4. TELEFONÍA SAAS PROFESIONAL: LÍNEA EXCLUSIVA DEL AGENTE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-500" />
                  Línea Telefónica Exclusiva del Agente
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Número exclusivo para recibir llamadas 24/7 y realizar llamadas salientes automáticas de prospección.
                </p>
              </div>

              {settings?.twilio_phone_number ? (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2 self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Línea Conectada 24/7
                </span>
              ) : (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 self-start sm:self-auto">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Sin Línea Asignada
                </span>
              )}
            </div>

            {/* CASO A: EL TENANT YA TIENE NÚMERO ASIGNADO */}
            {settings?.twilio_phone_number ? (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Número Telefónico Activo
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                        {settings.twilio_phone_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(settings.twilio_phone_number)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                        title="Copiar número"
                      >
                        {copiedNumber ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCallForwardingModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <HelpCircle className="w-4 h-4" />
                      ¿Cómo desviar llamadas de mi número actual?
                    </button>
                    <button
                      type="button"
                      onClick={handleReleaseNumber}
                      disabled={releasingNumber}
                      className="px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Liberar línea si ya no la usarás"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {releasingNumber ? 'Liberando...' : 'Liberar Línea'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span>
                    <strong>Atención Inbound Activa:</strong> Cualquier llamada que entre a este número será contestada en tiempo real por tu agente de voz con el guión y personalidad que configuraste.
                  </span>
                </div>
              </div>
            ) : (
              /* CASO B: EL TENANT NO TIENE NÚMERO ASIGNADO AÚN */
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    <Zap className="w-3 h-3" />
                    Aprovisionamiento Instantáneo SaaS
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Asigna una Línea Telefónica Exclusiva a tu Agente
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Tu agente podrá atender clientes las 24 horas del día. Puedes vincularlo a tu número de empresa actual (Claro, Movistar, CNT, etc.) mediante desvío de llamadas en segundos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPhoneModalOpen(true);
                    if (phoneSearchResults.length === 0) {
                      handleSearchPhoneNumbers('EC', '');
                    }
                  }}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap self-start md:self-auto"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  Obtener mi Número Telefónico
                </button>
              </div>
            )}

            {/* SECCIÓN COLAPSABLE: CONFIGURACIÓN AVANZADA / BYOK (TRAE TU PROPIO TWILIO) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowManualTwilio(!showManualTwilio)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5" />
                  Configuración Avanzada: Conectar cuenta propia de Twilio (BYOK)
                </span>
                {showManualTwilio ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showManualTwilio && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-3 space-y-4"
                  >
                    <p className="text-xs text-slate-500">
                      Si eres una agencia o empresa con conmutador propio y deseas facturar el tráfico directamente a tu cuenta de Twilio, ingresa tus credenciales maestras aquí:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Twilio Account SID
                        </label>
                        <input
                          type="text"
                          value={settings.twilio_account_sid || ''}
                          onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Twilio Auth Token
                        </label>
                        <input
                          type="password"
                          value={settings.twilio_auth_token || ''}
                          onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                          placeholder={settings.has_custom_twilio_token ? '••••••••••••••••••••' : 'Tu Auth Token secreto'}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Número Telefónico Manual
                        </label>
                        <input
                          type="text"
                          value={settings.twilio_phone_number || ''}
                          onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                          placeholder="+1234567890"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        {saving ? 'Guardando...' : 'Guardar Credenciales Propias'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* MODAL: SELECCIÓN Y ACTIVACIÓN DE NÚMERO TELEFÓNICO SAAS */}
          <AnimatePresence>
            {phoneModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Phone className="w-5 h-5 text-emerald-500" />
                        Selecciona tu Línea Telefónica Exclusiva
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Elige el país y prefijo de tu preferencia para aprovisionar tu número en segundos.
                      </p>
                    </div>
                    <button
                      onClick={() => setPhoneModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Filtros de búsqueda */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        País de la Línea
                      </label>
                      <select
                        value={phoneSearchCountry}
                        onChange={(e) => {
                          const newCountry = e.target.value;
                          setPhoneSearchCountry(newCountry);
                          setPhoneSearchAreaCode('');
                          handleSearchPhoneNumbers(newCountry, '');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
                      >
                        <option value="EC">🇪🇨 Ecuador (+593)</option>
                        <option value="CO">🇨🇴 Colombia (+57)</option>
                        <option value="MX">🇲🇽 México (+52)</option>
                        <option value="PE">🇵🇪 Perú (+51)</option>
                        <option value="CL">🇨🇱 Chile (+56)</option>
                        <option value="AR">🇦🇷 Argentina (+54)</option>
                        <option value="BR">🇧🇷 Brasil (+55)</option>
                        <option value="PA">🇵🇦 Panamá (+507)</option>
                        <option value="PR">🇵🇷 Puerto Rico (+1)</option>
                        <option value="CR">🇨🇷 Costa Rica (+506)</option>
                        <option value="DO">🇩🇴 Rep. Dominicana (+1)</option>
                        <option value="GT">🇬🇹 Guatemala (+502)</option>
                        <option value="SV">🇸🇻 El Salvador (+503)</option>
                        <option value="HN">🇭🇳 Honduras (+504)</option>
                        <option value="BO">🇧🇴 Bolivia (+591)</option>
                        <option value="PY">🇵🇾 Paraguay (+595)</option>
                        <option value="UY">🇺🇾 Uruguay (+598)</option>
                        <option value="VE">🇻🇪 Venezuela (+58)</option>
                        <option value="US">🇺🇸 Estados Unidos (+1)</option>
                        <option value="CA">🇨🇦 Canadá (+1)</option>
                        <option value="ES">🇪🇸 España (+34)</option>
                        <option value="GB">🇬🇧 Reino Unido (+44)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Código de Área (Opcional)
                      </label>
                      <input
                        type="text"
                        value={phoneSearchAreaCode}
                        onChange={(e) => setPhoneSearchAreaCode(e.target.value)}
                        placeholder={
                          phoneSearchCountry === 'EC'
                            ? 'Ej. 2 (Quito), 4 (Gye)'
                            : phoneSearchCountry === 'MX'
                            ? 'Ej. 55, 33, 81'
                            : phoneSearchCountry === 'CO'
                            ? 'Ej. 601, 604'
                            : 'Opcional (Ej. 305)'
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">En blanco buscará en todo el país.</p>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleSearchPhoneNumbers(phoneSearchCountry, phoneSearchAreaCode)}
                        disabled={searchingNumbers}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${searchingNumbers ? 'animate-spin' : ''}`} />
                        {searchingNumbers ? 'Buscando...' : 'Buscar Líneas'}
                      </button>
                    </div>
                  </div>

                  {/* Resultados de números disponibles */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Líneas Disponibles para Activación Inmediata
                    </span>

                    {searchingNumbers ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                        <span className="text-xs font-medium">Buscando números disponibles en el operador...</span>
                      </div>
                    ) : phoneSearchResults.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 space-y-1">
                        <p className="font-semibold">No hay números cargados actualmente.</p>
                        <p>Haz clic en "Buscar Líneas" para consultar el inventario disponible.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                        {phoneSearchResults.map((num, i) => (
                          <div
                            key={i}
                            className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-emerald-500 transition-all shadow-sm"
                          >
                            <div className="space-y-1">
                              <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                                {num.friendlyName || num.phoneNumber}
                              </span>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-slate-400" />
                                <span>{[num.locality, num.region, num.isoCountry].filter(Boolean).join(', ') || 'Línea Nacional'}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleProvisionNumber(num.phoneNumber)}
                              disabled={provisioningNumber}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                            >
                              <Zap className="w-3 h-3 fill-white" />
                              {provisioningNumber ? 'Activando...' : 'Activar esta Línea'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPhoneModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* MODAL: INSTRUCCIONES DE DESVÍO DE LLAMADAS (CALL FORWARDING) */}
          <AnimatePresence>
            {callForwardingModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-blue-500" />
                        ¿Cómo recibir llamadas de tu número actual?
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No necesitas cambiar tu número de empresa de siempre. Usa el desvío de llamadas estándar.
                      </p>
                    </div>
                    <button
                      onClick={() => setCallForwardingModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 rounded-2xl p-4 space-y-1.5">
                      <h5 className="font-bold text-blue-900 dark:text-blue-300">
                        ¿Cómo funciona el desvío?
                      </h5>
                      <p className="leading-relaxed">
                        Tus clientes siguen llamando a tu número celular o conmutador de siempre (Claro, Movistar, CNT, Tigo, Telcel, etc.). Cuando tú no puedas contestar, la llamada se transfiere automáticamente a tu Agente de Voz de RIFX en menos de 2 segundos.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        Códigos de Marcación Rápida desde tu Celular:
                      </h5>

                      {/* Opción 1 */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          1. Desvío si no contestas o estás ocupado (Recomendado)
                        </span>
                        <p className="text-slate-500 text-[11px]">
                          Tu teléfono suena; si no contestas, el agente atiende para no perder la venta.
                        </p>
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 pt-1 text-sm">
                          *61*{settings.twilio_phone_number || '+TUNUMERO'}#
                        </div>
                      </div>

                      {/* Opción 2 */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          2. Desvío total 24/7 (Modo Piloto Automático)
                        </span>
                        <p className="text-slate-500 text-[11px]">
                          Todas las llamadas van directamente a la IA las 24 horas.
                        </p>
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 pt-1 text-sm">
                          *21*{settings.twilio_phone_number || '+TUNUMERO'}#
                        </div>
                      </div>

                      {/* Cancelar */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          3. Para desactivar el desvío en cualquier momento
                        </span>
                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300 pt-1 text-sm">
                          #21# o #61#
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCallForwardingModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      Entendido
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Historial de Llamadas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                Historial de Llamadas Telefónicas
              </h3>
              <button
                onClick={fetchData}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Dirección</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Duración</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Créditos</th>
                    <th className="py-3 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {callLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No hay llamadas registradas todavía. Realiza una llamada de prueba para ver el historial.
                      </td>
                    </tr>
                  ) : (
                    callLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.direction === 'inbound'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            }`}
                          >
                            {log.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">
                          {log.direction === 'inbound' ? log.from_number : log.to_number}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {log.duration_seconds > 0 ? `${log.duration_seconds}s` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                              log.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {log.credits_deducted ? `-${log.credits_deducted} min` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(log.created_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
