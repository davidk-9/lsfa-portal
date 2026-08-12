import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Enrollment, Student, Unit } from '../types/lms';

interface SessionContextType {
  enrollment: Enrollment | null;
  student: Student | null;
  unit: Unit | null;
  setSession: (enrollment: Enrollment) => void;
  clearSession: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setSession = (data: Enrollment) => {
    setEnrollment(data);
  };

  const clearSession = () => {
    setEnrollment(null);
  };

  return (
    <SessionContext.Provider
      value={{
        enrollment,
        student: enrollment?.student || null,
        unit: enrollment?.unit || null,
        setSession,
        clearSession,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
