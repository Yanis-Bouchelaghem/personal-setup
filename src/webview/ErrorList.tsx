export function ErrorList({ errors }: { errors: string[] }) {
    return (
        <ul className="errors">
            {errors.map((error) => (
                <li key={error}>
                    <code>{error}</code>
                </li>
            ))}
        </ul>
    );
}
