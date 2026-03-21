import { useState } from 'react';
import { Shield, Lock, Eye, CheckCircle, ArrowRight, ArrowLeft, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (templateId: string | null) => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export function OnboardingWizard({ open, onClose, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templates = [
    {
      id: 'shopping',
      name: 'Shopping Assistant',
      description: 'AI agent that can make purchases with spending limits',
      features: ['$50 per transaction', 'Hide card number & CVV', 'Reveal shipping only'],
    },
    {
      id: 'travel',
      name: 'Travel Agent',
      description: 'Book flights and hotels with minimal data exposure',
      features: ['Hide passport number', 'Ephemeral persona', 'Time-limited access'],
    },
    {
      id: 'productivity',
      name: 'Productivity Assistant',
      description: 'Calendar and task management without email access',
      features: ['Calendar only', 'No email/docs', '50 disclosures/day'],
    },
    {
      id: 'custom',
      name: 'Custom Setup',
      description: 'Configure your own policies from scratch',
      features: ['Full control', 'Custom categories', 'Advanced options'],
    },
  ];

  const steps: OnboardingStep[] = [
    {
      title: 'Welcome to ShadowKey',
      description: 'Your zero-knowledge data vault for AI agents',
      icon: Shield,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            ShadowKey gives you complete control over what data AI agents can access.
            Your secrets are encrypted in the browser—servers never see plaintext.
          </p>
          <div className="grid gap-3">
            {[
              { icon: Lock, title: 'Encrypted Locally', desc: 'AES-256-GCM encryption in your browser' },
              { icon: Eye, title: 'Scoped Access', desc: 'Agents see only approved fields' },
              { icon: Zap, title: 'Instant Revoke', desc: 'Kill all access in one click' },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon size={16} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-0.5">{feature.title}</p>
                  <p className="text-xs text-slate-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'How It Works',
      description: 'Four simple steps to protect your data',
      icon: CheckCircle,
      content: (
        <div className="space-y-3">
          {[
            { step: '1', title: 'Store Secrets', desc: 'Add payment cards, passwords, identity data' },
            { step: '2', title: 'Create Policies', desc: 'Define what each agent can access' },
            { step: '3', title: 'Agent Requests', desc: 'AI asks for specific data fields' },
            { step: '4', title: 'Scoped Response', desc: 'Agent gets only approved data' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {item.step}
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-white mb-0.5">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Choose a Template',
      description: 'Start with a pre-configured setup or build your own',
      icon: Zap,
      content: (
        <div className="space-y-3">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedTemplate === template.id
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{template.name}</p>
                  <p className="text-xs text-slate-400">{template.description}</p>
                </div>
                {selectedTemplate === template.id && (
                  <CheckCircle size={18} className="text-cyan-400 flex-shrink-0" />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {template.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  function handleNext() {
    if (isLastStep) {
      onComplete(selectedTemplate);
      onClose();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                <currentStepData.icon size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{currentStepData.title}</h2>
                <p className="text-xs text-slate-500">{currentStepData.description}</p>
              </div>
            </div>
            <div className="text-xs text-slate-600">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>

          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i <= currentStep ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">{currentStepData.content}</div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? onClose : handleBack}
            size="sm"
          >
            {currentStep === 0 ? (
              'Skip'
            ) : (
              <>
                <ArrowLeft size={14} />
                Back
              </>
            )}
          </Button>
          <Button
            onClick={handleNext}
            disabled={isLastStep && !selectedTemplate}
            size="sm"
          >
            {isLastStep ? (
              'Get Started'
            ) : (
              <>
                Next
                <ArrowRight size={14} />
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
