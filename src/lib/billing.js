import supabase from "../supabaseClient";
// optional: withRetry wrapper

export async function startCheckout() {
  const { data, error } = await supabase.functions.invoke("create-checkout");
  if (error) throw error;
  window.location.href = data.url;
}

export async function openBillingPortal() {
  const { data, error } = await supabase.functions.invoke("create-portal");
  if (error) throw error;
  window.location.href = data.url;
}
