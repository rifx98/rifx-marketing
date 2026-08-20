'use client';

import { useState } from 'react';
import { Mail, Phone, ArrowLeft } from 'lucide-react';
import { AuthComponent } from '@/components/ui/sign-up';
import PhoneAuthForm from '@/components/PhoneAuthForm';

interface AuthSelectorProps {
  mode: 'login' | 'register' | 'request-reset' | 'reset-password';
  logo?: React.ReactNode;
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string, acceptedTerms: boolean) => Promise<void>;
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

export default function AuthSelector(props: AuthSelectorProps) {
  return <AuthComponent {...props} />;
}
