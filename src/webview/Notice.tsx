import type { ReactNode } from "react";

export function Notice({
    title,
    tone,
    children,
}: {
    title: string;
    tone?: "error";
    children: ReactNode;
}) {
    return (
        <section className={`notice glass${tone ? ` notice-${tone}` : ""}`}>
            <h2>{title}</h2>
            <div>{children}</div>
        </section>
    );
}
