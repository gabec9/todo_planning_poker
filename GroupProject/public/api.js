// Tiny fetch wrapper. Session = sessionStorage (project + user name).
async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-project": sessionStorage.getItem("project") || "",
      "x-user": sessionStorage.getItem("user") || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
