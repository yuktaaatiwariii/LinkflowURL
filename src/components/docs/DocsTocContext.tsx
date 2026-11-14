import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface DocsSectionInfo {
  id: string;
  title: string;
}

interface DocsTocValue {
  sections: DocsSectionInfo[];
  activeId: string | null;
  registerSection: (section: DocsSectionInfo) => void;
  reportOffset: (id: string, y: number) => void;
  scrollToSection: (id: string) => void;
  setScrollHandler: (handler: ((y: number) => void) | null) => void;
  setActiveSection: (id: string) => void;
  updateActiveFromScroll: (y: number) => void;
  reset: () => void;
}

const DocsTocContext = createContext<DocsTocValue | null>(null);

export function DocsTocProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = useState<DocsSectionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const offsets = useRef<Record<string, number>>({});
  const scrollHandler = useRef<((y: number) => void) | null>(null);

  const registerSection = useCallback((section: DocsSectionInfo) => {
    setSections((current) => {
      const existing = current.find((entry) => entry.id === section.id);
      if (existing) {
        if (existing.title === section.title) return current;
        return current.map((entry) =>
          entry.id === section.id ? { ...entry, title: section.title } : entry
        );
      }
      return [...current, section];
    });
  }, []);

  const reportOffset = useCallback((id: string, y: number) => {
    offsets.current[id] = y;
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const y = offsets.current[id];
    if (typeof y === 'number' && scrollHandler.current) {
      scrollHandler.current(Math.max(0, y - 24));
      setActiveId(id);
    }
  }, []);

  const setScrollHandler = useCallback((handler: ((y: number) => void) | null) => {
    scrollHandler.current = handler;
  }, []);

  const setActiveSection = useCallback((id: string) => {
    setActiveId((current) => (current === id ? current : id));
  }, []);

  const updateActiveFromScroll = useCallback(
    (y: number) => {
      let current: string | null = null;
      for (const section of sections) {
        const offset = offsets.current[section.id];
        if (typeof offset === 'number' && offset - 140 <= y) {
          current = section.id;
        }
      }
      if (current) {
        setActiveId((previous) => (previous === current ? previous : current));
      }
    },
    [sections]
  );

  const reset = useCallback(() => {
    offsets.current = {};
    setSections([]);
    setActiveId(null);
  }, []);

  const value = useMemo(
    () => ({
      sections,
      activeId,
      registerSection,
      reportOffset,
      scrollToSection,
      setScrollHandler,
      setActiveSection,
      updateActiveFromScroll,
      reset,
    }),
    [
      sections,
      activeId,
      registerSection,
      reportOffset,
      scrollToSection,
      setScrollHandler,
      setActiveSection,
      updateActiveFromScroll,
      reset,
    ]
  );

  return <DocsTocContext.Provider value={value}>{children}</DocsTocContext.Provider>;
}

export function useDocsToc(): DocsTocValue {
  const value = useContext(DocsTocContext);
  if (!value) {
    throw new Error('useDocsToc must be used inside DocsTocProvider (the /developers layout).');
  }
  return value;
}
