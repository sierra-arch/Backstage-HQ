// useGoogleDocs.ts - Google OAuth + Docs API integration
const CLIENT_ID = "198846139141-o5b6f4fhenbb8ro17292hnto5acsqg4c.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";

let _tokenClient: any = null;
let _accessToken: string | null = null;
let _tokenExpiry: number = 0;

function isTokenValid(): boolean {
  return !!_accessToken && Date.now() < _tokenExpiry - 60_000;
}

function initTokenClient() {
  if (!_tokenClient && (window as any).google?.accounts?.oauth2) {
    _tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    });
  }
  return _tokenClient;
}

function requestToken(prompt: "consent" | ""): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = initTokenClient();
    if (!client) {
      reject(new Error("Google Identity Services not loaded"));
      return;
    }
    client.callback = (resp: any) => {
      if (resp.error) {
        reject(new Error(resp.error));
      } else {
        _accessToken = resp.access_token;
        _tokenExpiry = Date.now() + resp.expires_in * 1000;
        resolve(_accessToken!);
      }
    };
    client.requestAccessToken({ prompt });
  });
}

/** Shows the Google permission popup. Must be called from a user gesture (button click). */
export async function connectGoogle(): Promise<string> {
  return requestToken("consent");
}

/** Try to get a valid token without a popup. Returns null if not yet authorized. */
export async function getTokenSilently(): Promise<string | null> {
  if (isTokenValid()) return _accessToken!;
  try {
    return await requestToken("");
  } catch {
    return null;
  }
}

export async function createGoogleDoc(title: string, token: string): Promise<string> {
  const res = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create Google Doc");
  const data = await res.json();
  return data.documentId;
}

export async function appendToDoc(docId: string, text: string, token: string): Promise<void> {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const entry = `${date}\n${text}\n\n`;

  // Insert at index 1 = top of the document, so newest notes always appear first
  await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: entry } }],
    }),
  });
}
