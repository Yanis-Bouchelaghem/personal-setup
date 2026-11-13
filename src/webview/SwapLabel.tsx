/**
 * A label that switches between texts without resizing its button: every text
 * sits in the same grid cell, and only the current one is visible, so the
 * button is always as wide as the widest of them.
 */
export function SwapLabel({
    texts,
    current,
}: {
    texts: readonly string[];
    current: string;
}) {
    return (
        <span className="swap">
            {texts.map((text) => (
                <span key={text} aria-hidden={text !== current}>
                    {text}
                </span>
            ))}
        </span>
    );
}
