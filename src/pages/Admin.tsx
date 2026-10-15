
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";

type EnquiryStatus = "new" | "contacted" | "closed";

type Enquiry = {
  id: string;
  parentName: string;
  email: string;
  phone: string;
  childName: string;
  childAge: string;
  startDate: string;
  message: string;
  status: EnquiryStatus;
  createdAt: string;
};

type DatabaseEnquiry = {
  id: string;
  parent_name: string;
  email: string;
  phone: string | null;
  child_name: string;
  child_age: number | string | null;
  start_date: string | null;
  message: string | null;
  status: EnquiryStatus | null;
  created_at: string;
};

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const styles: Record<EnquiryStatus, string> = {
    new: "bg-[#e9f3fc] text-[#0758a6]",
    contacted: "bg-[#fff2ce] text-[#8a5a00]",
    closed: "bg-[#e8efe9] text-[#426448]",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"all" | EnquiryStatus>("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");

  // Check whether Supabase has an active session.
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (mounted) {
          setIsAuthenticated(Boolean(data.session));
        }
      } catch (err) {
        console.error("Session check failed:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to check your login session."
          );
        }
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    }

    void checkSession();

    // Keep the dashboard synchronized with Supabase authentication.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthenticated(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load admission enquiries from Supabase.
  async function loadEnquiries() {
    try {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("admissions_enquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) {
        throw queryError;
      }

      const rows = (data ?? []) as unknown as DatabaseEnquiry[];

      const formattedEnquiries: Enquiry[] = rows.map((item) => ({
        id: item.id,
        parentName: item.parent_name,
        email: item.email,
        phone: item.phone ?? "",
        childName: item.child_name,
        childAge: String(item.child_age ?? ""),
        startDate: item.start_date ?? "",
        message: item.message ?? "",
        status: item.status ?? "new",
        createdAt: item.created_at,
      }));

      setEnquiries(formattedEnquiries);

      // Preserve the current selection or select the newest enquiry.
      setSelectedId((currentId) => {
        if (
          currentId &&
          formattedEnquiries.some((item) => item.id === currentId)
        ) {
          return currentId;
        }

        return formattedEnquiries[0]?.id ?? "";
      });
    } catch (err) {
      console.error("Error loading enquiries:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load admission enquiries."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load enquiries after authentication succeeds.
  useEffect(() => {
    if (isAuthenticated) {
      void loadEnquiries();
    } else {
      setEnquiries([]);
      setSelectedId("");
    }

    // loadEnquiries is intentionally called when authentication changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Sign in with Supabase Authentication.
  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSigningIn(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        throw signInError;
      }

      setIsAuthenticated(true);
    } catch (err) {
      console.error("Sign-in failed:", err);

      setError(
        err instanceof Error ? err.message : "Sign in failed."
      );
    } finally {
      setSigningIn(false);
    }
  }

  // Sign out from Supabase Authentication.
  async function handleSignOut() {
    setError("");

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setIsAuthenticated(false);
      setEnquiries([]);
      setSelectedId("");
    } catch (err) {
      console.error("Sign-out failed:", err);

      setError(
        err instanceof Error ? err.message : "Sign out failed."
      );
    }
  }

  // Update the status of a specific enquiry.
  async function updateStatus(
    enquiryId: string,
    status: EnquiryStatus
  ) {
    try {
      setUpdatingStatus(true);
      setError("");

      const { error: updateError } = await supabase
        .from("admissions_enquiries")
        .update({ status })
        .eq("id", enquiryId);

      if (updateError) {
        throw updateError;
      }

      // Update the interface immediately.
      setEnquiries((current) =>
        current.map((item) =>
          item.id === enquiryId ? { ...item, status } : item
        )
      );
    } catch (err) {
      console.error("Error updating enquiry status:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update enquiry status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Search and filter enquiries.
  const filteredEnquiries = useMemo(() => {
    const term = search.trim().toLowerCase();

    return enquiries.filter((enquiry) => {
      const matchesFilter =
        filter === "all" || enquiry.status === filter;

      const searchableText = [
        enquiry.parentName,
        enquiry.email,
        enquiry.childName,
        enquiry.phone,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || searchableText.includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [enquiries, filter, search]);

  const selected = enquiries.find(
    (enquiry) => enquiry.id === selectedId
  );

  const counts = {
    all: enquiries.length,
    new: enquiries.filter((item) => item.status === "new").length,
    contacted: enquiries.filter((item) => item.status === "contacted")
      .length,
    closed: enquiries.filter((item) => item.status === "closed").length,
  };

  // Show a loading screen while checking the login session.
  if (authChecking) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf5fc] px-5 text-[#12376b]">
        <p className="text-sm font-bold">Checking your session...</p>
      </main>
    );
  }

  // Login screen.
  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf5fc] px-5 py-12 text-[#12376b]">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_70px_rgb(18_55_107_/_14%)]">
          <div className="bg-[#0758a6] p-8 text-white">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f6bd3c]">
              Forma Academy
            </p>

            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">
              Admissions admin
            </h1>

            <p className="mt-2 text-sm text-white/60">
              Sign in with your staff account.
            </p>
          </div>

          <form className="space-y-5 p-8" onSubmit={handleSignIn}>
            <label className="form-field">
              <span>Email address</span>
              <input
                autoComplete="username"
                name="email"
                required
                type="email"
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                required
                type="password"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}

            <button
              className="primary-button w-full justify-center border-0 disabled:opacity-60"
              disabled={signingIn}
              type="submit"
            >
              {signingIn ? "Signing in…" : "Sign in"}
            </button>

            <a
              className="block text-center text-xs font-bold text-[#0758a6]"
              href="/"
            >
              Return to website
            </a>
          </form>
        </div>
      </main>
    );
  }

  // Admissions dashboard.
  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#12376b]">
      <header className="border-b border-[#12376b]/10 bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.03em] text-[#0758a6]">
              FORMA ACADEMY
            </p>

            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a6602c]">
              Admissions desk
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              className="rounded-full border border-[#12376b]/15 px-4 py-2 text-xs font-extrabold"
              href="/"
            >
              View website
            </a>

            <button
              className="rounded-full bg-[#12376b] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              disabled={loading}
              onClick={() => void handleSignOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Enquiry management</p>

            <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.045em]">
              Family enquiries
            </h1>
          </div>

          <button
            className="secondary-button border bg-white disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadEnquiries()}
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {(["all", "new", "contacted", "closed"] as const).map(
            (status) => (
              <button
                className={`rounded-[1.4rem] border p-5 text-left transition ${
                  filter === status
                    ? "border-[#0758a6] bg-[#0758a6] text-white"
                    : "border-[#12376b]/10 bg-white"
                }`}
                key={status}
                onClick={() => setFilter(status)}
                type="button"
              >
                <p
                  className={`text-xs font-extrabold uppercase tracking-wide ${
                    filter === status
                      ? "text-white/60"
                      : "text-[#12376b]/45"
                  }`}
                >
                  {status}
                </p>

                <p className="mt-2 text-3xl font-extrabold">
                  {counts[status]}
                </p>
              </button>
            )
          )}
        </div>

        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
            <p>{error}</p>

            <button
              className="shrink-0 underline"
              onClick={() => setError("")}
              type="button"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid min-h-[620px] overflow-hidden rounded-[2rem] border border-[#12376b]/10 bg-white shadow-[0_15px_50px_rgb(18_55_107_/_7%)] lg:grid-cols-[0.9fr_1.1fr]">
          {/* Enquiry list */}
          <div className="border-b border-[#12376b]/10 lg:border-b-0 lg:border-r">
            <div className="border-b border-[#12376b]/10 p-5">
              <input
                className="w-full rounded-xl border border-[#12376b]/15 bg-[#f7f9fc] px-4 py-3 text-sm font-semibold outline-none focus:border-[#2f86cf]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search family, child, email…"
                type="search"
                value={search}
              />
            </div>

            <div className="max-h-[570px] overflow-y-auto">
              {loading && enquiries.length === 0 ? (
                <p className="p-8 text-center text-sm font-bold text-[#12376b]/45">
                  Loading enquiries…
                </p>
              ) : filteredEnquiries.length > 0 ? (
                filteredEnquiries.map((enquiry) => (
                  <button
                    className={`w-full border-b border-[#12376b]/8 p-5 text-left transition hover:bg-[#f7f9fc] ${
                      selectedId === enquiry.id ? "bg-[#edf5fc]" : ""
                    }`}
                    key={enquiry.id}
                    onClick={() => setSelectedId(enquiry.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-extrabold">
                          {enquiry.parentName}
                        </p>

                        <p className="mt-1 text-sm text-[#12376b]/50">
                          For {enquiry.childName}, age {enquiry.childAge}
                        </p>
                      </div>

                      <StatusBadge status={enquiry.status} />
                    </div>

                    <p className="mt-3 text-xs font-semibold text-[#12376b]/35">
                      {new Date(enquiry.createdAt).toLocaleDateString(
                        undefined,
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </button>
                ))
              ) : (
                <p className="p-8 text-center text-sm font-bold text-[#12376b]/45">
                  {loading ? "Loading enquiries…" : "No enquiries found."}
                </p>
              )}
            </div>
          </div>

          {/* Selected enquiry details */}
          <div className="p-6 sm:p-8 lg:p-10">
            {selected ? (
              <>
                <div className="flex flex-col justify-between gap-4 border-b border-[#12376b]/10 pb-7 sm:flex-row sm:items-start">
                  <div>
                    <StatusBadge status={selected.status} />

                    <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em]">
                      {selected.parentName}
                    </h2>

                    <p className="mt-2 text-sm text-[#12376b]/45">
                      Received{" "}
                      {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <select
                    aria-label="Update enquiry status"
                    className="rounded-xl border border-[#12376b]/15 bg-white px-4 py-3 text-sm font-extrabold disabled:opacity-60"
                    disabled={updatingStatus}
                    onChange={(event) => {
                      const newStatus = event.target.value as EnquiryStatus;

                      void updateStatus(selected.id, newStatus);
                    }}
                    value={selected.status}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {updatingStatus && (
                  <p className="mt-4 text-xs font-bold text-[#0758a6]">
                    Updating status…
                  </p>
                )}

                <div className="grid gap-6 py-7 sm:grid-cols-2">
                  {[
                    ["Email", selected.email],
                    ["Phone", selected.phone || "Not provided"],
                    ["Child", selected.childName],
                    ["Child’s age", `${selected.childAge} years old`],
                    ["Preferred start", selected.startDate || "Not provided"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#12376b]/40">
                        {label}
                      </p>

                      <p className="mt-2 break-words font-bold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.5rem] bg-[#f7f9fc] p-6">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#12376b]/40">
                    Family message
                  </p>

                  <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[#12376b]/70">
                    {selected.message ||
                      "No additional message was provided."}
                  </p>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    className="primary-button"
                    href={`mailto:${selected.email}`}
                  >
                    Email family
                  </a>

                  {selected.phone && (
                    <a
                      className="secondary-button"
                      href={`tel:${selected.phone}`}
                    >
                      Call family
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="text-lg font-extrabold">
                    Select an enquiry
                  </p>

                  <p className="mt-2 text-sm text-[#12376b]/45">
                    Family details will appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default Admin;

