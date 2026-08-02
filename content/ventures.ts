import type { Venture } from "./types";

/**
 * Verified venture and builder profiles only — never fictional examples.
 *
 * Launch rule: the public "Built Here" directory stays hidden until at least
 * TWO verified profiles exist AND builderDirectoryEnabled is true in
 * content/site.ts.
 *
 * Before adding a profile:
 * - Confirm the founder's permission to publish (permissionToPublish: true).
 * - Publish traction only with founder confirmation and a verification date.
 * - Route contact through a form unless the founder explicitly consents to
 *   direct contact details being shown.
 */
export const ventures: Venture[] = [];
