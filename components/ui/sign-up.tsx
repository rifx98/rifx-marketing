'use client';

import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback, Children } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, Mail, Lock, Eye, EyeOff, ArrowLeft, X, AlertCircle, PartyPopper, Loader, Briefcase } from "lucide-react";
import { AnimatePresence, motion, useInView, Variants, Transition } from "framer-motion";

import type { GlobalOptions as ConfettiGlobalOptions, CreateTypes as ConfettiInstance, Options as ConfettiOptions } from "canvas-confetti";
import confetti from "canvas-confetti";

// --- CONFETTI ---
type Api = { fire: (options?: ConfettiOptions) => void };
export type ConfettiRef = Api | null;

const Confetti = forwardRef<ConfettiRef, React.ComponentPropsWithRef<"canvas"> & { options?: ConfettiOptions; globalOptions?: ConfettiGlobalOptions; manualstart?: boolean }>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);
  const canvasRef = useCallback((node: HTMLCanvasElement) => {
    if (node !== null) {
      if (instanceRef.current) return;
      instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
    } else {
      if (instanceRef.current) { instanceRef.current.reset(); instanceRef.current = null; }
    }
  }, [globalOptions]);
  const fire = useCallback((opts = {}) => instanceRef.current?.({ ...options, ...opts }), [options]);
  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => { if (!manualstart) fire(); }, [manualstart, fire]);
  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = "Confetti";

// --- TEXT LOOP ---
type TextLoopProps = { children: React.ReactNode[]; className?: string; interval?: number; transition?: Transition; variants?: Variants; onIndexChange?: (index: number) => void; stopOnEnd?: boolean; };
export function TextLoop({ children, className, interval = 2, transition = { duration: 0.3 }, variants, onIndexChange, stopOnEnd = false }: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);
  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        if (stopOnEnd && current === items.length - 1) { clearInterval(timer); return current; }
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, stopOnEnd]);
  const motionVariants: Variants = { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 } };
  return (
    <div className={cn('relative inline-block whitespace-nowrap', className)}>
      <AnimatePresence mode='popLayout' initial={false}>
        <motion.div key={currentIndex} initial='initial' animate='animate' exit='exit' transition={transition} variants={variants || motionVariants}>
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- BLUR FADE ---
interface BlurFadeProps { children: React.ReactNode; className?: string; variant?: { hidden: { y: number }; visible: { y: number } }; duration?: number; delay?: number; yOffset?: number; inView?: boolean; blur?: string; }
function BlurFade({ children, className, variant, duration = 0.4, delay = 0, yOffset = 6, inView = true, blur = "6px" }: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  return (
    <motion.div ref={ref} initial="hidden" animate={isInView ? "visible" : "hidden"} exit="hidden" variants={variant || defaultVariants} transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

// --- GLASS BUTTON ---
const glassButtonVariants = cva("relative isolate all-unset cursor-pointer rounded-full transition-all", { variants: { size: { default: "text-base font-medium", sm: "text-sm font-medium", lg: "text-lg font-medium", icon: "h-10 w-10" } }, defaultVariants: { size: "default" } });
const glassButtonTextVariants = cva("glass-button-text relative block select-none tracking-tighter", { variants: { size: { default: "px-6 py-3.5", sm: "px-4 py-2", lg: "px-8 py-4", icon: "flex h-10 w-10 items-center justify-center" } }, defaultVariants: { size: "default" } });
export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof glassButtonVariants> { contentClassName?: string; }
const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(({ className, children, size, contentClassName, onClick, ...props }, ref) => {
  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const button = e.currentTarget.querySelector('button');
    if (button && e.target !== button) button.click();
  };
  return (
    <div className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)} onClick={handleWrapperClick}>
      <button className={cn("glass-button relative z-10", glassButtonVariants({ size }))} ref={ref} onClick={onClick} {...props}>
        <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
      </button>
      <div className="glass-button-shadow rounded-full pointer-events-none"></div>
    </div>
  );
});
GlassButton.displayName = "GlassButton";

// --- GRADIENT BACKGROUND ---
const GradientBackground = () => (
  <>
    <style>{`
      @keyframes su-float1 { 0%{transform:translate(0,0)} 50%{transform:translate(-10px,10px)} 100%{transform:translate(0,0)} }
      @keyframes su-float2 { 0%{transform:translate(0,0)} 50%{transform:translate(10px,-10px)} 100%{transform:translate(0,0)} }
    `}</style>
    <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="absolute top-0 left-0 w-full h-full">
      <defs>
        <linearGradient id="su_g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4a6cf7" stopOpacity="0.8"/><stop offset="100%" stopColor="#7c3aed" stopOpacity="0.6"/></linearGradient>
        <linearGradient id="su_g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9"/><stop offset="50%" stopColor="#3b82f6" stopOpacity="0.7"/><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6"/></linearGradient>
        <radialGradient id="su_g3" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ff0080" stopOpacity="0.5"/><stop offset="100%" stopColor="#7c3aed" stopOpacity="0.2"/></radialGradient>
        <filter id="su_b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="35"/></filter>
        <filter id="su_b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="25"/></filter>
        <filter id="su_b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45"/></filter>
      </defs>
      <rect width="800" height="600" fill="#060918"/>
      <g style={{ animation: 'su-float1 20s ease-in-out infinite' }}>
        <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#su_g1)" filter="url(#su_b1)" transform="rotate(-30 200 500)"/>
        <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#su_g2)" filter="url(#su_b2)" transform="rotate(15 650 225)"/>
      </g>
      <g style={{ animation: 'su-float2 25s ease-in-out infinite' }}>
        <circle cx="650" cy="450" r="150" fill="url(#su_g3)" filter="url(#su_b3)" opacity="0.7"/>
        <ellipse cx="50" cy="150" rx="180" ry="120" fill="#4a6cf7" filter="url(#su_b2)" opacity="0.35"/>
      </g>
    </svg>
  </>
);

// --- GOOGLE ICON ---
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-5 h-5">
    <g fillRule="evenodd" fill="none"><g fillRule="nonzero" transform="translate(3,2)">
      <path fill="#4285F4" d="M57.812,30.151C57.812,27.726 57.615,25.956 57.189,24.121L29.496,24.121L29.496,35.067L45.751,35.067C45.423,37.787 43.654,41.884 39.721,44.637L48.422,51.787C54.6,46.702 57.812,39.131 57.812,30.151"/>
      <path fill="#34A853" d="M29.496,58.992C37.459,58.992 44.145,56.37 49.029,51.847L39.721,44.637C37.23,46.374 33.887,47.586 29.496,47.586C21.696,47.586 15.075,42.441 12.715,35.329L3.265,42.405C7.996,52.371 17.959,58.992 29.496,58.992"/>
      <path fill="#FBBC05" d="M12.715,35.329C12.093,33.494 11.732,31.527 11.732,29.496C11.732,27.464 12.093,25.497 12.683,23.662L3.447,16.112C1.147,20.253 0,24.743 0,29.496C0,34.248 1.147,38.738 3.146,42.736L12.715,35.329"/>
      <path fill="#EB4335" d="M29.496,11.405C35.034,11.405 38.77,13.797 40.901,15.796L49.225,7.668C44.113,2.916 37.459,0 29.496,0C17.959,0 7.996,6.62 3.146,16.255L12.683,23.662C15.075,16.55 21.696,11.405 29.496,11.405"/>
    </g></g>
  </svg>
);

// --- MODAL STEPS ---
const registerSteps = [
  { message: "Registrando cuenta...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
  { message: "Configurando panel...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
  { message: "Finalizando...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
  { message: "¡Bienvenido!", icon: <PartyPopper className="w-12 h-12 text-green-400" /> },
];
const loginSteps = [
  { message: "Verificando credenciales...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
  { message: "Cargando tu panel...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
  { message: "¡Bienvenido de vuelta!", icon: <PartyPopper className="w-12 h-12 text-green-400" /> },
];
const TEXT_LOOP_INTERVAL = 1.4;

const DefaultLogo = () => (
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4a6cf7] to-[#9333ea] flex items-center justify-center">
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  </div>
);

// --- SHARED CSS ---
const sharedStyles = `
  .su-input[type="password"]::-ms-reveal,.su-input[type="password"]::-ms-clear{display:none!important}
  .su-input:-webkit-autofill,.su-input:-webkit-autofill:hover,.su-input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 30px transparent inset!important;-webkit-text-fill-color:#fff!important;transition:background-color 5000s ease-in-out 0s!important}
  @property --su-a1{syntax:"<angle>";inherits:false;initial-value:-75deg}
  @property --su-a2{syntax:"<angle>";inherits:false;initial-value:-45deg}
  .glass-button{-webkit-tap-highlight-color:transparent;backdrop-filter:blur(clamp(1px,.125em,4px));transition:all 400ms cubic-bezier(.25,1,.5,1);background:linear-gradient(-75deg,rgba(255,255,255,.04),rgba(255,255,255,.12),rgba(255,255,255,.04));box-shadow:inset 0 .125em .125em rgba(255,255,255,.05),inset 0 -.125em .125em rgba(0,0,0,.3),0 .25em .125em -.125em rgba(255,255,255,.1),0 0 .1em .25em inset rgba(0,0,0,.2)}
  .glass-button:hover{transform:scale(.975)}
  .glass-button-text{color:rgba(255,255,255,.9);text-shadow:0em .25em .05em rgba(0,0,0,.2);transition:all 400ms cubic-bezier(.25,1,.5,1)}
  .glass-button-text::after{content:"";display:block;position:absolute;width:calc(100% - 1px);height:calc(100% - 1px);top:.5px;left:.5px;box-sizing:border-box;border-radius:9999px;overflow:clip;background:linear-gradient(var(--su-a2),transparent 0%,rgba(255,255,255,.3) 40% 50%,transparent 55%);z-index:3;mix-blend-mode:screen;pointer-events:none;background-size:200% 200%;background-position:0% 50%;transition:background-position 500ms cubic-bezier(.25,1,.5,1),--su-a2 500ms cubic-bezier(.25,1,.5,1)}
  .glass-button:hover .glass-button-text::after{background-position:25% 50%}
  .glass-button::after{content:"";position:absolute;z-index:1;inset:0;border-radius:9999px;width:calc(100% + 1px);height:calc(100% + 1px);top:-.5px;left:-.5px;padding:1px;box-sizing:border-box;background:conic-gradient(from var(--su-a1) at 50% 50%,rgba(255,255,255,.4) 0%,transparent 5% 40%,rgba(255,255,255,.4) 50%,transparent 60% 95%,rgba(255,255,255,.4) 100%),linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.25));mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;transition:all 400ms cubic-bezier(.25,1,.5,1),--su-a1 500ms ease;pointer-events:none}
  .glass-button:hover::after{--su-a1:-125deg}
  .glass-button-wrap{position:relative;z-index:2}
  .glass-button-shadow{position:absolute;width:calc(100% + 2em);height:calc(100% + 2em);top:-1em;left:-1em;filter:blur(6px);pointer-events:none;z-index:0}
  .su-gi-wrap{position:relative;z-index:2;border-radius:9999px}
  .su-gi{display:flex;position:relative;width:100%;align-items:center;gap:.5rem;border-radius:9999px;padding:.25rem;backdrop-filter:blur(2px);transition:all 400ms cubic-bezier(.25,1,.5,1);background:linear-gradient(-75deg,rgba(255,255,255,.03),rgba(255,255,255,.1),rgba(255,255,255,.03));box-shadow:inset 0 .125em .125em rgba(255,255,255,.05),inset 0 -.125em .125em rgba(0,0,0,.3),0 .25em .125em -.125em rgba(255,255,255,.1),0 0 .1em .25em inset rgba(0,0,0,.2)}
  .su-gi-wrap:focus-within .su-gi{box-shadow:inset 0 .125em .125em rgba(255,255,255,.05),inset 0 -.125em .125em rgba(0,0,0,.3),0 .15em .05em -.1em rgba(74,108,247,.4),0 0 .05em .1em inset rgba(0,0,0,.3)}
  .su-gi::after{content:"";position:absolute;z-index:1;inset:0;border-radius:9999px;width:calc(100% + 1px);height:calc(100% + 1px);top:-.5px;left:-.5px;padding:1px;box-sizing:border-box;background:conic-gradient(from var(--su-a1) at 50% 50%,rgba(255,255,255,.3) 0%,transparent 5% 40%,rgba(255,255,255,.3) 50%,transparent 60% 95%,rgba(255,255,255,.3) 100%),linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.1));mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;transition:all 400ms cubic-bezier(.25,1,.5,1),--su-a1 500ms ease;pointer-events:none}
  .su-gi-wrap:focus-within .su-gi::after{--su-a1:-125deg}
  .su-gi-shine{position:absolute;inset:0;border-radius:9999px;pointer-events:none}
  .su-gi-shine::after{content:"";display:block;position:absolute;width:calc(100% - 1px);height:calc(100% - 1px);top:.5px;left:.5px;box-sizing:border-box;border-radius:9999px;overflow:clip;background:linear-gradient(var(--su-a2),transparent 0%,rgba(255,255,255,.12) 40% 50%,transparent 55%);z-index:3;mix-blend-mode:screen;pointer-events:none;background-size:200% 200%;background-position:0% 50%;transition:background-position 500ms cubic-bezier(.25,1,.5,1),--su-a2 500ms cubic-bezier(.25,1,.5,1)}
  .su-gi-wrap:focus-within .su-gi-shine::after{background-position:25% 50%}
`;

// --- MAIN COMPONENT ---
interface AuthComponentProps {
  mode?: 'login' | 'register' | 'request-reset' | 'reset-password';
  logo?: React.ReactNode;
  brandName?: string;
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string, acceptedTerms: boolean, companyName: string) => Promise<void>;
  onRequestReset?: (email: string) => Promise<any>;
  onResetPassword?: (email: string, code: string, password: string) => Promise<void>;
  onSwitchToRegister?: () => void;
  onSwitchToLogin?: () => void;
  externalError?: string;
  onGoogleClick?: () => void;
  googleInitNode?: React.ReactNode;
  onStepChange?: (step: string) => void;
  showResetPrompt?: boolean;
  onResetPromptClick?: () => void;
}

export const AuthComponent = ({
  mode = 'register',
  logo = <DefaultLogo />,
  brandName = "RIFX",
  onLogin,
  onRegister,
  onRequestReset,
  onResetPassword,
  onSwitchToRegister,
  onSwitchToLogin,
  externalError,
  onGoogleClick,
  googleInitNode,
  onStepChange,
  showResetPrompt,
  onResetPromptClick,
}: AuthComponentProps) => {
  const isLogin = mode === 'login';
  const isRequestReset = mode === 'request-reset';
  const isResetPassword = mode === 'reset-password';
  
  const resetSteps = [
    { message: "Enviando código...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
    { message: "¡Código enviado!", icon: <PartyPopper className="w-12 h-12 text-green-400" /> },
  ];
  const newPasswordSteps = [
    { message: "Actualizando contraseña...", icon: <Loader className="w-12 h-12 text-[#4a6cf7] animate-spin" /> },
    { message: "¡Contraseña actualizada!", icon: <PartyPopper className="w-12 h-12 text-green-400" /> },
  ];
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [authStep, setAuthStep] = useState(isResetPassword ? "password" : "email"); // email | company | password | confirmPassword | verifyCode
  const [verifyCode, setVerifyCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(60);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [modalStatus, setModalStatus] = useState<'closed' | 'loading' | 'error' | 'success'>('closed');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [resetCodeVerified, setResetCodeVerified] = useState(false); // true once OTP is verified for reset
  
  // For request-reset mode, once we're past verifyCode we use the newPasswordSteps
  const isInResetPasswordPhase = isRequestReset && (authStep === 'password' || authStep === 'confirmPassword');
  const modalSteps = isLogin ? loginSteps : (isRequestReset && !isInResetPasswordPhase) ? resetSteps : (isResetPassword || isInResetPasswordPhase) ? newPasswordSteps : registerSteps;

  const confettiRef = useRef<ConfettiRef>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setAuthStep(isResetPassword ? "password" : "email");
    setResendCountdown(60);
  }, [mode]);

  useEffect(() => {
    if (authStep === 'verifyCode' && resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [authStep, resendCountdown]);

  const validateEmail = (val: string) => /\S+@\S+\.\S+/.test(val);
  useEffect(() => {
    setIsEmailValid(validateEmail(email));
  }, [email]);

  const isPasswordValid = isLogin ? password.length > 0 : password.length >= 12;
  const isConfirmPasswordValid = confirmPassword.length >= 12;
  const isCompanyNameValid = companyName.trim().length >= 2;

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (!fire) return;
    const def = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    fire({ ...def, particleCount: 50, origin: { x: 0, y: 1 }, angle: 60 });
    fire({ ...def, particleCount: 50, origin: { x: 1, y: 1 }, angle: 120 });
  };

  useEffect(() => {
    if (externalError) { setModalErrorMessage(externalError); setModalStatus('error'); }
  }, [externalError]);

  useEffect(() => {
    if (onStepChange) onStepChange(authStep);
  }, [authStep, onStepChange]);

  const runWithLoadingSteps = async (action: () => Promise<void>) => {
    setModalStatus('loading');
    const totalDuration = (modalSteps.length - 1) * TEXT_LOOP_INTERVAL * 1000;
    try {
      await Promise.all([
        new Promise(r => setTimeout(r, totalDuration)),
        action(),
      ]);
      fireSideCanons();
      setModalStatus('success');
    } catch (err: any) {
      setModalErrorMessage(err?.message || 'Error. Intenta de nuevo.');
      setModalStatus('error');
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalStatus !== 'closed') return;

    if (isLogin) {
      if (authStep !== 'password' || !isPasswordValid) return;
      await runWithLoadingSteps(() => onLogin!(email, password));
    } else if (isRequestReset) {
      // Step 1: Email submitted → send OTP code
      if (authStep === 'email' && isEmailValid) {
        setModalStatus('loading');
        try {
          const result: any = await onRequestReset!(email);
          // Transition to verifyCode step
          setAuthStep('verifyCode');
          setResendCountdown(60);
          setModalStatus('closed');
        } catch (err: any) {
          setModalErrorMessage(err?.message || 'Error. Intenta de nuevo.');
          setModalStatus('error');
        }
        return;
      }
      // Step 2: Code verified → handled inside verifyCode block below
      // Step 3: New password confirmed → submit
      if (authStep === 'confirmPassword') {
        if (password !== confirmPassword) {
          setModalErrorMessage("Las contraseñas no coinciden.");
          setModalStatus('error');
          return;
        }
        await runWithLoadingSteps(() => onResetPassword!(email, verifyCode, password));
        return;
      }
    } else if (isResetPassword) {
      if (authStep !== 'confirmPassword' || !isPasswordValid || password !== confirmPassword) {
        if (password !== confirmPassword) {
          setModalErrorMessage("Las contraseñas no coinciden.");
          setModalStatus('error');
        }
        return;
      }
      await runWithLoadingSteps(() => onResetPassword!(email, verifyCode, password));
    } else {
      // If we are at confirmPassword, trigger register (which will send email OTP)
      if (authStep === 'confirmPassword') {
        if (password !== confirmPassword) {
          setModalErrorMessage("Las contraseñas no coinciden.");
          setModalStatus('error');
          return;
        }
        if (!acceptedTerms) {
          setModalErrorMessage("Debes aceptar el Aviso Legal y la Política de Privacidad para continuar.");
          setModalStatus('error');
          return;
        }
        
        if (onRegister) {
          setModalStatus('loading');
          try {
            const result: any = await onRegister(email, password, acceptedTerms, companyName);
            if (result?.pendingVerification) {
              setAuthStep('verifyCode');
              setResendCountdown(60);
              setModalStatus('closed');
            } else {
              // Standard success
              fireSideCanons();
              setModalStatus('success');
            }
          } catch (err: any) {
            setModalErrorMessage(err?.message || 'Error. Intenta de nuevo.');
            setModalStatus('error');
          }
        }
        return;
      }
      
      // If we are at verifyCode, submit the code (registration flow)
      if (authStep === 'verifyCode') {
        setModalStatus('loading');
        try {
          const res = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: verifyCode }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error verificando código');
          
          // Successful verification
          if (window.location.pathname === '/panel' || window.location.pathname === '/') {
             window.location.reload(); // Quick way to let panel-client re-fetch session
          }
          fireSideCanons();
          setModalStatus('success');
        } catch (err: any) {
          setModalErrorMessage(err?.message || 'Código incorrecto. Intenta de nuevo.');
          setModalStatus('error');
        }
        return;
      }
    }

    // Handle verifyCode for reset flow (isRequestReset) — verify code then go to password
    if (isRequestReset && authStep === 'verifyCode') {
      setModalStatus('loading');
      try {
        // We don't actually verify here — the code will be verified on final submit.
        // Just validate format and move to password step.
        if (!/^\d{6}$/.test(verifyCode.trim())) {
          throw new Error('El código debe ser de 6 dígitos');
        }
        setResetCodeVerified(true);
        setAuthStep('password');
        setModalStatus('closed');
      } catch (err: any) {
        setModalErrorMessage(err?.message || 'Código inválido.');
        setModalStatus('error');
      }
      return;
    }
  };

  const handleProgressStep = () => {
    if (authStep === 'email' && isEmailValid) {
      if (isLogin) {
        setAuthStep('password');
        setTimeout(() => passwordInputRef.current?.focus(), 100);
      } else if (isRequestReset) {
        formRef.current?.requestSubmit();
      } else {
        setAuthStep('company');
        setTimeout(() => companyInputRef.current?.focus(), 100);
      }
    } else if (authStep === 'company' && isCompanyNameValid) {
      setAuthStep('password');
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    } else if (authStep === 'password' && isPasswordValid) {
      if (isLogin) {
        formRef.current?.requestSubmit();
      } else {
        // For register, reset-password, AND request-reset (once code is verified)
        setAuthStep("confirmPassword");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleProgressStep(); }
  };

  const handleGoBack = () => {
    if (authStep === 'confirmPassword') { setAuthStep('password'); setConfirmPassword(''); }
    else if (authStep === 'password' && isRequestReset && resetCodeVerified) { setAuthStep('verifyCode'); }
    else if (authStep === 'password' && !isResetPassword) setAuthStep('email');
    else if (authStep === 'verifyCode' && isRequestReset) { setAuthStep('email'); setVerifyCode(''); setResetCodeVerified(false); }
    else if (authStep === 'company') setAuthStep('email');
  };

  const closeModal = () => { setModalStatus('closed'); setModalErrorMessage(''); };

  useEffect(() => {
    if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 500);
    else if (authStep === 'confirmPassword') setTimeout(() => confirmPasswordInputRef.current?.focus(), 500);
  }, [authStep]);

  const ModalUI = () => (
    <AnimatePresence>
      {modalStatus !== 'closed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative mx-4 w-full max-w-sm rounded-2xl border-2 border-white/10 bg-[#0d1128]/90 p-8 flex flex-col items-center gap-4">
            {(modalStatus === 'error' || modalStatus === 'success') && (
              <button onClick={closeModal} className="absolute top-3 right-3 p-1 text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            )}
            {modalStatus === 'error' && (
              <><AlertCircle className="w-12 h-12 text-red-400" /><p className="text-base font-medium text-white text-center">{modalErrorMessage}</p><GlassButton onClick={closeModal} size="sm" className="mt-2">Intentar de nuevo</GlassButton></>
            )}
            {modalStatus === 'loading' && (
              <TextLoop interval={TEXT_LOOP_INTERVAL} stopOnEnd>
                {modalSteps.slice(0, -1).map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-4">{s.icon}<p className="text-base font-medium text-white">{s.message}</p></div>
                ))}
              </TextLoop>
            )}
            {modalStatus === 'success' && (
              <div className="flex flex-col items-center gap-4">
                {modalSteps[modalSteps.length - 1].icon}
                <p className="text-base font-medium text-white">{modalSteps[modalSteps.length - 1].message}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: '#060918' }}>
      <style>{sharedStyles}</style>
      <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
      <ModalUI />

      {/* Header */}
      <div className="fixed top-4 left-4 z-20 flex items-center gap-2 md:left-1/2 md:-translate-x-1/2">
        {logo}
        <h1 className="text-base font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{brandName}</h1>
      </div>

      <div className="flex w-full flex-1 min-h-screen items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 z-0"><GradientBackground /></div>

        <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-8 w-[280px] mx-auto p-4">

          {/* --- HEADINGS --- */}
          <AnimatePresence mode="wait">
            {authStep === "email" && (
              <motion.div key="h-email" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full flex flex-col items-center gap-4">
                <BlurFade delay={0.2} className="w-full">
                  <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-white text-center">
                    {isLogin ? 'Bienvenido de vuelta' : isRequestReset ? 'Restablecer Acceso' : 'Crear cuenta'}
                  </p>
                </BlurFade>
                {!isRequestReset && <BlurFade delay={0.4}><p className="text-sm font-medium text-gray-400">Continuar con</p></BlurFade>}
                {!isRequestReset && (
                  <BlurFade delay={0.6} className="w-full flex justify-center">
                    {googleInitNode ? (
                      <div className="rounded-full overflow-hidden" style={{ height: 44 }}>
                        {googleInitNode}
                      </div>
                    ) : (
                      <GlassButton
                        type="button"
                        onClick={onGoogleClick}
                        contentClassName="flex items-center justify-center gap-2"
                        size="sm"
                      >
                        <GoogleIcon /><span className="font-semibold text-white">Google</span>
                      </GlassButton>
                    )}
                  </BlurFade>
                )}
                {!isLogin && (
                  <BlurFade delay={0.7} className="w-[280px] text-center">
                    <p className="text-[11px] leading-snug text-gray-500">
                      Al continuar con Google, aceptas nuestro{' '}
                      <a href="/terminos" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white hover:underline">Aviso Legal</a>
                      {' '}y{' '}
                      <a href="/politica-privacidad" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white hover:underline">Política de Privacidad</a>.
                    </p>
                  </BlurFade>
                )}
                {isRequestReset && authStep === 'email' && (
                  <BlurFade delay={0.4}>
                    <p className="text-sm font-medium text-gray-400 text-center max-w-[280px]">
                      Ingresa el correo asociado a tu cuenta y te enviaremos un código de verificación.
                    </p>
                  </BlurFade>
                )}
                {!isRequestReset && (
                  <BlurFade delay={0.8} className="w-[300px]">
                    <div className="flex items-center w-full gap-2 py-1">
                      <hr className="w-full border-white/10"/><span className="text-xs font-semibold text-gray-500">O</span><hr className="w-full border-white/10"/>
                    </div>
                  </BlurFade>
                )}
              </motion.div>
            )}
            {!isLogin && authStep === "company" && (
              <motion.div key="h-company" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full flex flex-col items-center text-center gap-4">
                <BlurFade delay={0} className="w-full">
                  <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-white">
                    Nombre del negocio
                  </p>
                </BlurFade>
                <BlurFade delay={0.2}>
                  <p className="text-sm font-medium text-gray-400">
                    ¿Cómo se llama tu empresa o negocio?
                  </p>
                </BlurFade>
              </motion.div>
            )}
            {authStep === "password" && (
              <motion.div key="h-pw" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full flex flex-col items-center text-center gap-4">
                <BlurFade delay={0} className="w-full">
                  <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-white">
                    {isLogin ? 'Ingresa tu contraseña' : (isResetPassword || isRequestReset) ? 'Nueva contraseña' : 'Crea tu contraseña'}
                  </p>
                </BlurFade>
                <BlurFade delay={0.2}>
                  <p className="text-sm font-medium text-gray-400">
                    {isLogin ? 'Tu contraseña de acceso.' : (isResetPassword || isRequestReset) ? 'Crea una contraseña segura. Mínimo 12 caracteres.' : 'Mínimo 12 caracteres.'}
                  </p>
                </BlurFade>
              </motion.div>
            )}
            {(isResetPassword || isRequestReset || !isLogin) && authStep === "confirmPassword" && (
              <motion.div key="h-cp" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full flex flex-col items-center text-center gap-4">
                <BlurFade delay={0} className="w-full"><p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-white">{(isResetPassword || isRequestReset) ? 'Confirmar' : 'Último paso'}</p></BlurFade>
                <BlurFade delay={0.2}><p className="text-sm font-medium text-gray-400">{(isResetPassword || isRequestReset) ? 'Repite tu nueva contraseña para confirmar.' : 'Confirma tu contraseña'}</p></BlurFade>
              </motion.div>
            )}
            {!isLogin && authStep === "verifyCode" && (
              <motion.div key="h-vc" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full flex flex-col items-center text-center gap-4">
                <BlurFade delay={0} className="w-full"><p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-white">Verifica tu email</p></BlurFade>
                <BlurFade delay={0.2}><p className="text-sm font-medium text-gray-400">Ingresa el código de 6 dígitos enviado a <br/><span className="text-white font-bold">{email}</span></p></BlurFade>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- FORM --- */}
          <form ref={formRef} onSubmit={handleFinalSubmit} className="w-[300px] space-y-6">
            <AnimatePresence>
              {(isLogin ? authStep !== 'done' : isRequestReset ? (authStep === 'email' || authStep === 'password') : isResetPassword ? authStep !== 'confirmPassword' : authStep !== 'confirmPassword') && (
                <motion.div key="fields-main" exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.3 }} className="w-full space-y-6">

                  {/* Email input */}
                  <BlurFade delay={authStep === 'email' ? 1.0 : 0} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {authStep === "password" && (
                          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, delay: 0.4 }} className="absolute -top-6 left-4 z-10">
                            <label className="text-xs text-gray-500 font-semibold">Email</label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="su-gi-wrap w-full">
                        <div className="su-gi">
                          <span className="su-gi-shine"></span>
                          <div className={cn("relative z-10 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300", email.length > 20 && authStep === 'email' ? "w-0 px-0" : "w-10 pl-2")}>
                            <Mail className="h-5 w-5 text-white/60 flex-shrink-0" />
                          </div>
                          <input type="email" placeholder="Email" value={email}
                            onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown}
                            className={cn("su-input relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-white/40 focus:outline-none transition-[padding-right] duration-300 delay-300", isEmailValid && authStep === 'email' ? "pr-2" : "pr-0")}
                          />
                          <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300", isEmailValid && authStep === 'email' ? "w-10 pr-1" : "w-0")}>
                            <GlassButton type="button" onClick={handleProgressStep} size="icon" contentClassName="text-white/80"><ArrowRight className="w-5 h-5" /></GlassButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BlurFade>

                  {/* Company input */}
                  <AnimatePresence>
                    {authStep === "company" && (
                      <BlurFade key="company-field" className="w-full">
                        <div className="relative w-full">
                          <AnimatePresence>
                            {companyName.length > 0 && (
                              <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-6 left-4 z-10">
                                <label className="text-xs text-gray-500 font-semibold">Empresa</label>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="su-gi-wrap w-[300px]">
                            <div className="su-gi">
                              <span className="su-gi-shine"></span>
                              <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                <Briefcase className="h-5 w-5 text-white/60 flex-shrink-0" />
                              </div>
                              <input ref={companyInputRef} type="text" placeholder="Ej. Mi Tienda Online" value={companyName}
                                onChange={e => setCompanyName(e.target.value)} onKeyDown={handleKeyDown}
                                className="su-input relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                              />
                              <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300", isCompanyNameValid ? "w-10 pr-1" : "w-0")}>
                                <GlassButton type="button" onClick={handleProgressStep} size="icon" contentClassName="text-white/80"><ArrowRight className="w-5 h-5" /></GlassButton>
                              </div>
                            </div>
                          </div>
                        </div>
                        <BlurFade inView delay={0.2}>
                          <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Volver
                          </button>
                        </BlurFade>
                      </BlurFade>
                    )}
                  </AnimatePresence>

                  {/* Password input */}
                  <AnimatePresence>
                    {authStep === "password" && (
                      <BlurFade key="pw-field" className="w-full">
                        <div className="relative w-full">
                          <AnimatePresence>
                            {password.length > 0 && (
                              <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-6 left-4 z-10">
                                <label className="text-xs text-gray-500 font-semibold">Contraseña</label>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="su-gi-wrap w-full">
                            <div className="su-gi">
                              <span className="su-gi-shine"></span>
                              <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                {isPasswordValid
                                  ? <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/60 hover:text-white transition-colors p-2 rounded-full">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                                  : <Lock className="h-5 w-5 text-white/60 flex-shrink-0" />}
                              </div>
                              <input ref={passwordInputRef} type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password}
                                onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                                className="su-input relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                              />
                              <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300", isPasswordValid ? "w-10 pr-1" : "w-0")}>
                                {isLogin
                                  ? <GlassButton type="submit" size="icon" contentClassName="text-white/80"><ArrowRight className="w-5 h-5" /></GlassButton>
                                  : <GlassButton type="button" onClick={handleProgressStep} size="icon" contentClassName="text-white/80"><ArrowRight className="w-5 h-5" /></GlassButton>
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                        <BlurFade inView delay={0.2}>
                          <div className="mt-4 flex items-center justify-between">
                            <button type="button" onClick={handleGoBack} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                              <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            {isLogin && showResetPrompt && onResetPromptClick && (
                              <button type="button" onClick={onResetPromptClick} className="text-sm text-white/50 hover:text-[#4a6cf7] transition-colors">
                                Restablecer contraseña
                              </button>
                            )}
                          </div>
                        </BlurFade>
                      </BlurFade>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirm password (register, reset-password, or request-reset after code verified) */}
            {(!isLogin || isResetPassword || isRequestReset) && (
              <AnimatePresence>
                {authStep === 'confirmPassword' && (
                  <BlurFade key="cp-field" className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {confirmPassword.length > 0 && (
                          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-6 left-4 z-10">
                            <label className="text-xs text-gray-500 font-semibold">Confirmar contraseña</label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="su-gi-wrap w-[300px]">
                        <div className="su-gi">
                          <span className="su-gi-shine"></span>
                          <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                            {isConfirmPasswordValid
                              ? <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-white/60 hover:text-white transition-colors p-2 rounded-full">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                              : <Lock className="h-5 w-5 text-white/60 flex-shrink-0" />}
                          </div>
                          <input ref={confirmPasswordInputRef} type={showConfirmPassword ? "text" : "password"} placeholder="Confirmar contraseña" value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="su-input relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                          />
                          <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300", (isResetPassword || isRequestReset) ? (isConfirmPasswordValid ? "w-10 pr-1" : "w-0") : (isConfirmPasswordValid && acceptedTerms ? "w-10 pr-1" : "w-0"))}>
                            <GlassButton type="submit" size="icon" contentClassName="text-white/80" disabled={(isResetPassword || isRequestReset) ? false : !acceptedTerms}><ArrowRight className="w-5 h-5" /></GlassButton>
                          </div>
                        </div>
                      </div>
                    </div>
                    {!isResetPassword && !isRequestReset && (
                      <BlurFade inView delay={0.1}>
                        <label className="mt-4 flex items-start gap-2 text-left cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={e => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-transparent accent-[#4a6cf7]"
                          />
                          <span className="text-xs leading-snug text-gray-400">
                            Acepto el{' '}
                            <a href="/terminos" target="_blank" rel="noreferrer" className="text-[#8ea2ff] hover:underline">Aviso Legal</a>
                            {' '}y la{' '}
                            <a href="/politica-privacidad" target="_blank" rel="noreferrer" className="text-[#8ea2ff] hover:underline">Política de Privacidad</a>
                            {' '}de Rifx Marketing.
                          </span>
                        </label>
                      </BlurFade>
                    )}
                    <BlurFade inView delay={0.2}>
                      <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Volver
                      </button>
                    </BlurFade>
                  </BlurFade>
                )}
              </AnimatePresence>
            )}

            {/* Verify Code (register or request-reset) */}
            {!isLogin && (
              <AnimatePresence>
                {authStep === 'verifyCode' && (
                  <BlurFade key="vc-field" className="w-full">
                    <div className="relative w-full">
                      <div className="su-gi-wrap w-[300px]">
                        <div className="su-gi">
                          <span className="su-gi-shine"></span>
                          <input type="text" placeholder="000000" maxLength={6} value={verifyCode}
                            onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                            className="su-input relative z-10 h-full w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none text-center font-mono text-2xl tracking-[0.3em] py-2"
                          />
                        </div>
                      </div>
                    </div>
                    <BlurFade inView delay={0.1}>
                      <button type="submit" disabled={verifyCode.length !== 6} className={cn("mt-4 w-full py-3 rounded-full font-bold transition-all", verifyCode.length === 6 ? "bg-[#4a6cf7] text-white hover:bg-[#3955d8]" : "bg-white/10 text-white/50 cursor-not-allowed")}>
                        {isRequestReset ? 'Verificar y continuar' : 'Verificar código'}
                      </button>
                    </BlurFade>
                    <BlurFade inView delay={0.2}>
                      <button 
                        type="button" 
                        disabled={resendCountdown > 0}
                        onClick={async () => {
                          if (resendCountdown > 0) return;
                          if (isRequestReset && onRequestReset) {
                            setModalStatus('loading');
                            try {
                              await onRequestReset(email);
                            } catch { /* silently ignore resend errors */ }
                            setModalStatus('closed');
                            setModalErrorMessage('');
                          } else if (onRegister) {
                            onRegister(email, password, acceptedTerms, companyName);
                            setModalStatus('loading');
                            setTimeout(() => {
                              setModalStatus('closed');
                              setModalErrorMessage('');
                            }, 1000);
                          }
                          setResendCountdown(60);
                        }} 
                        className={cn(
                          "mt-4 w-full text-center text-xs transition-colors",
                          resendCountdown > 0 ? "text-gray-600 cursor-not-allowed" : "text-gray-400 hover:text-white"
                        )}
                      >
                        {resendCountdown > 0 ? `Reenviar código en ${resendCountdown}s` : 'Reenviar código'}
                      </button>
                    </BlurFade>
                  </BlurFade>
                )}
              </AnimatePresence>
            )}
          </form>

          {/* Switch link */}
          {authStep === 'email' && (
            <BlurFade delay={1.2} className="w-full text-center">
              {isLogin && onSwitchToRegister && (
                <button type="button" onClick={onSwitchToRegister} className="text-[11px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold">
                  ¿No tienes cuenta? <span className="text-[#4a6cf7]">Crear cuenta gratis</span>
                </button>
              )}
              {!isLogin && !isRequestReset && !isResetPassword && onSwitchToLogin && (
                <button type="button" onClick={onSwitchToLogin} className="text-[11px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold">
                  ¿Ya tienes cuenta? <span className="text-[#4a6cf7]">Iniciar sesión</span>
                </button>
              )}
              {(isRequestReset || isResetPassword) && onSwitchToLogin && (
                <button type="button" onClick={onSwitchToLogin} className="text-[11px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold">
                  Volver al <span className="text-[#4a6cf7]">Inicio de sesión</span>
                </button>
              )}
            </BlurFade>
          )}
        </fieldset>
      </div>
    </div>
  );
};
