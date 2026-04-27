import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { practiceCards } from '@/data/learning';

export type KnowledgeStatus = 'unknown' | 'partial' | 'known';

type NotesByCard = Record<string, string>;
type ProgressByCard = Record<string, KnowledgeStatus>;

type ProgressContextValue = {
  currentCardId: string;
  currentIndex: number;
  notesByCard: NotesByCard;
  progressByCard: ProgressByCard;
  knownCount: number;
  partialCount: number;
  unknownCount: number;
  totalCount: number;
  setCurrentCardId: (cardId: string) => void;
  markCard: (cardId: string, status: KnowledgeStatus) => void;
  saveNote: (cardId: string, note: string) => void;
  nextCard: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressByCard, setProgressByCard] = useState<ProgressByCard>({});
  const [notesByCard, setNotesByCard] = useState<NotesByCard>({});

  const currentCardId = practiceCards[currentIndex]?.id ?? practiceCards[0]?.id ?? '';

  const setCurrentCardId = useCallback((cardId: string) => {
    const nextIndex = practiceCards.findIndex((card) => card.id === cardId);
    setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
  }, []);

  const nextCard = useCallback(() => {
    setCurrentIndex((index) => (index + 1) % practiceCards.length);
  }, []);

  const markCard = useCallback(
    (cardId: string, status: KnowledgeStatus) => {
      setProgressByCard((progress) => ({ ...progress, [cardId]: status }));
      nextCard();
    },
    [nextCard],
  );

  const saveNote = useCallback((cardId: string, note: string) => {
    setNotesByCard((notes) => {
      const trimmed = note.trim();
      if (!trimmed) {
        const next = { ...notes };
        delete next[cardId];
        return next;
      }

      return { ...notes, [cardId]: trimmed };
    });
  }, []);

  const value = useMemo(() => {
    const statuses = Object.values(progressByCard);

    return {
      currentCardId,
      currentIndex,
      notesByCard,
      progressByCard,
      knownCount: statuses.filter((status) => status === 'known').length,
      partialCount: statuses.filter((status) => status === 'partial').length,
      unknownCount: statuses.filter((status) => status === 'unknown').length,
      totalCount: practiceCards.length,
      setCurrentCardId,
      markCard,
      saveNote,
      nextCard,
    };
  }, [
    currentCardId,
    currentIndex,
    markCard,
    nextCard,
    notesByCard,
    progressByCard,
    saveNote,
    setCurrentCardId,
  ]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);

  if (!context) {
    throw new Error('useProgress must be used inside ProgressProvider');
  }

  return context;
}
