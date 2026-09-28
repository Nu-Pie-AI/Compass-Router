'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AISolution,
  AdvisorQuestion,
  ExternalRecommendation,
  IntentResult,
  ScoredOffering,
} from '@/lib/ai-advisor/types';
import { Button } from '@/components/ui/Button';
import { RecommendationCards } from './RecommendationCards';
import { ExternalRecommendationCards } from './ExternalRecommendationCards';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  MessageSquare,
  Sparkles,
  User,
} from 'lucide-react';

type ChatMessage =
  | {
      id: string;
      role: 'assistant' | 'user';
      type: 'text';
      content: string;
    }
  | {
      id: string;
      role: 'assistant';
      type: 'question';
      question: AdvisorQuestion;
      answered?: boolean;
    }
  | {
      id: string;
      role: 'assistant';
      type: 'solution';
      solution: AISolution;
      categoryReasoning: string;
    }
  | {
      id: string;
      role: 'assistant';
      type: 'recommendation-prompt';
    }
  | {
      id: string;
      role: 'assistant';
      type: 'recommendations';
      recommendations: ScoredOffering[];
      aiSolution: AISolution | null;
    }
  | {
      id: string;
      role: 'assistant';
      type: 'external-recommendations';
      recommendations: ExternalRecommendation[];
    };

interface IntentResponse extends Omit<IntentResult, 'detectedCategory'> {
  detectedCategory: string | null;
  externalRecommendationsRequired?: boolean;
  message?: string;
  suggestions?: string[];
}

const STORAGE_KEY = 'ai-advisor-chat-session-v1';

interface PersistedAdvisorChatState {
  messages: ChatMessage[];
  composerValue: string;
  conversationId: string | null;
  intentResult: IntentResponse | null;
  currentQuestion: AdvisorQuestion | null;
  answers: Record<string, string>;
  aiSolution: AISolution | null;
  recommendations: ScoredOffering[] | null;
  externalRecommendations: ExternalRecommendation[] | null;
  chatEnabled: boolean;
}

function getInitialMessages(): ChatMessage[] {
  return [
    {
      id: createId(),
      role: 'assistant',
      type: 'text',
      content:
        "Tell me the business problem you're trying to solve. I will ask a few focused questions, give you an advisory solution, and then I can recommend tools if you want them.",
    },
  ];
}

function getRequestHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window === 'undefined') {
    return headers;
  }

  const locale =
    window.navigator.languages?.[0] || window.navigator.language || '';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  if (locale) {
    headers['x-user-locale'] = locale;
  }

  if (timeZone) {
    headers['x-user-timezone'] = timeZone;
  }

  return headers;
}

export function AdvisorChatExperience() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages());
  const [composerValue, setComposerValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [intentResult, setIntentResult] = useState<IntentResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AdvisorQuestion | null>(
    null
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aiSolution, setAiSolution] = useState<AISolution | null>(null);
  const [recommendations, setRecommendations] = useState<ScoredOffering[] | null>(
    null
  );
  const [externalRecommendations, setExternalRecommendations] = useState<
    ExternalRecommendation[] | null
  >(null);
  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Thinking...');
  const [chatEnabled, setChatEnabled] = useState(false);
  const [hasHydratedFromStorage, setHasHydratedFromStorage] = useState(false);

  const threadBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isBusy]);

  useEffect(() => {
    try {
      const rawState = window.sessionStorage.getItem(STORAGE_KEY);
      if (!rawState) {
        setHasHydratedFromStorage(true);
        return;
      }

      const parsedState = JSON.parse(rawState) as PersistedAdvisorChatState;

      setMessages(parsedState.messages || getInitialMessages());
      setComposerValue(parsedState.composerValue || '');
      setConversationId(parsedState.conversationId || null);
      setIntentResult(parsedState.intentResult || null);
      setCurrentQuestion(parsedState.currentQuestion || null);
      setAnswers(parsedState.answers || {});
      setAiSolution(parsedState.aiSolution || null);
      setRecommendations(parsedState.recommendations || null);
      setExternalRecommendations(parsedState.externalRecommendations || null);
      setChatEnabled(Boolean(parsedState.chatEnabled));
    } catch (error) {
      console.error('Failed to restore AI Advisor chat state:', error);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasHydratedFromStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedFromStorage) return;

    const persistedState: PersistedAdvisorChatState = {
      messages,
      composerValue,
      conversationId,
      intentResult,
      currentQuestion,
      answers,
      aiSolution,
      recommendations,
      externalRecommendations,
      chatEnabled,
    };

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [
    hasHydratedFromStorage,
    messages,
    composerValue,
    conversationId,
    intentResult,
    currentQuestion,
    answers,
    aiSolution,
    recommendations,
    externalRecommendations,
    chatEnabled,
  ]);

  const canUseComposerForFollowUp = Boolean(aiSolution && conversationId);

  const introHint = useMemo(() => {
    if (!conversationId) {
      return 'Describe the problem you want help with';
    }

    if (currentQuestion) {
      return 'Choose one of the options above to continue';
    }

    if (canUseComposerForFollowUp) {
      return 'Ask a follow-up question or refine the advice';
    }

    return 'Working through your request';
  }, [canUseComposerForFollowUp, conversationId, currentQuestion]);

  const handleComposerSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isBusy) return;

    const value = composerValue.trim();
    if (!value) return;

    if (!conversationId) {
      await startConversation(value);
      setComposerValue('');
      return;
    }

    if (currentQuestion) {
      return;
    }

    setComposerValue('');

    if (!recommendations && !externalRecommendations && isRecommendationRequest(value)) {
      appendMessage({ id: createId(), role: 'user', type: 'text', content: value });
      await fetchRecommendationsFlow();
      return;
    }

    appendMessage({ id: createId(), role: 'user', type: 'text', content: value });
    await sendFollowUpMessage(value);
  };

  const startConversation = async (problem: string) => {
    appendMessage({ id: createId(), role: 'user', type: 'text', content: problem });
    setBusyState(true, 'Understanding your problem...');

    try {
      const response = await fetch('/api/ai-advisor/intent', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ problem }),
      });

      const result = (await response.json()) as IntentResponse & {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to analyze intent');
      }

      setConversationId(result.conversationId);
      setIntentResult(result);

      const firstQuestion = result.questions?.[0] || null;
      if (firstQuestion) {
        setCurrentQuestion(firstQuestion);
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'text',
          content:
            "I have a direction. Let me ask a few quick questions so the advice is grounded in your situation.",
        });
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'question',
          question: firstQuestion,
        });
      } else {
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'text',
          content:
            result.message ||
            'I can already see the shape of the problem, so I am going straight to the advisory solution.',
        });
        await generateSolutionFlow(result, result.conversationId);
      }
    } catch (error) {
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content:
          error instanceof Error
            ? error.message
            : 'Something went wrong while starting the conversation.',
      });
    } finally {
      setBusyState(false);
    }
  };

  const handleQuestionAnswer = async (question: AdvisorQuestion, option: string) => {
    if (!conversationId || isBusy) return;

    const updatedAnswers = {
      ...answers,
      [question.id]: option,
    };

    setAnswers(updatedAnswers);
    setCurrentQuestion(null);
    appendMessage({ id: createId(), role: 'user', type: 'text', content: option });
    markQuestionAnswered(question.id);
    setBusyState(true, 'Building context...');

    try {
      const response = await fetch('/api/ai-advisor/clarify', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          conversationId,
          latestAnswer: {
            questionId: question.id,
            answer: option,
          },
        }),
      });

      const result = (await response.json()) as {
        shouldContinue?: boolean;
        nextQuestions?: AdvisorQuestion[];
        questionsAsked?: number;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to process answer');
      }

      const nextQuestions = result.nextQuestions || [];
      const shouldAskAnother =
        Boolean(result.shouldContinue) && nextQuestions.length > 0;

      if (shouldAskAnother) {
        const nextQuestion = nextQuestions[0];
        setCurrentQuestion(nextQuestion);
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'question',
          question: nextQuestion,
        });
      } else {
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'text',
          content:
            "That gives me enough context. I am putting together the advisory solution now.",
        });
        await generateSolutionFlow(intentResult);
      }
    } catch (error) {
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content:
          error instanceof Error
            ? error.message
            : 'Something went wrong while processing that answer.',
      });
    } finally {
      setBusyState(false);
    }
  };

  const generateSolutionFlow = async (
    intentContext: IntentResponse | null,
    targetConversationId?: string
  ) => {
    const activeConversationId = targetConversationId || conversationId;

    if (!activeConversationId || !intentContext) return;

    setBusyState(true, 'Drafting your advisory solution...');

    try {
      const response = await fetch('/api/ai-advisor/generate-solution', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ conversationId: activeConversationId }),
      });

      const result = (await response.json()) as {
        solution?: AISolution;
        error?: string;
        message?: string;
      };

      if (!response.ok || !result.solution) {
        throw new Error(result.message || result.error || 'Failed to generate solution');
      }

      setAiSolution(result.solution);
      setChatEnabled(true);

      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'solution',
        solution: result.solution,
        categoryReasoning: buildCategoryReasoning(intentContext, answers),
      });
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'recommendation-prompt',
      });
    } catch (error) {
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content:
          error instanceof Error
            ? error.message
            : 'Something went wrong while generating the solution.',
      });
    } finally {
      setBusyState(false);
    }
  };

  const fetchRecommendationsFlow = async () => {
    if (!conversationId || isBusy) return;

    setBusyState(true, 'Matching tools to the solution...');

    try {
      const response = await fetch('/api/ai-advisor/recommend', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          conversationId,
          answers,
        }),
      });

      const result = (await response.json()) as {
        recommendations?: ScoredOffering[];
        externalRecommendations?: ExternalRecommendation[];
        type?: 'external';
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to fetch recommendations');
      }

      if (result.type === 'external' && result.externalRecommendations) {
        setExternalRecommendations(result.externalRecommendations);
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'text',
          content:
            result.message ||
            "We do not have a strong marketplace match yet, so I pulled together external options for you.",
        });
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'external-recommendations',
          recommendations: result.externalRecommendations,
        });
      } else if (result.recommendations && result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'text',
          content:
            'Here are the tools that best fit the solution and the context you gave me.',
        });
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'recommendations',
          recommendations: result.recommendations,
          aiSolution,
        });
      } else {
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'text',
          content:
            'I could not find a strong tool match just yet, but we can still talk through tradeoffs and next steps together.',
        });
      }

      setChatEnabled(true);
      setCurrentQuestion(null);
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content:
          'If you want, ask me about tradeoffs, cheaper options, rollout order, or which recommendation fits your team best.',
      });
    } catch (error) {
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading recommendations.',
      });
    } finally {
      setBusyState(false);
    }
  };

  const sendFollowUpMessage = async (message: string) => {
    if (!conversationId) return;

    setBusyState(true, 'Thinking through that...');

    try {
      const response = await fetch('/api/ai-advisor/chat', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const result = (await response.json()) as {
        reply?: string;
        recommendations?: ScoredOffering[];
        externalRecommendations?: ExternalRecommendation[];
        error?: string;
        message?: string;
      };

      if (!response.ok || !result.reply) {
        throw new Error(result.message || result.error || 'Failed to continue the chat');
      }

      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content: result.reply,
      });

      if (result.recommendations && result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
        setExternalRecommendations(null);
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'recommendations',
          recommendations: result.recommendations,
          aiSolution,
        });
      }

      if (
        result.externalRecommendations &&
        result.externalRecommendations.length > 0
      ) {
        setExternalRecommendations(result.externalRecommendations);
        setRecommendations(null);
        appendMessage({
          id: createId(),
          role: 'assistant',
          type: 'external-recommendations',
          recommendations: result.externalRecommendations,
        });
      }
    } catch (error) {
      appendMessage({
        id: createId(),
        role: 'assistant',
        type: 'text',
        content:
          error instanceof Error
            ? error.message
            : 'Something went wrong while continuing the chat.',
      });
    } finally {
      setBusyState(false);
    }
  };

  const handleSkipRecommendations = () => {
    appendMessage({
      id: createId(),
      role: 'user',
      type: 'text',
      content: 'Not yet. Keep helping me with the plan first.',
    });
    appendMessage({
      id: createId(),
      role: 'assistant',
      type: 'text',
      content:
        'Absolutely. Ask me anything about the solution, rollout order, budget tradeoffs, or how to adapt it to your team.',
    });
    setChatEnabled(true);
  };

  const handleStartOver = () => {
    setMessages(getInitialMessages());
    setComposerValue('');
    setConversationId(null);
    setIntentResult(null);
    setCurrentQuestion(null);
    setAnswers({});
    setAiSolution(null);
    setRecommendations(null);
    setExternalRecommendations(null);
    setIsBusy(false);
    setBusyLabel('Thinking...');
    setChatEnabled(false);
    window.sessionStorage.removeItem(STORAGE_KEY);
  };

  const appendMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message]);
  };

  const markQuestionAnswered = (questionId: string) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.type === 'question' && message.question.id === questionId) {
          return {
            ...message,
            answered: true,
          };
        }

        return message;
      })
    );
  };

  const setBusyState = (busy: boolean, label = 'Thinking...') => {
    setIsBusy(busy);
    setBusyLabel(label);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-ambient">
          <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                <Compass className="h-4 w-4 text-[var(--primary)]" />
                Conversational AI Advisor
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                Solve the problem first, then decide on tools.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
                Describe the business need, get focused advice, and only ask for
                tool recommendations when you want them.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(77,188,101,0.08),rgba(55,114,255,0.08))] p-3 sm:p-4 lg:max-w-[26rem]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                <Sparkles className="h-4 w-4" />
                What this chat does
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
              {[
                'Problem-led guidance',
                'Focused clarifying questions',
                'Recommendations on demand',
                'Context-aware follow-ups',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[var(--primary)]" />
                  <span className="text-xs font-medium leading-5 text-[var(--foreground)] sm:text-sm">
                    {item}
                  </span>
                </div>
              ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-ambient">
          <div className="border-b border-[var(--border)] px-6 py-4 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Chat Thread
                </h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Advisory-first flow with context kept in the conversation.
                </p>
              </div>
              <Button variant="ghost" onClick={handleStartOver}>
                Start Over
              </Button>
            </div>
          </div>

          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {messages.map((message) => (
              <MessageRenderer
                key={message.id}
                message={message}
                currentQuestionId={currentQuestion?.id}
                onAnswerQuestion={handleQuestionAnswer}
                onShowRecommendations={fetchRecommendationsFlow}
                onSkipRecommendations={handleSkipRecommendations}
                onStartOver={handleStartOver}
                isBusy={isBusy}
              />
            ))}

            {isBusy && (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="max-w-3xl rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {busyLabel}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={threadBottomRef} />
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-4 sm:px-6 lg:px-8">
            <form className="space-y-3" onSubmit={handleComposerSubmit}>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <textarea
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();

                      const canSubmit =
                        !isBusy &&
                        !currentQuestion &&
                        composerValue.trim().length >= 3 &&
                        (conversationId || composerValue.trim().length >= 10);

                      if (canSubmit) {
                        event.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  rows={3}
                  placeholder={introHint}
                  className="w-full resize-none border-0 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                  disabled={Boolean(currentQuestion) || isBusy}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <MessageSquare className="h-4 w-4 text-[var(--primary)]" />
                  {currentQuestion
                    ? 'Answer the current question to continue'
                    : chatEnabled
                      ? 'Follow-up chat stays grounded in the earlier context'
                      : 'The first message starts the advisory conversation'}
                </div>
                <Button
                  type="submit"
                  disabled={
                    isBusy ||
                    Boolean(currentQuestion) ||
                    composerValue.trim().length < 3 ||
                    (!conversationId && composerValue.trim().length < 10)
                  }
                  className="sm:min-w-[12rem]"
                >
                  {!conversationId ? 'Start Conversation' : 'Send Message'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function MessageRenderer({
  message,
  currentQuestionId,
  onAnswerQuestion,
  onShowRecommendations,
  onSkipRecommendations,
  onStartOver,
  isBusy,
}: {
  message: ChatMessage;
  currentQuestionId?: string;
  onAnswerQuestion: (question: AdvisorQuestion, option: string) => Promise<void>;
  onShowRecommendations: () => Promise<void>;
  onSkipRecommendations: () => void;
  onStartOver: () => void;
  isBusy: boolean;
}) {
  if (message.type === 'recommendations') {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
        <RecommendationCards
          recommendations={message.recommendations}
          aiSolution={message.aiSolution}
          onStartOver={onStartOver}
        />
      </div>
    );
  }

  if (message.type === 'external-recommendations') {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
        <ExternalRecommendationCards
          recommendations={message.recommendations}
          onStartOver={onStartOver}
        />
      </div>
    );
  }

  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`flex items-start gap-3 ${
        isAssistant ? '' : 'justify-end'
      }`}
    >
      {isAssistant && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        className={`max-w-3xl ${
          isAssistant
            ? 'rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--background)]'
            : 'rounded-2xl rounded-tr-md bg-[var(--primary-hover)] shadow-sm'
        } px-4 py-3`}
      >
        {message.type === 'text' && (
          <p
            className={`text-sm leading-7 ${
              isAssistant
                ? 'text-[var(--foreground)]'
                : '!text-white dark:!text-white'
            }`}
          >
            {message.content}
          </p>
        )}

        {message.type === 'question' && (
          <QuestionMessage
            message={message}
            currentQuestionId={currentQuestionId}
            onAnswerQuestion={onAnswerQuestion}
            isBusy={isBusy}
          />
        )}

        {message.type === 'solution' && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Advisory Solution
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
                {message.solution.summary}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/8 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Why this tool category fits
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                {message.categoryReasoning}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Recommended approach
              </p>
              <div className="mt-3 space-y-3">
                {message.solution.actionableSteps.map((step, index) => (
                  <div
                    key={`${message.id}-${index}`}
                    className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-sm font-semibold text-[var(--primary)]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-[var(--foreground)]">
                      {step.replace(/^\d+\.\s*/, '')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Tool types to consider
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.solution.toolTypesNeeded.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--foreground)]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Timeline and budget lens
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  {message.solution.estimatedImplementationTime}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  {message.solution.budgetConsiderations}
                </p>
              </div>
            </div>
          </div>
        )}

        {message.type === 'recommendation-prompt' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Would you like me to recommend tools for this solution?
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                I can match marketplace tools to the solution above, or we can
                keep talking through the plan first.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={onShowRecommendations} disabled={isBusy}>
                Yes, recommend tools
              </Button>
              <Button
                variant="outline"
                onClick={onSkipRecommendations}
                disabled={isBusy}
              >
                Not yet
              </Button>
            </div>
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)]">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function buildCategoryReasoning(
  intent: IntentResponse,
  answers: Record<string, string>
) {
  const categoryLabel = formatCategoryLabel(intent.detectedCategory);
  const answerContext = Object.values(answers).filter(Boolean).slice(0, 2);

  if (intent.externalRecommendationsRequired || !intent.detectedCategory) {
    return `The need looks real, but it does not map cleanly to a category we currently cover in the marketplace. I am focusing on the operating problem first so we can clarify the right solution shape before we talk about tool options.`;
  }

  const contextSentence =
    answerContext.length > 0
      ? ` That direction fits the context you shared around ${answerContext.join(
          ' and '
        )}.`
      : '';

  return `A ${categoryLabel} category is the strongest fit because your stated goal is ${intent.detectedIntent.toLowerCase()}. The solution depends on a system in that category to create structure, visibility, and repeatable execution around the problem.${contextSentence}`;
}

function formatCategoryLabel(category: string | null | undefined) {
  if (!category) return 'business solution';
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isRecommendationRequest(message: string) {
  return /\b(recommend|recommendation|tool|tools|options|software|platform)\b/i.test(
    message
  );
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function QuestionMessage({
  message,
  currentQuestionId,
  onAnswerQuestion,
  isBusy,
}: {
  message: Extract<ChatMessage, { type: 'question' }>;
  currentQuestionId?: string;
  onAnswerQuestion: (question: AdvisorQuestion, option: string) => Promise<void>;
  isBusy: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const isMultiSelect = message.question.allowMultiple === true;
  const isDisabled =
    isBusy || message.answered || currentQuestionId !== message.question.id;

  const toggleOption = async (option: string) => {
    if (isDisabled) return;

    if (!isMultiSelect) {
      await onAnswerQuestion(message.question, option);
      return;
    }

    setSelectedOptions((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  };

  const handleMultiSubmit = async () => {
    if (!isMultiSelect || selectedOptions.length === 0 || isDisabled) {
      return;
    }

    await onAnswerQuestion(message.question, selectedOptions.join(', '));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Clarifying Question
        </p>
        <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
          {message.question.text}
        </p>
        {isMultiSelect && (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Select all that apply.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        {message.question.options.map((option) => {
          const isSelected = selectedOptions.includes(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => void toggleOption(option)}
              disabled={isDisabled}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {isMultiSelect && (
        <Button
          type="button"
          onClick={() => void handleMultiSubmit()}
          disabled={isDisabled || selectedOptions.length === 0}
        >
          Submit Selected Options
        </Button>
      )}
    </div>
  );
}
