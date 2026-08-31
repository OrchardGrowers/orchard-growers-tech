import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Profile from "../pages/Profile";
import EscrowSecurityIcon from "./EscrowSecurityIcon";

describe("EscrowSecurityIcon", () => {
  it("renders an accessible shield and lock without a white background container", () => {
    const markup = renderToStaticMarkup(<EscrowSecurityIcon />);

    expect(markup).toContain('aria-label="Escrow security"');
    expect(markup.match(/<svg/g)).toHaveLength(2);
    expect(markup).toContain("text-white");
    expect(markup).not.toContain("bg-white");
  });

  it.each(["login", "signup"])("is present in the %s profile view", (mode) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[{ pathname: "/profile", state: { mode } }]}>
        <Profile />
      </MemoryRouter>,
    );

    expect(markup).toContain("eFruitMandi Escrow Protected");
    expect(markup).toContain('aria-label="Escrow security"');
  });
});
