import { decodeAgentOwnerSession, type AuthenticatedOwner } from "./agentOwnerSession";

export class UnauthorizedAgentOwnerError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedAgentOwnerError";
  }
}

export function getAgentOwnerFromRequest(request: Request): AuthenticatedOwner | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const sessionCookie = getCookieValue(cookieHeader, "accessmesh_agent_owner_session");
  return decodeAgentOwnerSession(sessionCookie);
}

export function requireAgentOwner(request: Request): AuthenticatedOwner {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    throw new UnauthorizedAgentOwnerError();
  }

  return owner;
}

function getCookieValue(cookieHeader: string, name: string) {
  const segments = cookieHeader.split(";");

  for (const segment of segments) {
    const [rawKey, ...rawValue] = segment.trim().split("=");
    if (rawKey === name) {
      return rawValue.join("=");
    }
  }

  return null;
}
