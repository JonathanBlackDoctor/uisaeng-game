import { useId, useState, type ReactNode } from 'react';

export default function PlayDetails({ children }: { children: [ReactNode, ReactNode] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const labels = ['생활·진로', '내 정보'];
  return <section className="play-details" aria-label="생활과 내 정보">
    <div className="play-detail-tabs" role="tablist" aria-label="상세 정보">
      {labels.map((label, index) => <button key={label} id={`${id}-tab-${index}`} role="tab" aria-selected={active === index} aria-controls={`${id}-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
        setActive(next);
        document.getElementById(`${id}-tab-${next}`)?.focus();
      }}>{label}</button>)}
    </div>
    {children.map((content, index) => <div key={index} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={active !== index} tabIndex={0}>{content}</div>)}
  </section>;
}
