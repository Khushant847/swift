/**
 * Renders Schema.org JSON-LD.
 *
 * `<` is escaped so admin-editable content can never break out of the script
 * tag. Only pass facts that are also visible on the page.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
