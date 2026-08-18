import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import daMessages from "../../../../messages/da.json";

// The bug this covers: signInWithPassword RETURNS { error } for a bad password,
// but THROWS on a transport failure (unreachable Supabase project, or a
// deployment missing NEXT_PUBLIC_SUPABASE_* — client.ts asserts those with `!`,
// so a missing one yields an invalid URL). Without a try/catch the throw escaped
// the handler: setLoading(false) never ran and no error was set, so the user got
// a spinner that span forever with no feedback and no way to tell what failed.

const signInWithPassword = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/login",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signInWithOAuth: vi.fn(),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));

import LoginPage from "./page";

const L = daMessages.Login;

function submitLogin() {
  render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <LoginPage />
    </NextIntlClientProvider>
  );
  fireEvent.change(screen.getByLabelText(L.emailLabel), {
    target: { value: "someone@example.com" },
  });
  fireEvent.change(screen.getByLabelText(L.passwordLabel), {
    target: { value: "hunter2hunter2" },
  });
  fireEvent.click(screen.getByRole("button", { name: L.submit }));
}

describe("LoginPage error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows an error instead of spinning forever when the request throws", async () => {
    signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));

    submitLogin();

    expect(await screen.findByText(L.errorGeneric)).toBeVisible();
    // The button must come back to its idle label — a stuck spinner IS the bug.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: L.submit })).toBeEnabled()
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("still shows the specific message for wrong credentials", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    submitLogin();

    expect(await screen.findByText(L.errorInvalidCredentials)).toBeVisible();
  });

  it("navigates into the app on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
