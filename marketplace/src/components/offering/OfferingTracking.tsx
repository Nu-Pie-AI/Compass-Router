"use client";

import { useEffect } from "react";

interface OfferingTrackingProps {
  slug: string;
}

export function OfferingTracking({ slug }: OfferingTrackingProps) {
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/offerings/${slug}/view`, {
      method: "POST",
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {
      // Analytics should never interrupt the buyer experience.
    });

    return () => controller.abort();
  }, [slug]);

  return null;
}
