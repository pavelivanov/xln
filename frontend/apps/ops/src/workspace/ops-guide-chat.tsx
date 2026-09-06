import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { loadXlnAssistantCatalog, streamXlnAssistantReply, type XlnAssistantCatalog, type XlnAssistantMessage } from '../../../../src/lib/ai/xln-assistant-client';
import { buildXlnGuideMessages, suggestedXlnGuideQuestions } from '../../../../src/lib/ai/xln-guide-context';
import { renderSafeMarkdown } from '../../../../src/lib/security/safe-markdown';
import '../../../../src/lib/components/XlnMascot/xln-mascot-chat.css';

type Props = Readonly<{ messages: XlnAssistantMessage[]; setMessages: Dispatch<SetStateAction<XlnAssistantMessage[]>>; onClose: () => void }>;
export function OpsGuideChat({ messages, setMessages, onClose }: Props) {
  const [catalog, setCatalog] = useState<XlnAssistantCatalog | null>(null);
  const [model, setModel] = useState('');
  const [input, setInput] = useState('');
  const [issue, setIssue] = useState('');
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const connect = async (): Promise<void> => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setChecking(true); setIssue('');
    try {
      const next = await loadXlnAssistantCatalog(request.signal);
      if (request.signal.aborted) return;
      setCatalog(next); setModel(next.defaultModel);
    } catch (cause) {
      if (request.signal.aborted) return;
      setCatalog(null); setIssue(cause instanceof Error ? cause.message : String(cause));
    } finally { if (!request.signal.aborted) { controller.current = null; setChecking(false); } }
  };
  useEffect(() => { void connect(); textarea.current?.focus(); return () => controller.current?.abort(); }, []);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  const submit = async (question = input): Promise<void> => {
    if (!question.trim() || sending || !catalog || !model) return;
    const request = new AbortController();
    controller.current = request;
    const history = messages.slice(-10);
    setMessages(current => [...current, { role: 'user', content: question.trim() }, { role: 'assistant', content: '' }]);
    setInput(''); setSending(true); setIssue('');
    try {
      const context = await buildXlnGuideMessages({ query: question, pathname: window.location.pathname, history, signal: request.signal });
      await streamXlnAssistantReply({ model, messages: context, signal: request.signal, onContent: content => {
        if (request.signal.aborted) return;
        setMessages(current => current.map((message, index) => index === current.length - 1 ? { ...message, content: message.content + content } : message));
      } });
    } catch (cause) {
      setMessages(current => current.filter((message, index) => index !== current.length - 1 || message.content.trim()));
      if (!request.signal.aborted) setIssue(cause instanceof Error ? cause.message : String(cause));
    } finally { if (!request.signal.aborted) { setSending(false); controller.current = null; textarea.current?.focus(); } }
  };
  return <section className="assistant-panel" data-testid="xln-mascot-chat" aria-label="xln assistant" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    <header><div className="identity"><span className="mini-mark" aria-hidden="true" /><span><strong>Ask xln</strong><small>{checking ? 'Connecting…' : catalog ? 'Local AI · public docs' : 'Local AI offline'}</small></span></div><div className="header-actions"><button aria-label="Retry local AI" disabled={checking || sending} onClick={() => { void connect(); }} type="button">↻</button><button aria-label="Close xln assistant" onClick={onClose} type="button">×</button></div></header>
    {catalog && catalog.models.length > 1 ? <label className="model-row">Model<select aria-label="Local AI model" disabled={sending} onChange={event => setModel(event.currentTarget.value)} value={model}>{catalog.models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
    <div className="transcript" ref={transcript} aria-live="polite">{messages.length ? messages.map((message, index) => <article className={message.role} key={index}><span>{message.role === 'assistant' ? 'xln' : 'You'}</span><div className="message-markdown" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(message.content || 'Thinking…') }} /></article>) : <><div className="intro"><strong>Point at the confusing part.</strong><p>I’ll explain this screen using xln’s own documentation.</p></div><div className="suggestions" aria-label="Suggested questions">{suggestedXlnGuideQuestions(window.location.pathname).map(question => <button disabled={!catalog || sending} key={question} onClick={() => { void submit(question); }} type="button">{question}</button>)}</div></>}</div>
    {issue ? <div className="assistant-error" role="alert"><span>{issue}</span><a href="/ai">Open local AI →</a></div> : null}
    <form className="composer" onSubmit={event => { event.preventDefault(); void submit(); }}><textarea aria-label="Ask xln" placeholder="Ask about this screen…" ref={textarea} value={input} onChange={event => setInput(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} /><button aria-label="Send question" disabled={!catalog || sending || !input.trim()} type="submit">↑</button></form>
  </section>;
}
