/** Red asterisk appended to a field label — the marker for "this field is mandatory" across every admin form (optional fields get no suffix at all, per the app's convention). */
/**
 * GC-Stats - required-mark
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
