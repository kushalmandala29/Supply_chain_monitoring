const API_BASE = "/api/v1";

/**
 * REST API service layer for the backend.
 */
export const api = {
  async submitQuery(query: string, coordinates?: number[]) {
    const res = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, coordinates }),
    });
    return res.json();
  },

  async injectScenario(description: string, parameters: Record<string, number>, coordinates?: number[]) {
    const res = await fetch(`${API_BASE}/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario_description: description,
        parameters,
        coordinates,
      }),
    });
    return res.json();
  },

  async healthCheck() {
    const res = await fetch("/health");
    return res.json();
  },
};
