import supabase from "lib/supabaseClient";
// optional: withRetry wrapper

export async function startCheckout() {
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token;
  if (!token) {
    throw new Error("Please sign in to start checkout.");
  }

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Checkout URL missing");
  console.log("[UI] checkout session id:", data.sessionId || data.id);
  window.location.href = data.url;
}

export async function openBillingPortal() {
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token;
  if (!token) {
    throw new Error("Please sign in to open billing.");
  }

  const { data, error } = await supabase.functions.invoke("create-portal", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  window.location.href = data.url;
}
