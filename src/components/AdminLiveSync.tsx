"use client";

import { useEffect } from "react";

/** Poll the shared notification/activity signal so every mounted admin loader refreshes. */
export function AdminLiveSync() {
    useEffect(() => {
        const id = window.setInterval(() => window.dispatchEvent(new Event("wx:admin-refresh")), 4000);
        return () => window.clearInterval(id);
    }, []);
    return null;
}