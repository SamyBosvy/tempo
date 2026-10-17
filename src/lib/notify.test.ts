import { describe, it, expect } from "vitest";
import { permissionLabel } from "./notify";

describe("notification permission states", () => {
  it("granted reads Allowed", () => expect(permissionLabel("granted")).toBe("Allowed"));
  it("denied reads Blocked", () => expect(permissionLabel("denied")).toBe("Blocked"));
  it("default reads Not asked", () => expect(permissionLabel("default")).toBe("Not asked"));
  it("unsupported reads Not supported", () => expect(permissionLabel("unsupported")).toBe("Not supported"));
});
