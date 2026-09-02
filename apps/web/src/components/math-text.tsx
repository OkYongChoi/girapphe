import KnowledgeText from './knowledge-text';

interface MathTextProps {
  text: string;
  className?: string;
}

/** Compatibility wrapper for legacy card content that used single-dollar math. */
export default function MathText({ text, className }: MathTextProps) {
  return <KnowledgeText text={text} className={className} legacyDollarMath />;
}
