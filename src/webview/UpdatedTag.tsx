/**
 * "Updated", on a goal with a step that is new or changed since the reader
 * last looked. It sits after the title, which takes the space back when it
 * goes, so the count beside it stays put.
 */
export function UpdatedTag({ shown }: { shown: boolean }) {
    if (!shown) {
        return null;
    }
    return (
        <span className="updated-pill" title="Has new or changed steps">
            Updated
        </span>
    );
}
