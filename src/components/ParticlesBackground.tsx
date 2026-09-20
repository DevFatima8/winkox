"use client";

import { useEffect, type CSSProperties } from "react";

const layers = [
    {
        id: "wx-particles-circles",
        color: [0, 229, 160],
        hex: "#00e5a0",
        shape: "circle",
        size: 2.8,
        count: 42,
        speed: 0.35,
        opacity: 0.7,
        links: false,
    },
    {
        id: "wx-particles-triangles",
        color: [0, 194, 255],
        hex: "#00c2ff",
        shape: "triangle",
        size: 3.8,
        count: 18,
        speed: 0.55,
        opacity: 0.5,
        links: false,
    },
    {
        id: "wx-particles-stars",
        color: [255, 176, 32],
        hex: "#ffb020",
        shape: "star",
        size: 4.8,
        count: 12,
        speed: 0.16,
        opacity: 0.65,
        links: false,
    },
] as const;

const hearts = [
    [8, 16, 14, 0], [19, 68, 22, 2.4], [31, 34, 10, 1.1], [43, 82, 16, 3.8],
    [57, 13, 24, 1.7], [68, 54, 12, 4.5], [79, 28, 18, 0.7], [91, 76, 9, 2.9],
    [13, 91, 8, 5.2], [37, 7, 12, 3.2], [52, 63, 10, 5.8], [73, 88, 21, 1.9],
] as const;

function configFor(layer: (typeof layers)[number], reducedMotion: boolean) {
    return {
        particles: {
            number: { value: layer.count, density: { enable: true, value_area: 1100 } },
            color: { value: layer.hex },
            shape: { type: layer.shape, polygon: { nb_sides: 5 }, stroke: { width: 0, color: "#000000" } },
            opacity: { value: layer.opacity, random: true, anim: { enable: true, speed: 0.7, opacity_min: 0.08, sync: false } },
            size: { value: layer.size, random: true, anim: { enable: false } },
            line_linked: { enable: layer.links, distance: 145, color: layer.hex, opacity: 0.2, width: 1 },
            move: { enable: !reducedMotion, speed: layer.speed, direction: "none", random: true, straight: false, out_mode: "out", bounce: false },
        },
        interactivity: {
            detect_on: "canvas",
            events: { onhover: { enable: false, mode: "grab" }, onclick: { enable: false }, resize: true },
            modes: { grab: { distance: 130, line_linked: { opacity: 0.35 } } },
        },
        retina_detect: true,
    };
}

export function ParticlesBackground() {
    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let active = true;
        void import("particles.js").then(() => {
            if (!active) return;
            layers.forEach((layer) => window.particlesJS(layer.id, configFor(layer, reducedMotion)));
            requestAnimationFrame(() => {
                document.querySelectorAll<HTMLCanvasElement>(".wx-particles-layer canvas").forEach((canvas) => {
                    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
                });
            });
        });

        return () => {
            active = false;
            document.querySelectorAll(".wx-particles-layer canvas").forEach((canvas) => canvas.remove());
        };
    }, []);

    return (
        <div className="wx-particles" aria-hidden="true">
            {layers.map((layer) => <div className="wx-particles-layer" id={layer.id} key={layer.id} />)}
            <div className="wx-heart-particles">
                {hearts.map(([top, left, size, delay], index) => (
                    <span className="wx-heart-particle" key={index} style={{ position: "absolute", top: `${top}%`, left: `${left}%`, color: "#ff4d7d", fontSize: `${size}px`, lineHeight: 1, textShadow: "0 0 8px rgba(255, 63, 114, .9), 0 0 18px rgba(255, 176, 32, .45)", animation: `wx-heart-float 8s ease-in-out ${delay}s infinite` } as CSSProperties}>♥</span>
                ))}
            </div>
            <style>{`@keyframes wx-heart-float { 0%,100% { transform: translate3d(0,12px,0) rotate(-8deg); opacity:.3 } 50% { transform: translate3d(14px,-34px,0) rotate(12deg); opacity:1 } }`}</style>
        </div>
    );
}