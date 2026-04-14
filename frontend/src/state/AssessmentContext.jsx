/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AssessmentContext = createContext(null);
const STORAGE_KEY = "adr_latest_assessment";

const loadStoredAssessment = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AssessmentProvider = ({ children }) => {
  const [latestAssessment, setLatestAssessment] = useState(loadStoredAssessment);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!latestAssessment) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latestAssessment));
  }, [latestAssessment]);

  const value = useMemo(
    () => ({
      latestAssessment,
      setLatestAssessment,
      history,
      setHistory,
    }),
    [latestAssessment, history]
  );

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error("useAssessment must be used within AssessmentProvider");
  }
  return context;
};
