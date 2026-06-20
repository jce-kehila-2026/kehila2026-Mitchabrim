import { useEffect, useState } from "react";
import { subscribeSiteContent, DEFAULT_SITE_CONTENT } from "@/services/siteContentService";

export default function useSiteContent() {
  const [content, setContent] = useState(DEFAULT_SITE_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeSiteContent((data) => {
      setContent(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { content, loading };
}
