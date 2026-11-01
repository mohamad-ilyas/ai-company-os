"use client";

import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · AI Company OS`;
  }, [title]);
}
