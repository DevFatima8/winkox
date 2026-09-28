"use client";

export function localApi(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}
